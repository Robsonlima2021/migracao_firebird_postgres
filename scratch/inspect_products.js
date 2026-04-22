const { Client } = require('pg');

async function inspectProducts() {
    const client = new Client({
        user: 'postgres', host: '127.0.0.1', database: 'control', password: '', port: 5432
    });

    try {
        await client.connect();
        
        console.log('--- Amostra de Produtos no Banco ---\n');
        
        const res = await client.query(
            "SELECT codigo, codigodefabrica, codbarra, descricao, precocusto FROM produtos ORDER BY codigo DESC LIMIT 20"
        );
        
        console.table(res.rows);

        console.log('\n--- Buscando especificamente por "POLO" ---');
        const resPolo = await client.query(
            "SELECT codigo, codigodefabrica, codbarra, descricao FROM produtos WHERE descricao ILIKE '%POLO%' LIMIT 10"
        );
        console.table(resPolo.rows);

    } catch (err) {
        console.error('Erro:', err);
    } finally {
        await client.end();
    }
}

inspectProducts();
