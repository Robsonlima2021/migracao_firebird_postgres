const { Client } = require('pg');
const fs = require('fs');

async function generateMapping() {
    const client = new Client({
        user: 'postgres', host: '127.0.0.1', database: 'control', password: '', port: 5432
    });

    try {
        await client.connect();
        const csvPath = 'relatorio_compras.csv';
        if (!fs.existsSync(csvPath)) {
            console.error('Relatório de compras não encontrado.');
            return;
        }

        const lines = fs.readFileSync(csvPath, 'utf8').split('\n');
        const header = lines[0];
        const dataLines = lines.slice(1);

        // Agrupar produtos únicos do XML para não repetir no mapeamento
        const uniqueProducts = new Map();
        for (let line of dataLines) {
            if (!line.trim()) continue;
            const p = line.split(';');
            const key = `${p[8]}_${p[2]}`; // CNPJ + cProd
            if (!uniqueProducts.has(key)) {
                uniqueProducts.set(key, {
                    cnpj: p[8],
                    fornecedor: p[9],
                    cProd: p[2],
                    xProd: p[3]
                });
            }
        }

        console.log(`Processando ${uniqueProducts.size} produtos únicos para mapeamento...`);

        let csvOutput = 'cnpj_fornecedor;nome_fornecedor;cod_produto_xml;descricao_produto_xml;id_sistema_sugerido;descricao_sistema_sugerida;CONFIRMAR_ID_SISTEMA\n';

        let count = 0;
        for (let [key, prod] of uniqueProducts) {
            count++;
            if (count % 50 === 0) console.log(`Progresso: ${count}/${uniqueProducts.size}...`);

            // Tentar busca automática
            // 1. Por código exato (muito improvável mas tentamos)
            let res = await client.query(
                "SELECT codigo, descricao FROM produtos WHERE codigodefabrica = $1 OR codbarra = $1 LIMIT 1",
                [prod.cProd]
            );

            // 2. Por nome aproximado se não achar por código
            if (res.rows.length === 0) {
                const searchName = prod.xProd.substring(0, 20).trim();
                res = await client.query(
                    "SELECT codigo, descricao FROM produtos WHERE descricao ILIKE $1 ORDER BY char_length(descricao) ASC LIMIT 1",
                    [`%${searchName}%`]
                );
            }

            const sugId = res.rows.length > 0 ? res.rows[0].codigo : '';
            const sugDesc = res.rows.length > 0 ? res.rows[0].descricao : '';

            // Escapar ponto e vírgula se houver na descrição
            const xProdClean = prod.xProd.replace(/;/g, ' ');
            const sugDescClean = sugDesc.replace(/;/g, ' ');

            csvOutput += `${prod.cnpj};${prod.fornecedor};${prod.cProd};${xProdClean};${sugId};${sugDescClean};${sugId}\n`;
        }

        fs.writeFileSync('mapeamento_produtos.csv', '\ufeff' + csvOutput, 'utf8'); // BOM para Excel abrir correto
        console.log('\n✅ Arquivo "mapeamento_produtos.csv" gerado com sucesso!');

    } catch (err) {
        console.error('Erro:', err);
    } finally {
        await client.end();
    }
}

generateMapping();
