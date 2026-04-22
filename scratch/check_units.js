const { Client } = require('pg');

async function checkUnit() {
    const client = new Client({
        user: 'postgres', host: '127.0.0.1', database: 'control', password: '', port: 5432
    });

    try {
        await client.connect();
        const res = await client.query('SELECT codigo, descricao, unidade FROM produtos LIMIT 5');
        console.log('--- Unidades atuais ---');
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkUnit();
