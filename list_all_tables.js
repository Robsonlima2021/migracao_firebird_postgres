const firebird = require('node-firebird');
const fs = require('fs');

const options = {
    host: '127.0.0.1', port: 3050, database: 'C:\\DATABASES\\DADOS.FDB',
    user: 'SYSDBA', password: 'masterkey', lowercase_keys: false, role: null, pageSize: 4096
};

firebird.attach(options, (err, db) => {
    if (err) return console.error(err);

    const sql = `
        SELECT RDB$RELATION_NAME
        FROM RDB$RELATIONS
        WHERE RDB$VIEW_BLR IS NULL
        AND (RDB$SYSTEM_FLAG IS NULL OR RDB$SYSTEM_FLAG = 0)
        ORDER BY RDB$RELATION_NAME;
    `;

    db.query(sql, (err, result) => {
        if (err) console.error(err);
        else {
            const tables = result.map(t => t['RDB$RELATION_NAME'].trim());
            fs.writeFileSync('tables.json', JSON.stringify(tables, null, 2));
            console.log('Saved to tables.json');
        }
        db.detach();
    });
});
