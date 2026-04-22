const { Client } = require('pg');
const fs = require('fs');

async function testNameMapping() {
    const client = new Client({
        user: 'postgres', host: '127.0.0.1', database: 'control', password: '', port: 5432
    });

    try {
        await client.connect();
        const csvPath = 'relatorio_compras.csv';
        const lines = fs.readFileSync(csvPath, 'utf8').split('\n').slice(1, 40); // Verifica 40 itens

        console.log('--- Testando Busca por Nome (Descrição) ---\n');

        let matches = 0;
        let total = 0;

        for (let line of lines) {
            if (!line) continue;
            total++;
            const parts = line.split(';');
            const xProd = parts[3];

            // Busca por nome aproximado (ILIKE)
            // Usamos os primeiros 20 caracteres para evitar divergências no final do nome
            const searchName = xProd.substring(0, 20).trim();
            const res = await client.query(
                "SELECT codigo, descricao FROM produtos WHERE descricao ILIKE $1 LIMIT 1",
                [`%${searchName}%`]
            );

            if (res.rows.length > 0) {
                matches++;
                console.log(`✅ MATCH: [XML] ${xProd.substring(0, 30)}... -> [DB] ${res.rows[0].descricao.substring(0, 30)}`);
            } else {
                console.log(`❌ SEM MATCH: ${xProd.substring(0, 30)}`);
            }
        }
        
        console.log(`\nResultado: ${matches} de ${total} produtos encontrados por nome.`);

    } catch (err) {
        console.error('Erro:', err);
    } finally {
        await client.end();
    }
}

testNameMapping();
