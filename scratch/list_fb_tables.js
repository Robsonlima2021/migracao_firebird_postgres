const firebird = require('node-firebird');
const fs = require('fs');

const fbOptions = {
    host: '127.0.0.1',
    port: 3050,
    database: 'C:\\DATABASES\\DADOS.FDB',
    user: 'SYSDBA',
    password: 'masterkey',
    lowercase_keys: false,
    role: null,
    pageSize: 4096
};

firebird.attach(fbOptions, (err, db) => {
    if (err) {
        console.error("Erro:", err);
        return;
    }

    db.query("SELECT RDB$RELATION_NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0", (err, tables) => {
        if (!err) {
            const tableNames = tables.map(t => t.RDB$RELATION_NAME.trim()).sort();
            fs.writeFileSync('fb_tables.txt', tableNames.join('\n'));
            console.log("Salvo em fb_tables.txt");
        }
        db.detach();
    });
});
