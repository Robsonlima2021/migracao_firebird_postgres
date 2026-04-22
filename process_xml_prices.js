const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');
const { Client } = require('pg');

// Configurações
const DOWNLOADS_DIR = 'C:/Users/robso/Downloads';
const OUTPUT_CSV = path.join(__dirname, 'precos_maximos_xml.csv');

const pgConfig = {
    user: 'postgres',
    host: '127.0.0.1',
    database: 'control',
    password: '',
    port: 5432,
};

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ""
});

async function processXmlPrices() {
    console.log("🚀 Iniciando processamento de preços via XML...");
    
    // 1. Localizar todos os XMLs recursivamente
    const allFiles = getAllFiles(DOWNLOADS_DIR).filter(f => f.toLowerCase().endsWith('.xml'));
    console.log(`🔍 Encontrados ${allFiles.length} arquivos XML.`);

    const priceMap = new Map(); // Chave: cEAN ou cProd -> { maxPrice: 0, xProd: '', cEAN: '', cProd: '' }

    let processedFiles = 0;

    for (const file of allFiles) {
        try {
            const xmlContent = fs.readFileSync(file, 'utf8');
            const jsonObj = parser.parse(xmlContent);

            const nfeProc = jsonObj.nfeProc || jsonObj;
            const infNFe = nfeProc.NFe ? nfeProc.NFe.infNFe : nfeProc.infNFe;

            if (!infNFe) continue;

            let items = infNFe.det;
            if (!Array.isArray(items)) items = [items];

            for (const item of items) {
                const p = item.prod;
                const cProd = p.cProd?.toString().trim();
                const cEAN = p.cEAN?.toString().trim();
                const xProd = p.xProd;
                const vUnCom = parseFloat(p.vUnCom);

                if (isNaN(vUnCom)) continue;

                // Usamos cEAN como chave primária de mapeamento se disponível e válido (não 'SEM GTIN' etc)
                const isValidEAN = cEAN && cEAN !== 'SEM GTIN' && cEAN.length >= 8;
                const key = isValidEAN ? cEAN : cProd;

                if (!priceMap.has(key) || vUnCom > priceMap.get(key).maxPrice) {
                    priceMap.set(key, {
                        maxPrice: vUnCom,
                        xProd: xProd,
                        cEAN: isValidEAN ? cEAN : '',
                        cProd: cProd
                    });
                }
            }

            processedFiles++;
            if (processedFiles % 100 === 0) console.log(`Arquivos lidos: ${processedFiles}...`);

        } catch (err) {
            // Ignorar erros em arquivos individuais (pode não ser NFe)
        }
    }

    console.log(`✅ Processados ${processedFiles} arquivos. Itens únicos encontrados: ${priceMap.size}`);

    // 2. Gerar CSV
    const csvLines = ['key;cEAN;cProd;xProd;maxPrice'];
    for (const [key, data] of priceMap.entries()) {
        csvLines.push(`${key};${data.cEAN};${data.cProd};${data.xProd.replace(/;/g, ',')};${data.maxPrice}`);
    }
    fs.writeFileSync(OUTPUT_CSV, '\ufeff' + csvLines.join('\n'), 'utf8');
    console.log(`📄 CSV gerado: ${OUTPUT_CSV}`);

    // 3. Atualizar PostgreSQL
    console.log("💾 Atualizando banco de dados...");
    const client = new Client(pgConfig);
    await client.connect();

    try {
        await client.query("SET session_replication_role = replica;");
        
        let updateCount = 0;
        let skipCount = 0;

        for (const [key, data] of priceMap.entries()) {
            // Tenta encontrar o produto por codbarra ou codigodefabrica
            const findQuery = `
                SELECT codigo, precocusto FROM produtos 
                WHERE codbarra = $1 OR codigodefabrica = $2
                LIMIT 1
            `;
            const res = await client.query(findQuery, [data.cEAN, data.cProd]);

            if (res.rows.length > 0) {
                const product = res.rows[0];
                const currentCost = parseFloat(product.precocusto);
                const newCost = Math.round(data.maxPrice * 100) / 100; // Arredondamento para 2 casas conforme pedido

                // Salvar sempre o maior valor
                if (newCost > currentCost || currentCost === 0) {
                    const newSalesPrice = Math.round(newCost * 1.6 * 100) / 100; // Markup de 60%
                    
                    await client.query(`
                        UPDATE produtos 
                        SET precocusto = $1, precovenda = $2 
                        WHERE codigo = $3
                    `, [newCost, newSalesPrice, product.codigo]);
                    
                    updateCount++;
                } else {
                    skipCount++;
                }
            }
        }

        console.log(`📊 Resultado da atualização:`);
        console.log(`- Produtos atualizados: ${updateCount}`);
        console.log(`- Produtos mantidos (já tinham preço maior): ${skipCount}`);

    } catch (err) {
        console.error("❌ Erro no banco:", err);
    } finally {
        await client.query("SET session_replication_role = default;");
        await client.end();
    }
}

// Função auxiliar para busca recursiva de arquivos
function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function(file) {
        try {
            if (fs.statSync(dirPath + "/" + file).isDirectory()) {
                arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
            } else {
                arrayOfFiles.push(path.join(dirPath, "/", file));
            }
        } catch (e) {
            // Ignorar erros de permissão
        }
    });

    return arrayOfFiles;
}

processXmlPrices();
