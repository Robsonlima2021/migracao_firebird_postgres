const firebird = require('node-firebird');

const options = {
    host: '127.0.0.1', port: 3050, database: 'C:\\DATABASES\\DADOS.FDB',
    user: 'SYSDBA', password: 'masterkey', lowercase_keys: false, role: null, pageSize: 4096
};

firebird.attach(options, (err, db) => {
    if (err) return console.error(err);

    const tables = ['PRODUTOS', 'CREDORES', 'PROD_FORNEC'];

    function queryTable(index) {
        if (index >= tables.length) {
            db.detach();
            return;
        }

        const table = tables[index];
        db.query(`SELECT FIRST 1 * FROM ${table}`, (err, res) => {
            console.log(`\n\n--- TABELA: ${table} ---`);
            if (err) {
                console.error("Erro:", err);
            } else if (res && res.length) {
                console.log("Campos encontrados:");
                console.log(Object.keys(res[0]).join(', '));
            } else {
                console.log("Tabela vazia.");
            }
            queryTable(index + 1);
        });
    }

    queryTable(0);
});
