const { Client } = require('pg');

async function checkConstraints() {
    const client = new Client({
        user: 'postgres', host: '127.0.0.1', database: 'control', password: '', port: 5432
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT
                conname AS constraint_name,
                pg_get_constraintdef(c.oid) AS constraint_definition
            FROM
                pg_constraint c
            JOIN
                pg_class t ON c.conrelid = t.oid
            WHERE
                t.relname = 'produtos';
        `);
        console.log('--- Constraints on PRODUTOS ---');
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkConstraints();
