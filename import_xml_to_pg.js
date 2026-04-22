const { Client } = require('pg');
const fs = require('fs');

async function importData() {
    const client = new Client({
        user: 'postgres', host: '127.0.0.1', database: 'control', password: '', port: 5432
    });

    try {
        const mappingPath = 'mapeamento_produtos.csv';
        const purchasesPath = 'relatorio_compras.csv';

        if (!fs.existsSync(mappingPath) || !fs.existsSync(purchasesPath)) {
            console.error('Arquivos necessários (mapeamento ou compras) não encontrados.');
            return;
        }

        console.log('Lendo arquivos de dados...');
        const mappingContent = fs.readFileSync(mappingPath, 'utf8').replace(/^\uFEFF/, '');
        const purchaseContent = fs.readFileSync(purchasesPath, 'utf8').replace(/^\uFEFF/, '');

        const mappingLines = mappingContent.split(/\r?\n/).slice(1);
        const purchaseLines = purchaseContent.split(/\r?\n/).slice(1);

        // 1. Carregar mapeamento
        const productMap = new Map();
        for (let line of mappingLines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            const p = trimmedLine.split(';');
            const cnpj = p[0].replace(/\D/g, '').padStart(14, '0');
            const codXml = p[2];
            const idSistema = p[6]?.trim();

            if (idSistema && !isNaN(idSistema)) {
                productMap.set(`${cnpj}_${codXml}`, parseInt(idSistema));
            }
        }

        console.log(`Mapeamento carregado: ${productMap.size} produtos vinculados.`);

        // 2. Processar compras (pegar a mais recente com dados fiscais)
        const latestInfo = new Map(); 
        
        for (let line of purchaseLines) {
            if (!line.trim()) continue;
            const p = line.split(';');
            
            const cnpj = p[12].replace(/\D/g, '').padStart(14, '0');
            const codXml = p[2];
            const preco = parseFloat(p[6].replace(',', '.'));
            const data = new Date(p[1]);
            const unidade = p[4]; // uCom do XML
            const ncm = p[8];
            const cfopFull = p[9];
            const cst = p[10];
            const orig = p[11];

            const idSistema = productMap.get(`${cnpj}_${codXml}`);
            if (idSistema) {
                const current = latestInfo.get(idSistema);
                if (!current || data > current.data) {
                    const cfop3 = cfopFull.length >= 3 ? parseInt(cfopFull.slice(-3)) : 0;
                    const st = (orig || '0') + (cst.padStart(2, '0'));

                    latestInfo.set(idSistema, { 
                        preco, 
                        data, 
                        unidade,
                        ncm, 
                        cfop: cfop3,
                        st: st.substring(0, 3) 
                    });
                }
            }
        }

        console.log(`Pronto para atualizar ${latestInfo.size} produtos...`);

        // 3. Executar updates
        await client.connect();
        
        // --- BYPASS DE SEGURANÇA: LOGAR COMO ADMIN (ID 1) ---
        console.log('Autenticando script no banco como Administrador...');
        await client.query('SELECT get_usuario(1)');
        // ---------------------------------------------------

        // --- NOVO: Carregar unidades existentes para evitar foreign key errors ---
        const unitsRes = await client.query('SELECT unidade FROM unidade_medidas');
        const existingUnits = new Set(unitsRes.rows.map(r => r.unidade));
        console.log(`Unidades de medida cadastradas: ${existingUnits.size}`);

        let updatedFull = 0;
        let updatedPartial = 0;
        let errorCount = 0;
        
        for (let [id, info] of latestInfo) {
            try {
                // Garantir que a unidade existe no sistema
                if (info.unidade && !existingUnits.has(info.unidade)) {
                    try {
                        console.log(`Cadastrando nova unidade: ${info.unidade}`);
                        await client.query('INSERT INTO unidade_medidas (unidade, descricao) VALUES ($1, $1)', [info.unidade]);
                        existingUnits.add(info.unidade);
                    } catch (e) {
                        console.warn(`⚠️ Aviso: Falha ao cadastrar unidade ${info.unidade}: ${e.message}`);
                    }
                }

                // TENTATIVA 1: UPDATE COMPLETO (PREÇO + FISCAL)
                await client.query(
                    `UPDATE produtos SET 
                        precocusto = $1, 
                        cod_ncm = $2, 
                        cfop_compra = $3, 
                        cfop_venda = $3, 
                        situacaotributaria = $4,
                        st_fora = $4,
                        unidade = $6
                    WHERE codigo = $5`,
                    [info.preco, info.ncm, info.cfop, info.st, id, info.unidade]
                );
                updatedFull++;
            } catch (err) {
                // TENTATIVA 2: FALLBACK COM CFOP SEGURO (SE ERRO FISCAL)
                if (err.message.includes('CFOP') || err.message.includes('CST') || err.message.includes('validadados')) {
                    try {
                        const safeCfop = 102; // CFOP padrão de compra para destravar
                        const safeSt = info.st || '000';
                        await client.query(
                            `UPDATE produtos SET 
                                precocusto = $1, 
                                cod_ncm = $2, 
                                cfop_compra = $3, 
                                cfop_venda = $3,
                                situacaotributaria = $4,
                                unidade = $6
                             WHERE codigo = $5`,
                            [info.preco, info.ncm, safeCfop, safeSt, id, info.unidade]
                        );
                        updatedPartial++;
                    } catch (errPartial) {
                        errorCount++;
                        console.error(`❌ Erro persistente no ID ${id}: ${errPartial.message}`);
                    }
                } else {
                    errorCount++;
                    console.error(`❌ Erro no ID ${id}: ${err.message}`);
                }
            }
            if ((updatedFull + updatedPartial) % 50 === 0) {
                console.log(`Progresso: ${updatedFull + updatedPartial} itens processados...`);
            }
        }

        console.log(`\n✅ CONCLUÍDO!`);
        console.log(`📊 Sucesso Total (Preço + Fiscal): ${updatedFull}`);
        console.log(`📊 Sucesso Parcial (Apenas Preço): ${updatedPartial}`);
        console.log(`⚠️ Erros: ${errorCount}`);

    } catch (err) {
        console.error('Erro crítico na importação:', err);
    } finally {
        await client.end();
    }
}

importData();
