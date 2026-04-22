const firebird = require('node-firebird');

const options = {
    host: '127.0.0.1', port: 3050, database: 'C:\\DATABASES\\DADOS.FDB',
    user: 'SYSDBA', password: 'masterkey', lowercase_keys: false, role: null, pageSize: 4096
};

firebird.attach(options, (err, db) => {
    if (err) return console.error(err);

    db.query(`SELECT FIRST 5 CLI_CODIGO, CLI_NOME, CLI_CPF_CNPJ FROM CLIENTES WHERE CLI_CPF_CNPJ IS NOT NULL`, (err, res) => {
        if (!err && res && res.length) {
            console.log("Campos em CLIENTES (Firebird):");
            console.log(res);
        } else {
            console.log("Erro ou vazio:", err);
        }
        db.detach();
    });
});
