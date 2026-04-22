const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

// Configurações
const XML_DIR = 'C:/Users/robso/Downloads/[Download ZIP] - 598 arquivos/NF-e/05848835000110/Autorizadas/Recebidas';
const OUTPUT_FILE = path.join(__dirname, 'relatorio_compras.csv');

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ""
});

async function extractData() {
    console.log(`Lendo arquivos de: ${XML_DIR}`);
    
    if (!fs.existsSync(XML_DIR)) {
        console.error("Erro: Diretório de XML não encontrado!");
        return;
    }

    const files = fs.readdirSync(XML_DIR).filter(f => f.endsWith('.xml'));
    console.log(`Encontrados ${files.length} arquivos XML.`);

    const results = [];
    // Cabeçalho do CSV
    results.push('chave;data_emissao;cProd;xProd;uCom;qCom;vUnCom;vProd;ncm;cfop;cst;orig;cnpj_emitente;xNome_emitente');

    let processedCount = 0;

    for (const file of files) {
        try {
            const filePath = path.join(XML_DIR, file);
            const xmlContent = fs.readFileSync(filePath, 'utf8');
            const jsonObj = parser.parse(xmlContent);

            // Estrutura básica da NF-e 4.00
            const nfeProc = jsonObj.nfeProc || jsonObj;
            const infNFe = nfeProc.NFe ? nfeProc.NFe.infNFe : nfeProc.infNFe;

            if (!infNFe) {
                console.warn(`Aviso: Estrutura infNFe não encontrada no arquivo ${file}`);
                continue;
            }

            const dataEmissao = infNFe.ide.dhEmi || infNFe.ide.dEmi;
            const cnpjEmitente = infNFe.emit.CNPJ;
            const xNomeEmitente = infNFe.emit.xNome.replace(/;/g, ',');
            const chave = infNFe.Id ? infNFe.Id.replace('NFe', '') : '';

            // Itens da nota (det) - pode ser objeto ou array
            let items = infNFe.det;
            if (!Array.isArray(items)) {
                items = [items];
            }

            for (const item of items) {
                const p = item.prod;
                const cProd = p.cProd;
                const xProd = p.xProd.replace(/;/g, ',');
                const uCom = p.uCom;
                const qCom = p.qCom;
                const vUnCom = p.vUnCom;
                const vProd = p.vProd;
                const ncm = p.NCM || '';
                const cfop = p.CFOP || '';

                // Extração de impostos para CST/Origem
                const imposto = item.imposto || {};
                const icms = imposto.ICMS || {};
                let cst = '';
                let orig = '';
                const icmsKey = Object.keys(icms)[0];
                if (icmsKey) {
                    cst = icms[icmsKey].CST || icms[icmsKey].CSOSN || '';
                    orig = icms[icmsKey].orig !== undefined ? icms[icmsKey].orig : '';
                }

                results.push(`${chave};${dataEmissao};${cProd};${xProd};${uCom};${qCom};${vUnCom};${vProd};${ncm};${cfop};${cst};${orig};${cnpjEmitente};${xNomeEmitente}`);
            }

            processedCount++;
            if (processedCount % 50 === 0) {
                console.log(`Processados ${processedCount} arquivos...`);
            }
        } catch (err) {
            console.error(`Erro ao processar arquivo ${file}:`, err.message);
        }
    }

    fs.writeFileSync(OUTPUT_FILE, '\ufeff' + results.join('\n'), 'utf8');
    console.log(`\n✅ Extração concluída!`);
    console.log(`📊 Total de arquivos processados: ${processedCount}`);
    console.log(`📄 Relatório gerado em: ${OUTPUT_FILE}`);
}

extractData();
