const { Client } = require('pg');
const client = new Client({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'control',
    password: '',
    port: 5432
});

client.connect().then(() => {
    client.query("SELECT COUNT(*) as total FROM clientes").then(resTotal => {
        client.query("SELECT COUNT(*) as com_cpf FROM clientes WHERE cpf_cnpj IS NOT NULL AND cpf_cnpj != ''").then(resCpf => {
            console.log('Total de Cadastros (clientes):', resTotal.rows[0].total);
            console.log('Cadastros com CPF/CNPJ recuperados e atualizados:', resCpf.rows[0].com_cpf);
        client.query("SELECT codigo, nome, cpf_cnpj FROM clientes WHERE cpf_cnpj IS NOT NULL AND cpf_cnpj != '' LIMIT 5").then(res2 => {
            console.table(res2.rows);
            client.end();
        });
    });
});
