const { Client } = require('pg');
const pgClient = new Client({ user: 'postgres', host: '127.0.0.1', database: 'control', port: 5432 });

pgClient.connect().then(async () => {
    const fkRes = await pgClient.query(`
        SELECT pg_get_constraintdef(c.oid) AS def
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'fornecedores' AND c.conname = '$2';
    `);
    console.log("Definição de $2:", fkRes.rows[0]?.def);

    const cols = await pgClient.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'clientes';
    `);
    console.log("Estrutura de clientes:");
    cols.rows.forEach(c => console.log(`  - ${c.column_name} (${c.data_type})`));

    pgClient.end();
});
