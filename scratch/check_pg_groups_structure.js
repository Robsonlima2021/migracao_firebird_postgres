const { Client } = require('pg');

async function checkStructures() {
    const client = new Client({
        user: 'postgres', host: '127.0.0.1', database: 'control', password: '', port: 5432
    });

    try {
        await client.connect();
        
        for (const table of ['grupo_produtos', 'subgrupo_produtos']) {
            const res = await client.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = $1
            `, [table]);
            console.log(`--- Estrutura de ${table} ---`);
            console.table(res.rows);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkStructures();
