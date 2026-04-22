const { Client } = require('pg');

async function findSpecificProducts() {
    const client = new Client({
        user: 'postgres', host: '127.0.0.1', database: 'control', password: '', port: 5432
    });

    try {
        await client.connect();
        
        const keywords = ['PRECISION', 'BABYLOOK', 'GOLA POLO', 'GLITER PVC'];
        
        console.log('--- Buscando por termos específicos do XML no Banco ---\n');
        
        for (let kw of keywords) {
            console.log(`Buscando por: "${kw}"...`);
            const res = await client.query(
                "SELECT codigo, codigodefabrica, codbarra, descricao, precocusto FROM produtos WHERE descricao ILIKE $1 LIMIT 5",
                [`%${kw}%`]
            );
            
            if (res.rows.length > 0) {
                console.table(res.rows);
            } else {
                console.log(`[!] Nenhum produto encontrado com "${kw}"\n`);
            }
        }

    } catch (err) {
        console.error('Erro:', err);
    } finally {
        await client.end();
    }
}

findSpecificProducts();
