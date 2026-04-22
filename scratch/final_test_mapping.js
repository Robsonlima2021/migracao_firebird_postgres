const { Client } = require('pg');
const fs = require('fs');

async function finalTest() {
    const client = new Client({
        user: 'postgres', host: '127.0.0.1', database: 'control', password: '', port: 5432
    });

    try {
        await client.connect();
        const csvPath = 'relatorio_compras.csv';
        const lines = fs.readFileSync(csvPath, 'utf8').split('\n').slice(1, 20);

        console.log('--- Teste de Vínculo Final (Tratando CNPJ) ---\n');

        for (let line of lines) {
            if (!line) continue;
            const parts = line.split(';');
            const cProd = parts[2];
            const xProd = parts[3];
            let cnpjXml = parts[8].replace(/\D/g, '').padStart(14, '0');

            // Busca fornecedor limpando o campo do banco também
            const resForn = await client.query(
                "SELECT codigo, nome FROM fornecedores WHERE regexp_replace(cnpj, '[^0-9]', '', 'g') = $1", 
                [cnpjXml]
            );
            
            if (resForn.rows.length === 0) {
                console.log(`❌ Fornecedor não encontrado: ${cnpjXml} (${parts[9]})`);
                continue;
            }

            const vendorId = resForn.rows[0].codigo;

            // Busca o produto no de-para
            const resMap = await client.query(
                'SELECT cd_produto FROM no_fornecedor WHERE cd_fornecedor = $1 AND no_fornecedor = $2',
                [vendorId, cProd]
            );

            if (resMap.rows.length > 0) {
                const prodId = resMap.rows[0].cd_produto;
                const resProd = await client.query('SELECT descricao, precocusto FROM produtos WHERE codigo = $1', [prodId]);
                console.log(`✅ VÍNCULO OK: XML[${cProd}] -> DB[ID:${prodId}] ${resProd.rows[0].descricao} | Atual: ${resProd.rows[0].precocusto}`);
            } else {
                console.log(`⚠️ SEM VÍNCULO: [${cProd}] ${xProd.substring(0, 20)}... (Forn: ${resForn.rows[0].nome})`);
            }
        }

    } catch (err) {
        console.error('Erro:', err);
    } finally {
        await client.end();
    }
}

finalTest();
