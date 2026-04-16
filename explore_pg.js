const { Client } = require('pg');
const fs = require('fs');

async function explore() {
    const client = new Client({
        user: 'postgres',
        host: '127.0.0.1',
        database: 'control',
        password: '',
        port: 5432,
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT tablename 
            FROM pg_catalog.pg_tables 
            WHERE schemaname = 'public';
        `);

        const tables = res.rows.map(r => r.tablename);
        
        const relevantTables = tables.filter(t => 
            t === 'produtos' || 
            t.includes('forneced') || 
            t.includes('credores') || 
            t.includes('clie') ||
            t.includes('produto')
        );

        let output = "Tabelas relevantes no PG:\n" + relevantTables.join('\n') + "\n\n";

        for (const table of relevantTables) {
            if (['produtos', 'fornecedores', 'credores', 'fornecedor', 'clientes_fornecedores', 'produto_fornecedor'].includes(table) || table.includes('fornec')) {
                const colsRes = await client.query(`
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = $1;
                `, [table]);
                output += `\nEstrutura de "${table}":\n`;
                colsRes.rows.forEach(c => output += `  - ${c.column_name} (${c.data_type})\n`);
            }
        }

        fs.writeFileSync('pg_structure.txt', output);
        console.log("Salvo em pg_structure.txt");

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

explore();
