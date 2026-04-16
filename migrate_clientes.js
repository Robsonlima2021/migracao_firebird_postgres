require('dotenv').config();
const firebird = require('node-firebird');
const { Client } = require('pg');

const fbOptions = {
    host: process.env.FB_HOST || '127.0.0.1',
    port: parseInt(process.env.FB_PORT || '3050'),
    database: process.env.FB_DATABASE || 'C:\\DATABASES\\DADOS.FDB',
    user: process.env.FB_USER || 'SYSDBA',
    password: process.env.FB_PASS || 'masterkey',
    lowercase_keys: false,
    role: null,
    pageSize: 4096
};

const pgClient = new Client({
    user: process.env.PG_USER || 'postgres',
    host: process.env.PG_HOST || '127.0.0.1',
    database: process.env.PG_DATABASE || 'control',
    password: process.env.PG_PASS || '',
    port: parseInt(process.env.PG_PORT || '5432'),
});

async function run() {
    console.log("Iniciando migração de Clientes...");
    await pgClient.connect();

    firebird.attach(fbOptions, async (err, fbDb) => {
        if (err) {
            console.error("Erro no Firebird:", err);
            process.exit(1);
        }
        
        try {
            await pgClient.query("SET session_replication_role = replica;");
            
            console.log("\n> Extraindo Clientes...");
            const clientes = await new Promise((res, rej) => {
                fbDb.query(`SELECT * FROM CLIENTES`, (err, result) => {
                    if (err) return rej(err);
                    res(result);
                });
            });
            console.log(`Encontrados ${clientes.length} clientes no Firebird. (Iniciando upsert)`);

            let inseridos = 0;
            for (const c of clientes) {
                try {
                    const codigo = c.CLI_CODIGO;
                    const nome = c.CLI_NOME ? c.CLI_NOME.toString().trim() : '';
                    const fantasia = c.CLI_FANTASIA ? c.CLI_FANTASIA.toString().trim() : '';
                    const cpf_cnpj = c.CLI_CPF_CNPJ ? c.CLI_CPF_CNPJ.toString().trim() : '';
                    const endereco = c.CLI_ENDERECO ? c.CLI_ENDERECO.toString().trim() : '';
                    const bairro = c.CLI_BAIRRO ? c.CLI_BAIRRO.toString().trim() : '';
                    const cep = c.CLI_CEP ? c.CLI_CEP.toString().trim() : '';
                    const fone = c.CLI_FONE ? c.CLI_FONE.toString().trim() : '';
                    const email = c.CLI_EMAIL ? c.CLI_EMAIL.toString().trim() : null;
                    const datacad = c.CLI_DATACADASTRO || null;

                    const query = `
                        INSERT INTO clientes (codigo, nome, fantasia, cpf_cnpj, endereco, bairro, cep, fone, email, datacad)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        ON CONFLICT (codigo) DO UPDATE SET 
                            nome = EXCLUDED.nome,
                            fantasia = EXCLUDED.fantasia,
                            cpf_cnpj = EXCLUDED.cpf_cnpj,
                            endereco = EXCLUDED.endereco,
                            bairro = EXCLUDED.bairro,
                            cep = EXCLUDED.cep,
                            fone = EXCLUDED.fone,
                            email = EXCLUDED.email,
                            datacad = EXCLUDED.datacad
                    `;
                    await pgClient.query(query, [codigo, nome, fantasia, cpf_cnpj, endereco, bairro, cep, fone, email, datacad]);
                    inseridos++;
                    if (inseridos % 500 === 0) process.stdout.write('.');
                } catch (err) {
                    console.error(`\nErro Cliente cod ${c.CLI_CODIGO}:`, err.message);
                }
            }
            console.log(`\n> ${inseridos} Clientes migrados com sucesso!`);
            
            await pgClient.query("SET session_replication_role = default;");
        } catch (e) {
            console.error("Erro:", e);
        } finally {
            fbDb.detach();
            await pgClient.end();
            process.exit(0);
        }
    });
}

run();
