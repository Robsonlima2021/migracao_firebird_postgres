const firebird = require('node-firebird');
require('dotenv').config();

const fbOptions = {
    host: process.env.FB_HOST || '127.0.0.1',
    port: parseInt(process.env.FB_PORT || '3050'),
    database: process.env.FB_DATABASE || 'C:\\DATABASES\\DADOS.FDB',
    user: process.env.FB_USER || 'SYSDBA',
    password: process.env.FB_PASS || 'masterkey',
    lowercase_keys: false
};

firebird.attach(fbOptions, (err, db) => {
    if (err) throw err;

    const tables = ['COMPRAS', 'ITENSCOM', 'NOTASFISCAIS', 'NATUREZASFISCAIS'];
    
    async function describeTable(tableName) {
        return new Promise((resolve, reject) => {
            // No Firebird, pegamos metadados de RDB$RELATION_FIELDS
            const query = `
                SELECT 
                    RF.RDB$FIELD_NAME AS FIELD_NAME,
                    F.RDB$FIELD_TYPE AS FIELD_TYPE,
                    F.RDB$FIELD_LENGTH AS FIELD_LENGTH
                FROM RDB$RELATION_FIELDS RF
                JOIN RDB$FIELDS F ON RF.RDB$FIELD_SOURCE = F.RDB$FIELD_NAME
                WHERE RF.RDB$RELATION_NAME = '${tableName}'
                ORDER BY RF.RDB$FIELD_POSITION
            `;
            db.query(query, (err, result) => {
                if (err) reject(err);
                console.log(`\n--- Tabela: ${tableName} ---`);
                result.forEach(row => {
                    console.log(`${row.FIELD_NAME.trim()}`);
                });
                resolve();
            });
        });
    }

    async function run() {
        for (const t of tables) {
            await describeTable(t);
        }
        db.detach();
    }

    run().catch(console.error);
});
