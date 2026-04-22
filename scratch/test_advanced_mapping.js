const { Client } = require('pg');
const fs = require('fs');

async function testAdvancedMapping() {
    const client = new Client({
        user: 'postgres', host: '127.0.0.1', database: 'control', password: '', port: 5432
    });

    try {
        await client.connect();
        const csvPath = 'relatorio_compras.csv';
        const lines = fs.readFileSync(csvPath, 'utf8').split('\n').slice(1, 15);

        console.log('--- Testando Vínculo Avançado ---\n');

        for (let line of lines) {
            if (!line) continue;
            const parts = line.split(';');
            const cProd = parts[2];
            const xProd = parts[3];
            const cnpj = parts[8].replace(/\D/g, ''); // CNPJ Emitente

            // 1. Achar o fornecedor
            const resForn = await client.query('SELECT codigo, nome FROM fornecedores WHERE cnpj = $1', [cnpj]);
            
            if (resForn.rows.length === 0) {
                console.log(`❌ Fornecedor não encontrado p/ CNPJ: ${cnpj}`);
                continue;
            }

            const vendorId = resForn.rows[0].codigo;

            // 2. Achar o produto no de-para (no_fornecedor)
            const resMap = await client.query(
                'SELECT cd_produto FROM no_fornecedor WHERE cd_fornecedor = $1 AND no_fornecedor = $2',
                [vendorId, cProd]
            );

            if (resMap.rows.length > 0) {
                const prodId = resMap.rows[0].cd_produto;
                const resProd = await client.query('SELECT descricao FROM produtos WHERE codigo = $1', [prodId]);
                console.log(`✅ VÍNCULO OK: XML[${cProd}] -> DB[${prodId}] - ${resProd.rows[0]?.descricao}`);
            } else {
                console.log(`⚠️ SEM VÍNCULO: [${cProd}] ${xProd.substring(0, 20)}... (Fornecedor ${vendorId})`);
            }
        }

    } catch (err) {
        console.error('Erro:', err);
    } finally {
        await client.end();
    }
}

testAdvancedMapping();
