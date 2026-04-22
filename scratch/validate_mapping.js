const { Client } = require('pg');
const fs = require('fs');

async function validateMapping() {
    const client = new Client({
        user: 'postgres',
        host: '127.0.0.1',
        database: 'control',
        password: '',
        port: 5432
    });

    try {
        await client.connect();
        const csvPath = 'relatorio_compras.csv';
        if (!fs.existsSync(csvPath)) {
            console.error('Arquivo relatorio_compras.csv não encontrado.');
            return;
        }

        const lines = fs.readFileSync(csvPath, 'utf8').split('\n').slice(1, 15); // Pega as primeiras 15 linhas
        console.log('Buscando códigos do CSV no banco...\n');

        for (let line of lines) {
            if (!line) continue;
            const parts = line.split(';');
            const cProd = parts[2];
            const xProd = parts[3];

            // Busca por codigodefabrica ou codbarra
            const res = await client.query(
                'SELECT codigo, descricao, precocusto FROM produtos WHERE codigodefabrica = $1 OR codbarra = $1 LIMIT 1',
                [cProd]
            );

            if (res.rows.length > 0) {
                console.log(`✅ ENCONTRADO: [${cProd}] ${xProd.substring(0, 30)}... -> DB: [${res.rows[0].codigo}] ${res.rows[0].descricao.substring(0, 30)}`);
            } else {
                console.log(`❌ NÃO ENCONTRADO: [${cProd}] ${xProd.substring(0, 30)}...`);
            }
        }

    } catch (err) {
        console.error('Erro:', err);
    } finally {
        await client.end();
    }
}

validateMapping();
