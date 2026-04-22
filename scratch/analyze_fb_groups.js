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
        console.error("Erro ao conectar ao Firebird:", err);
        return;
    }

    console.log("Conectado. Analisando classificações...");

    // 1. Ver estrutura de GRUPOSPRO
    db.query("SELECT RDB$FIELD_NAME FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME = 'GRUPOSPRO'", (err, cols) => {
        if (!err) {
            console.log("\n--- Colunas em GRUPOSPRO ---");
            console.log(cols.map(c => c.RDB$FIELD_NAME.trim()).join(', '));
            
            // 2. Ver dados de GRUPOSPRO
            db.query("SELECT FIRST 10 * FROM GRUPOSPRO", (err, data) => {
                if (!err) {
                    console.log("\n--- Exemplos em GRUPOSPRO ---");
                    console.table(data);
                }
            });
        }
    });

    // 3. Ver se existe alguma outra tabela com 'SUB'
    db.query("SELECT RDB$RELATION_NAME FROM RDB$RELATIONS WHERE RDB$RELATION_NAME LIKE '%SUB%'", (err, tables) => {
        if (!err) {
            console.log("\n--- Tabelas com 'SUB' ---");
            console.log(tables.map(t => t.RDB$RELATION_NAME.trim()).join(', '));
        }
    });

    // 4. Ver exemplos de classificação nos PRODUTOS
    db.query("SELECT FIRST 10 PRO_CODIGO, PRO_DESCRICAO, GRU_CODIGO FROM PRODUTOS WHERE GRU_CODIGO IS NOT NULL", (err, data) => {
        if (!err) {
            console.log("\n--- Classificação nos PRODUTOS (Exemplos) ---");
            console.table(data);
        }
    });

    // Fechar após 5 segundos para dar tempo das queries rodarem (ou usar Promises)
    setTimeout(() => db.detach(), 3000);
});
