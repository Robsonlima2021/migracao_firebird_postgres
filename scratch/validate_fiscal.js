const { Client } = require('pg');

const pgClient = new Client({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'control',
    password: '',
    port: 5432,
});

async function validate() {
    await pgClient.connect();
    console.log("📊 Validação da Migração Fiscal:");

    const headers = await pgClient.query("SELECT COUNT(*) FROM cabecalho_nota_compra");
    console.log(`- Cabeçalhos: ${headers.rows[0].count}`);

    const items = await pgClient.query("SELECT COUNT(*) FROM itens_nota_compra");
    console.log(`- Itens: ${items.rows[0].count}`);

    const taxes = await pgClient.query("SELECT COUNT(*) FROM itens_nota_compra_impostos");
    console.log(`- Impostos: ${taxes.rows[0].count}`);

    console.log("\n🔍 Amostra de Nota (Última inserida):");
    const sampleHeader = await pgClient.query("SELECT * FROM cabecalho_nota_compra ORDER BY codigo DESC LIMIT 1");
    if (sampleHeader.rows.length > 0) {
        const h = sampleHeader.rows[0];
        console.log(`Nota: ${h.nota}, Fornecedor: ${h.fornecedor}, Total: ${h.total_nota}`);

        const sampleItems = await pgClient.query(`
            SELECT i.produto, i.quantidade, i.preco_custo, t.cst_nota, t.icms, t.valor_icms
            FROM itens_nota_compra i
            LEFT JOIN itens_nota_compra_impostos t ON i.codigo = t.cd_item
            WHERE i.cd_nota = $1
        `, [h.codigo]);
        
        console.table(sampleItems.rows);
    }

    await pgClient.end();
}

validate();
