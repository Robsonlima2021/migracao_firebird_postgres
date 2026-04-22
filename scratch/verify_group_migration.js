const { Client } = require('pg');

async function verifyMigration() {
    const client = new Client({
        user: 'postgres', host: '127.0.0.1', database: 'control', password: '', port: 5432
    });

    try {
        await client.connect();
        
        console.log('--- Grupos Migrados ---');
        const grupos = await client.query('SELECT * FROM grupo_produtos LIMIT 5');
        console.table(grupos.rows);

        console.log('--- Subgrupos Migrados ---');
        const subgrupos = await client.query('SELECT * FROM subgrupo_produtos LIMIT 5');
        console.table(subgrupos.rows);

        console.log('--- Amostra de Produtos e Classificação ---');
        const res = await client.query(`
            SELECT p.codigo, p.descricao, g.nome as grupo_nome, s.nome as subgrupo_nome
            FROM produtos p
            LEFT JOIN grupo_produtos g ON p.grupo = g.codigo
            LEFT JOIN subgrupo_produtos s ON p.subgrupo = s.codigo
            WHERE p.subgrupo IS NOT NULL
            LIMIT 10
        `);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

verifyMigration();
