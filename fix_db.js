const { Client } = require('pg');
const pgClient = new Client({
    user: 'postgres', host: '127.0.0.1', database: 'control', password: '', port: 5432
});

pgClient.connect().then(async () => {
    try {
        await pgClient.query('ALTER TABLE produtos ALTER COLUMN codigo TYPE bigint CASCADE');
        await pgClient.query('ALTER TABLE fornecedores ALTER COLUMN codigo TYPE bigint CASCADE');
        console.log("Tipos alterados para bigint com sucesso.");
    } catch(e) { 
        console.error("Erro alterando tipos:", e.message); 
    }

    try {
        const fkRes = await pgClient.query(`
            SELECT
                tc.constraint_name,
                tc.table_name, 
                kcu.column_name, 
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name 
            FROM 
                information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='fornecedores';
        `);
        console.log("\nFornecedores Foreign Keys:");
        console.log(fkRes.rows);
    } catch(e) {
        console.error("Erro consultando FKs:", e.message);
    }
    
    pgClient.end();
});
