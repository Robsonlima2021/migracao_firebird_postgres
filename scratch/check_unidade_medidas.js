const { Client } = require('pg');

async function checkUnidadeMedidas() {
    const client = new Client({
        user: 'postgres', host: '127.0.0.1', database: 'control', password: '', port: 5432
    });

    try {
        await client.connect();
        const res = await client.query('SELECT unidade, descricao FROM unidade_medidas');
        console.log('--- Unidades Permitidas ---');
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkUnidadeMedidas();
