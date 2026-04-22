const { Client } = require('pg');

async function researchSystemFunctions() {
    const client = new Client({
        user: 'postgres', host: '127.0.0.1', database: 'control', password: '', port: 5432
    });

    try {
        await client.connect();
        
        console.log('--- Investigando Função "get_usuario" ---\n');
        const res = await client.query(
            "SELECT prosrc FROM pg_proc WHERE proname = 'get_usuario'"
        );
        if (res.rows.length > 0) {
            console.log(res.rows[0].prosrc);
        }

        console.log('\n--- Investigando "validadadosinclusaocfopcst" ---\n');
        const resVal = await client.query(
            "SELECT prosrc FROM pg_proc WHERE proname = 'validadadosinclusaocfopcst'"
        );
        if (resVal.rows.length > 0) {
            console.log(resVal.rows[0].prosrc);
        }

        console.log('\n--- Verificando Variáveis de Sessão Atuais ---');
        const resVars = await client.query("SELECT name, setting FROM pg_settings WHERE name LIKE 'arpa%'");
        console.table(resVars.rows);

    } catch (err) {
        console.error('Erro:', err);
    } finally {
        await client.end();
    }
}

researchSystemFunctions();
