const { Client } = require('pg');

async function checkNullability() {
    const client = new Client({
        user: 'postgres', host: '127.0.0.1', database: 'control', password: '', port: 5432
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT column_name, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'produtos' 
            AND column_name IN ('unidade', 'descricao', 'precocusto', 'precovenda');
        `);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkNullability();
