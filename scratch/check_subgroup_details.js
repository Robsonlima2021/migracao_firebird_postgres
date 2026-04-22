const { Client } = require('pg');

async function checkSubgroup() {
    const client = new Client({
        user: 'postgres', host: '127.0.0.1', database: 'control', password: '', port: 5432
    });

    try {
        await client.connect();
        
        const cols = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'subgrupo_produtos'
        `);
        console.log('--- Colunas de subgrupo_produtos ---');
        console.table(cols.rows);

        const constraints = await client.query(`
            SELECT
                conname AS constraint_name,
                pg_get_constraintdef(c.oid) AS constraint_definition
            FROM
                pg_constraint c
            JOIN
                pg_class t ON c.conrelid = t.oid
            WHERE
                t.relname = 'subgrupo_produtos';
        `);
        console.log('--- Constraints de subgrupo_produtos ---');
        console.table(constraints.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkSubgroup();
