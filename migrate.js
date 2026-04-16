require('dotenv').config();
const firebird = require('node-firebird');
const { Client } = require('pg');

const fbOptions = {
    host: process.env.FB_HOST || '127.0.0.1',
    port: parseInt(process.env.FB_PORT || '3050'),
    database: process.env.FB_DATABASE || 'C:\\DATABASES\\DADOS.FDB',
    user: process.env.FB_USER || 'SYSDBA',
    password: process.env.FB_PASS || 'masterkey',
    lowercase_keys: false,
    role: null,
    pageSize: 4096
};

const pgClient = new Client({
    user: process.env.PG_USER || 'postgres',
    host: process.env.PG_HOST || '127.0.0.1',
    database: process.env.PG_DATABASE || 'control',
    password: process.env.PG_PASS || '',
    port: parseInt(process.env.PG_PORT || '5432'),
});

async function run() {
    console.log("Iniciando migração de dados...");
    
    await pgClient.connect();
    console.log("Conectado ao PostgreSQL.");

    firebird.attach(fbOptions, async (err, fbDb) => {
        if (err) {
            console.error("Erro no Firebird:", err);
            process.exit(1);
        }
        
        console.log("Conectado ao Firebird.");

        try {
            // Desabilita checagens de constraint de FK na sessão atual do PG para evitar erro $2 (cep)
            await pgClient.query("SET session_replication_role = replica;");
            
            const produtoIdMap = {}; // Guarda de -> para dos códigos
            await migrateFornecedores(fbDb, pgClient);
            await migrateProdutos(fbDb, pgClient, produtoIdMap);
            await migrateVinculos(fbDb, pgClient, produtoIdMap);
            
            await pgClient.query("SET session_replication_role = default;");
            console.log("\n✅ Migração concluída com sucesso!");
        } catch (e) {
            console.error("Erro durante a migração:", e);
        } finally {
            fbDb.detach();
            await pgClient.end();
            process.exit(0);
        }
    });
}

function getFbData(fbDb, query) {
    return new Promise((resolve, reject) => {
        fbDb.query(query, (err, result) => {
            if (err) return reject(err);
            resolve(result);
        });
    });
}

async function migrateFornecedores(fbDb, pgClient) {
    console.log("\n> Extraindo Fornecedores...");
    const credores = await getFbData(fbDb, `SELECT * FROM CREDORES`);
    console.log(`Encontrados ${credores.length} fornecedores no Firebird. (Iniciando upsert)`);

    let inseridos = 0;
    for (const c of credores) {
        try {
            const codigo = c.CRE_CODIGO;
            const nome = c.CRE_NOME ? c.CRE_NOME.toString().trim() : null;
            const fantasia = c.CRE_FANTASIA ? c.CRE_FANTASIA.toString().trim() : null;
            const cnpj = c.CRE_CNPJ ? c.CRE_CNPJ.toString().trim() : null;
            const endereco = c.CRE_ENDERECO ? c.CRE_ENDERECO.toString().trim() : null;
            const bairro = c.CRE_BAIRRO ? c.CRE_BAIRRO.toString().trim() : null;
            const cep = c.CRE_CEP ? c.CRE_CEP.toString().trim() : null;
            const fone = c.CRE_FONE ? c.CRE_FONE.toString().trim() : null;

            const query = `
                INSERT INTO fornecedores (codigo, nome, fantasia, cnpj, endereco, bairro, cep, fone)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (codigo) DO UPDATE SET 
                    nome = EXCLUDED.nome,
                    fantasia = EXCLUDED.fantasia,
                    cnpj = EXCLUDED.cnpj,
                    endereco = EXCLUDED.endereco,
                    bairro = EXCLUDED.bairro,
                    cep = EXCLUDED.cep,
                    fone = EXCLUDED.fone
            `;
            await pgClient.query(query, [codigo, nome, fantasia, cnpj, endereco, bairro, cep, fone]);
            inseridos++;
            if (inseridos % 100 === 0) process.stdout.write('.');
        } catch (err) {
            console.error(`\nErro Fornecedor cod ${c.CRE_CODIGO}:`, err.message);
        }
    }
    console.log(`\n> ${inseridos} Fornecedores migrados/atualizados!`);
}

async function migrateProdutos(fbDb, pgClient, idMap) {
    console.log("\n> Extraindo Produtos...");
    const produtos = await getFbData(fbDb, `SELECT * FROM PRODUTOS`);
    console.log(`Encontrados ${produtos.length} produtos no Firebird. (Iniciando upsert)`);

    // Pegamos qual é o max atual para caso precisemos gerar novos códigos
    const maxRes = await pgClient.query(`SELECT Coalesce(MAX(codigo), 0) as m FROM produtos`);
    let nextId = parseInt(maxRes.rows[0].m) + 1;
    if (nextId < 1000000) nextId = 1000000; // Joga pra uma margem segura

    let inseridos = 0;
    for (const p of produtos) {
        try {
            const oldCodigo = p.PRO_CODIGO ? p.PRO_CODIGO.toString().trim() : '';
            if (!oldCodigo) continue;

            let codigoStr = oldCodigo;
            // Verifica se é EAN grande ou letra (incompativel com INTEGER PG)
            let codigoNum = parseInt(codigoStr, 10);
            if (isNaN(codigoNum) || codigoNum > 2147483647) {
                codigoNum = nextId++;
            }
            idMap[oldCodigo] = codigoNum;

            const descricao = p.PRO_DESCRICAO ? p.PRO_DESCRICAO.toString().trim().substring(0, 100) : null;
            const unidade = p.PRO_UNIDADE ? p.PRO_UNIDADE.toString().trim().substring(0, 5) : null;
            const precocusto = p.PRO_PRCCUSTO || 0.0;
            const precovenda = p.PRO_MPRECO3 || p.PRO_PRECOST || p.PRO_PRCVENDALUCROZERO || 0.0; 
            const cod_ncm = p.PRO_NCM ? p.PRO_NCM.toString().trim().substring(0, 8) : null;
            
            // Se o PRO_CODIGO era barcode, salva no codbarra também!
            let codbarra = p.PRO_CODIGOBAR ? p.PRO_CODIGOBAR.toString().trim() : null;
            if (codigoNum !== parseInt(oldCodigo, 10)) {
                codbarra = oldCodigo.substring(0, 20); // salva o EAN / REF original
            }

            const query = `
                INSERT INTO produtos (codigo, descricao, unidade, precocusto, precovenda, cod_ncm, codbarra)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (codigo) DO UPDATE SET 
                    descricao = EXCLUDED.descricao,
                    unidade = EXCLUDED.unidade,
                    precocusto = EXCLUDED.precocusto,
                    precovenda = EXCLUDED.precovenda,
                    cod_ncm = EXCLUDED.cod_ncm,
                    codbarra = EXCLUDED.codbarra
            `;
            await pgClient.query(query, [codigoNum, descricao, unidade, precocusto, precovenda, cod_ncm, codbarra]);
            inseridos++;
            if (inseridos % 500 === 0) process.stdout.write('.');
        } catch (err) {
            console.error(`\nErro Produto cod ${p.PRO_CODIGO}:`, err.message);
        }
    }
    console.log(`\n> ${inseridos} Produtos migrados/atualizados!`);
}

async function migrateVinculos(fbDb, pgClient, idMap) {
    console.log("\n> Extraindo Vínculos (PROD_FORNEC)...");
    const vinculos = await getFbData(fbDb, `SELECT PRO_CODIGO, CRE_CODIGO FROM PROD_FORNEC`);
    console.log(`Encontrados ${vinculos.length} vínculos no Firebird.`);

    let inseridos = 0;
    for (const v of vinculos) {
        try {
            let cd_produto = v.PRO_CODIGO ? v.PRO_CODIGO.toString().trim() : null;
            const cd_fornecedor = v.CRE_CODIGO;
            
            // Usa o mapa para resgatar o código real no PG (se foi recalculado de EAN para INT)
            if (cd_produto && idMap[cd_produto]) {
                cd_produto = idMap[cd_produto];
            } else {
                cd_produto = parseInt(cd_produto, 10);
            }

            if (!cd_produto || !cd_fornecedor) continue;

            // Como no_fornecedor pode não ter um contraint de UNIQUE (cd_produto, cd_fornecedor) definido,
            // validamos primeiro se já existe para evitar erro de duplicates invisíveis ou inserção infinita
            const check = await pgClient.query(`
                SELECT 1 FROM no_fornecedor WHERE cd_produto = $1 AND cd_fornecedor = $2
            `, [cd_produto, cd_fornecedor]);

            if (check.rows.length === 0) {
                // Insere, sabendo que a sequence do código cuidará do ID ('codigo' SERIAL/IDENTITY)
                // Se o postgres não preencher o 'codigo' automaticamente, teremos que enviar o MAX+1. Vamos assumir que há default.
                
                // Pega MAX para garantir caso a tabela em PG não use autoincrement sequence nativa corretamente (comum em ERPs Delphi velhos)
                const pkRes = await pgClient.query(`SELECT Coalesce(MAX(codigo), 0) + 1 AS nx FROM no_fornecedor`);
                const nextCodigo = pkRes.rows[0].nx;

                await pgClient.query(`
                    INSERT INTO no_fornecedor (codigo, cd_produto, cd_fornecedor)
                    VALUES ($1, $2, $3)
                `, [nextCodigo, cd_produto, cd_fornecedor]);
                inseridos++;
            }
            if (inseridos % 100 === 0 && inseridos > 0) process.stdout.write('.');
        } catch (err) {
            console.error(`\nErro Vínculo PROD:${v.PRO_CODIGO}/FORN:${v.CRE_CODIGO} ->`, err.message);
        }
    }
    console.log(`\n> ${inseridos} Vínculos novos inseridos!`);
}

run();
