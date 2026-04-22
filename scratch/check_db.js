require('dotenv').config();
const { Client } = require('pg');

async function checkTable() {
    const client = new Client({
    user: process.env.PG_USER || 'postgres',
    host: '127.0.0.1',
    database: process.env.PG_DATABASE || 'control',
    password: process.env.PG_PASS || '',
    port: parseInt(process.env.PG_PORT || '5432'),
  });

  try {
    await client.connect();
    
    const tables = ['produtos_ultima_compra', 'produtos', 'fornecedores'];
    
    for (const table of tables) {
        const res = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = $1
          ORDER BY ordinal_position;
        `, [table]);
        
        console.log(`\n--- Estrutura de "${table}": ---`);
        res.rows.forEach(row => {
          console.log(`${row.column_name} (${row.data_type})`);
        });
    }

  } catch (err) {
    console.error('Error connecting to PG:', err);
  } finally {
    await client.end();
  }
}

checkTable();
