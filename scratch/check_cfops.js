const { Client } = require('pg');

async function checkCfops() {
    const client = new Client({
        user: 'postgres', host: '127.0.0.1', database: 'control', password: '', port: 5432
    });

    try {
        await client.connect();
        
        console.log('--- Analisando CFOPs mais comuns no banco ---\n');
        
        const res = await client.query(`
            SELECT cfop_compra, cfop_venda, COUNT(*) 
            FROM produtos 
            WHERE cfop_compra > 0 OR cfop_venda > 0
            GROUP BY cfop_compra, cfop_venda 
            ORDER BY count DESC 
            LIMIT 15
        `);
        
        console.table(res.rows);

    } catch (err) {
        console.error('Erro:', err);
    } finally {
        await client.end();
    }
}

checkCfops();
