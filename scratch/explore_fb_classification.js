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

    console.log("Conectado ao Firebird. Explorando tabelas...");

    // 1. Listar todas as tabelas
    db.query("SELECT RDB$RELATION_NAME FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG = 0", (err, tables) => {
        if (err) {
            console.error("Erro ao listar tabelas:", err);
            db.detach();
            return;
        }

        console.log("--- Tabelas no Firebird ---");
        const tableNames = tables.map(t => t.RDB$RELATION_NAME.trim());
        console.log(tableNames.join(', '));

        // 2. Tentar encontrar tabelas de Grupos e Subgrupos
        const groupsTables = tableNames.filter(t => t.includes('GRU') || t.includes('SEC'));
        console.log("\nPossíveis tabelas de classificação:", groupsTables);

        // 3. Explorar colunas da tabela PRODUTOS
        db.query("SELECT RDB$FIELD_NAME FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME = 'PRODUTOS'", (err, cols) => {
            if (err) {
                console.error("Erro ao listar colunas de PRODUTOS:", err);
                db.detach();
                return;
            }

            console.log("\n--- Colunas em PRODUTOS ---");
            const colNames = cols.map(c => c.RDB$FIELD_NAME.trim());
            console.log(colNames.join(', '));

            // Procurar campos que pareçam com grupo/seção
            const classificationCols = colNames.filter(c => c.includes('GRU') || c.includes('SEC') || c.includes('CLA'));
            console.log("\nCampos de classificação em PRODUTOS:", classificationCols);

            db.detach();
        });
    });
});
