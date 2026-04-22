const { Client } = require('pg');

async function checkUnidades() {
    const client = new Client({
        user: 'postgres', host: '127.0.0.1', database: 'control', password: '', port: 5432
    });

    try {
        await client.connect();
        const structure = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'unidades';
        `);
        console.log('--- Estrutura de UNIDADES ---');
        console.table(structure.rows);

        const res = await client.query('SELECT * FROM unidades');
        console.log('--- Valores em UNIDADES ---');
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkUnidades();
