const firebird = require('node-firebird');

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

    // 1. Verificar colunas de SECCAO
    db.query("SELECT RDB$FIELD_NAME FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME = 'SECCAO'", (err, cols) => {
        if (!err) {
            console.log("\n--- Colunas em SECCAO ---");
            console.log(cols.map(c => c.RDB$FIELD_NAME.trim()).join(', '));
        }
    });

    // 2. Verificar se PRODUTOS tem SEC_CODIGO ou similar
    db.query("SELECT RDB$FIELD_NAME FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME = 'PRODUTOS' AND (RDB$FIELD_NAME LIKE '%SEC%' OR RDB$FIELD_NAME LIKE '%SUB%')", (err, cols) => {
        if (!err) {
            console.log("\n--- Colunas de SEC/SUB em PRODUTOS ---");
            console.log(cols.map(c => c.RDB$FIELD_NAME.trim()).join(', '));
        }
    });

    // 3. Verificar relação em GRUPOSPRO (se tem SEC_CODIGO ou PAI)
    db.query("SELECT RDB$FIELD_NAME FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME = 'GRUPOSPRO' AND (RDB$FIELD_NAME LIKE '%SEC%' OR RDB$FIELD_NAME LIKE '%GRU%')", (err, cols) => {
        if (!err) {
            console.log("\n--- Colunas de SEC/GRU em GRUPOSPRO ---");
            console.log(cols.map(c => c.RDB$FIELD_NAME.trim()).join(', '));
        }
    });

    setTimeout(() => db.detach(), 3000);
});
