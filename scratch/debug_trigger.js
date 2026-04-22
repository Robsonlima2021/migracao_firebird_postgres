const { Client } = require('pg');

async function debugTrigger() {
    const client = new Client({
        user: 'postgres', host: '127.0.0.1', database: 'control', password: '', port: 5432
    });

    try {
        await client.connect();
        
        console.log('--- Investigando Função "data_alterado" ---\n');
        
        const res = await client.query(
            "SELECT prosrc FROM pg_proc WHERE proname = 'data_alterado'"
        );
        
        if (res.rows.length > 0) {
            console.log(res.rows[0].prosrc);
        } else {
            console.log('Função não encontrada. Verificando gatilhos da tabela produtos...');
            const resTrig = await client.query(`
                SELECT tgname, proname 
                FROM pg_trigger 
                JOIN pg_proc ON pg_proc.oid = pg_trigger.tgfoid 
                WHERE tgrelid = 'produtos'::regclass
            `);
            console.table(resTrig.rows);
        }

        console.log('\n--- Verificando CFOPs de alguns produtos com erro ---');
        const resCfop = await client.query(`
            SELECT codigo, descricao, cfop_venda, cfop_compra 
            FROM produtos 
            WHERE codigo IN (1015952, 1004385, 1023156)
        `);
        console.table(resCfop.rows);

    } catch (err) {
        console.error('Erro:', err);
    } finally {
        await client.end();
    }
}

debugTrigger();
