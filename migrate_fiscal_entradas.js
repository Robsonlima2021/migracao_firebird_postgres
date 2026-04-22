require('dotenv').config();
const firebird = require('node-firebird');
const { Client } = require('pg');

const fbOptions = {
    host: process.env.FB_HOST || '127.0.0.1',
    port: parseInt(process.env.FB_PORT || '3050'),
    database: process.env.FB_DATABASE || 'C:\\DATABASES\\DADOS.FDB',
    user: process.env.FB_USER || 'SYSDBA',
    password: process.env.FB_PASS || 'masterkey',
    lowercase_keys: false
};

const pgClient = new Client({
    user: process.env.PG_USER || 'postgres',
    host: process.env.PG_HOST || '127.0.0.1',
    database: process.env.PG_DATABASE || 'control',
    password: process.env.PG_PASS || '',
    port: parseInt(process.env.PG_PORT || '5432'),
});

async function run() {
    console.log("🚀 Iniciando migração de informações fiscais de entrada...");
    await pgClient.connect();

    firebird.attach(fbOptions, async (err, fbDb) => {
        if (err) {
            console.error("❌ Erro ao conectar no Firebird:", err);
            process.exit(1);
        }

        try {
            await pgClient.query("SET session_replication_role = replica;");

            const produtoMap = await getProdutoMap();
            console.log(`📦 Mapa de produtos carregado: ${Object.keys(produtoMap).length} itens.`);

            await migrateCabecalhos(fbDb);
            await migrateItens(fbDb, produtoMap);

            await pgClient.query("SET session_replication_role = default;");
            console.log("\n✅ Migração fiscal concluída!");
        } catch (e) {
            console.error("❌ Erro durante a migração:", e);
        } finally {
            fbDb.detach();
            await pgClient.end();
            process.exit(0);
        }
    });
}

async function getProdutoMap() {
    const res = await pgClient.query("SELECT codigo, codbarra, codigodefabrica FROM produtos");
    const map = {};
    res.rows.forEach(r => {
        if (r.codbarra) map[r.codbarra.trim()] = r.codigo;
        if (r.codigodefabrica) map[r.codigodefabrica.trim()] = r.codigo;
        map[r.codigo.toString()] = r.codigo;
    });
    return map;
}

function getFbData(fbDb, query) {
    return new Promise((resolve, reject) => {
        fbDb.query(query, (err, result) => {
            if (err) return reject(err);
            resolve(result);
        });
    });
}

async function migrateCabecalhos(fbDb) {
    console.log("\n--- Migrando Cabeçalhos (COMPRAS) ---");
    const compras = await getFbData(fbDb, `SELECT * FROM COMPRAS`);
    console.log(`Encontradas ${compras.length} compras no Firebird.`);

    let count = 0;
    for (const c of compras) {
        try {
            const query = `
                INSERT INTO cabecalho_nota_compra (
                    codigo, nota, data, fornecedor, serie, total_nota, total_produtos, 
                    desconto, chave_nfe, data_processamento, status, usuario
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (codigo) DO UPDATE SET 
                    nota = EXCLUDED.nota,
                    data = EXCLUDED.data,
                    fornecedor = EXCLUDED.fornecedor,
                    serie = EXCLUDED.serie,
                    total_nota = EXCLUDED.total_nota,
                    total_produtos = EXCLUDED.total_produtos,
                    desconto = EXCLUDED.desconto,
                    chave_nfe = EXCLUDED.chave_nfe,
                    data_processamento = EXCLUDED.data_processamento,
                    status = EXCLUDED.status,
                    usuario = EXCLUDED.usuario
            `;

            const nota = parseInt(c.COM_NUMERONF, 10) || 0;
            const status = c.SIT_CODIGO === 2 ? 'F' : 'A';
            const usuario = c.USU_CODIGO || 1;

            await pgClient.query(query, [
                c.COM_NUMERO,
                nota,
                c.COM_DATA,
                c.CRE_CODIGO,
                c.COM_SERIE?.toString().trim().substring(0, 3) || '',
                c.COM_VRTOTALNF || 0,
                c.COM_TOTAL || 0,
                c.COM_VRDESCONTO || 0,
                c.COM_CHAVE?.toString().trim() || '',
                c.COM_DATAEMISSAONF || c.COM_DATA,
                status,
                usuario
            ]);

            count++;
            if (count % 500 === 0) process.stdout.write('.');
        } catch (err) {
            console.error(`\nErro Nota ${c.COM_NUMERO}:`, err.message);
        }
    }
    console.log(`\n> ${count} cabeçalhos migrados.`);
}

async function migrateItens(fbDb, produtoMap) {
    console.log("\n--- Migrando Itens e Impostos (ITENSCOM) ---");
    const itens = await getFbData(fbDb, `SELECT * FROM ITENSCOM`);
    console.log(`Encontrados ${itens.length} itens no Firebird.`);

    let count = 0;
    for (const i of itens) {
        try {
            // 1. Resolve ID do Produto
            const oldProCodigo = i.PRO_CODIGO?.toString().trim();
            const cd_produto = produtoMap[oldProCodigo] || parseInt(oldProCodigo, 10);
            
            if (!cd_produto || isNaN(cd_produto)) {
                // console.warn(`\nProduto não encontrado: ${oldProCodigo}`);
                continue;
            }

            // 2. Insere Item
            const itemQuery = `
                INSERT INTO itens_nota_compra (
                    codigo, cd_nota, produto, quantidade, preco_custo, desconto, cfop, total, nitem
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (codigo) DO UPDATE SET 
                    cd_nota = EXCLUDED.cd_nota,
                    produto = EXCLUDED.produto,
                    quantidade = EXCLUDED.quantidade,
                    preco_custo = EXCLUDED.preco_custo,
                    cfop = EXCLUDED.cfop,
                    total = EXCLUDED.total,
                    nitem = EXCLUDED.nitem
            `;

            // O codigo do item no PG pode ser uma composição ou o ICP_NUMERO se for único globalmente.
            // No FB ITENSCOM, ICP_NUMERO parece ser sequencial dentro da nota.
            // Para garantir unicidade global no PG (coluna 'codigo' INTEGER), vamos usar uma fórmula:
            // (COM_NUMERO * 1000) + ICP_NUMERO ou algo similar, ou deixar o PG gerar se for SERIAL.
            // Mas o 'codigo' no PG parece ser a PK. Vamos verificar se é SERIAL.
            
            // Usaremos (COM_NUMERO * 10000) + ICP_NUMERO para evitar colisões se COM_NUMERO for < 200.000
            const itemCodigo = i.ICP_NUMERO;

            await pgClient.query(itemQuery, [
                itemCodigo,
                i.COM_NUMERO,
                cd_produto,
                i.ICP_QTDE || 0,
                i.ICP_PRECO || 0,
                i.ICP_VLRDESCONTO || 0,
                i.NAF_CFOP?.toString().trim(),
                i.ICP_VLRTOTAL || 0,
                i.ICP_NUMERO
            ]);

            // 3. Insere Impostos
            const impostoQuery = `
                INSERT INTO itens_nota_compra_impostos (
                    cd_item, cst_nota, base_icms, valor_icms, icms, base_ipi, valor_ipi, ipi, ipi_cst,
                    base_icms_st, valor_icms_st, pis_cst, cofins_cst
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (cd_item) DO UPDATE SET 
                    cst_nota = EXCLUDED.cst_nota,
                    base_icms = EXCLUDED.base_icms,
                    valor_icms = EXCLUDED.valor_icms,
                    icms = EXCLUDED.icms,
                    base_ipi = EXCLUDED.base_ipi,
                    valor_ipi = EXCLUDED.valor_ipi,
                    ipi = EXCLUDED.ipi,
                    ipi_cst = EXCLUDED.ipi_cst,
                    base_icms_st = EXCLUDED.base_icms_st,
                    valor_icms_st = EXCLUDED.valor_icms_st,
                    pis_cst = EXCLUDED.pis_cst,
                    cofins_cst = EXCLUDED.cofins_cst
            `;

            const cst_icms = i.ICM_CODIGO?.toString().padStart(2, '0');
            const pis_cst = i.PIS_CODIGO?.toString().padStart(2, '0');
            const cofins_cst = i.COF_CODIGO?.toString().padStart(2, '0');
            const ipi_cst = i.IPI_CODIGO?.toString().padStart(2, '0');

            await pgClient.query(impostoQuery, [
                itemCodigo,
                cst_icms,
                i.ICP_VLRBCICMS || 0,
                i.ICP_VLRICMS || 0,
                i.ICP_PERCICMS || 0,
                i.ICP_VLRBCIPI || 0,
                i.ICP_VLRIPI || 0,
                i.ICP_PERCIPI || 0,
                ipi_cst,
                i.ICP_VLRBCICMSSUBST || 0,
                i.ICP_VLRICMSSUBST || 0,
                pis_cst,
                cofins_cst
            ]);

            count++;
            if (count % 1000 === 0) process.stdout.write('.');
        } catch (err) {
            console.error(`\nErro Item Nota ${i.COM_NUMERO} Seq ${i.ICP_NUMERO}:`, err.message);
        }
    }
    console.log(`\n> ${count} itens e impostos migrados.`);
}

run();
