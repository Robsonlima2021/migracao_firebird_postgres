const { Client } = require('pg');
require('dotenv').config();

const pgClient = new Client({
    user: process.env.PG_USER || 'postgres',
    host: process.env.PG_HOST || '127.0.0.1',
    database: process.env.PG_DATABASE || 'control',
    password: process.env.PG_PASS || '',
    port: parseInt(process.env.PG_PORT || '5432'),
});

async function updatePrices() {
    console.log("📈 Iniciando atualização de preços...");
    await pgClient.connect();

    try {
        await pgClient.query("SET session_replication_role = replica;");

        // 1. Simulação/Verificação prévia
        const check = await pgClient.query("SELECT COUNT(*) FROM produtos WHERE precocusto > 0");
        const total = check.rows[0].count;
        console.log(`Total de produtos com custo: ${total}`);

        // 2. Execução do Update
        // Regra: Arredonda custo para 2 casas. Define venda como custo * 1.6 APENAS se estiver zerado.
        const updateQuery = `
            UPDATE produtos 
            SET 
                precocusto = ROUND(precocusto, 2),
                precovenda = CASE 
                                WHEN precovenda = 0 THEN ROUND(ROUND(precocusto, 2) * 1.6, 2) 
                                ELSE precovenda 
                             END
            WHERE precocusto > 0
        `;

        console.log("Executando query de atualização...");
        const res = await pgClient.query(updateQuery);
        console.log(`✅ Sucesso! ${res.rowCount} produtos atualizados.`);

        // 3. Amostragem pós-update
        const samples = await pgClient.query(`
            SELECT descricao, precocusto, precovenda 
            FROM produtos 
            WHERE precocusto > 0 
            LIMIT 10
        `);
        console.log("\nAmostra após atualização:");
        console.table(samples.rows);

    } catch (err) {
        console.error("❌ Erro ao atualizar preços:", err);
    } finally {
        await pgClient.query("SET session_replication_role = default;");
        await pgClient.end();
    }
}

updatePrices();
