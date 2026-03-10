// =====================================================
// NINJATRADER FILE SYNC - Upload Manual Inteligente
// Sincronización automática de archivos de ejecución
// =====================================================

class NinjaTraderFileSync {
    constructor() {
        this.folderHandle = null;
        this.lastSyncDate = null;
        this.accounts = [];
        this.dbName = 'TraderSurvivorDB';
        this.initDB();
    }

    async initDB() {
        // Usar IndexedDB para guardar referencias
        const request = indexedDB.open(this.dbName, 1);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'key' });
            }
        };
    }

    async saveSettings(key, value) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['settings'], 'readwrite');
                const store = transaction.objectStore('settings');
                store.put({ key, value });
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            };
        });
    }

    async getSettings(key) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['settings'], 'readonly');
                const store = transaction.objectStore('settings');
                const getRequest = store.get(key);
                getRequest.onsuccess = () => resolve(getRequest.result?.value);
                getRequest.onerror = () => reject(getRequest.error);
            };
        });
    }

    /**
     * Seleccionar carpeta de NinjaTrader
     */
    async selectFolder() {
        try {
            // File System Access API
            const dirHandle = await window.showDirectoryPicker({
                mode: 'read',
                startIn: 'documents'
            });

            this.folderHandle = dirHandle;
            
            // Guardar referencia para próximas veces
            await this.saveSettings('ninjatrader_folder_name', dirHandle.name);
            
            console.log('✅ Carpeta seleccionada:', dirHandle.name);
            
            return dirHandle;
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('❌ Error seleccionando carpeta:', error);
                throw error;
            }
            return null;
        }
    }

    /**
     * Escanear carpeta y encontrar archivos de ejecución
     */
    async scanFolder(dirHandle) {
        const files = [];
        const accounts = new Set();
        
        try {
            for await (const entry of dirHandle.values()) {
                if (entry.kind === 'file' && 
                    (entry.name.endsWith('.xml') || entry.name.endsWith('.csv'))) {
                    files.push(entry);
                }
            }
            
            console.log(`📂 Encontrados ${files.length} archivos`);
            return files;
        } catch (error) {
            console.error('❌ Error escaneando carpeta:', error);
            throw error;
        }
    }

    /**
     * Parsear archivo XML de NinjaTrader
     */
    parseNinjaTraderXML(xmlText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        const trades = [];
        
        // Buscar elementos Execution
        const executions = xmlDoc.getElementsByTagName('Execution');
        
        for (let i = 0; i < executions.length; i++) {
            const exec = executions[i];
            
            const trade = {
                account: this.getXMLValue(exec, 'Account') || 'Default',
                time: this.getXMLValue(exec, 'Time'),
                instrument: this.getXMLValue(exec, 'Instrument'),
                action: this.getXMLValue(exec, 'Action'),
                quantity: parseFloat(this.getXMLValue(exec, 'Quantity')) || 0,
                price: parseFloat(this.getXMLValue(exec, 'Price')) || 0,
                orderType: this.getXMLValue(exec, 'OrderType'),
                commission: parseFloat(this.getXMLValue(exec, 'Commission')) || 0,
                orderId: this.getXMLValue(exec, 'OrderId'),
                executionId: this.getXMLValue(exec, 'ExecutionId')
            };
            
            if (trade.instrument && trade.action) {
                trades.push(trade);
            }
        }
        
        return trades;
    }

    getXMLValue(element, tagName) {
        const tags = element.getElementsByTagName(tagName);
        return tags.length > 0 ? tags[0].textContent : '';
    }

    /**
     * Parsear archivo CSV de Tradovate Position History
     */
    parseTradovatePositionHistory(csvText) {
        const lines = csvText.split('\n');
        const trades = [];
        
        // Primera línea son headers
        const headers = lines[0].split(',').map(h => h.trim());
        
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            const values = this.parseCSVLine(lines[i]);
            const row = {};
            
            headers.forEach((header, index) => {
                row[header] = values[index]?.trim();
            });
            
            // Saltar si no hay P/L (fila incompleta)
            if (!row['P/L'] || row['Net Pos'] !== '0') continue;
            
            const pnl = parseFloat(row['P/L']) || 0;
            const quantity = parseFloat(row['Paired Qty']) || 0;
            const buyPrice = parseFloat(row['Buy Price']) || 0;
            const sellPrice = parseFloat(row['Sell Price']) || 0;
            
            // Determinar si es Long o Short
            const isLong = buyPrice < sellPrice;
            
            trades.push({
                id: `tradovate_${row['Position ID']}_${Date.now()}`,
                account_id: row['Account'] || 'Tradovate',
                platform: 'tradovate',
                instrument: row['Product'] || row['Contract'],
                type: isLong ? 'buy' : 'sell',
                entry_price: buyPrice,
                exit_price: sellPrice,
                quantity: quantity,
                entry_date: row['Bought Timestamp'],
                exit_date: row['Sold Timestamp'],
                pnl: pnl,
                commission: 0, // Tradovate incluye comisión en P/L
                result: this.calculateResult(pnl),
                status: 'closed',
                notes: `Importado desde Tradovate - ${row['Product Description'] || ''}`,
                metadata: {
                    positionId: row['Position ID'],
                    pairId: row['Pair ID'],
                    contract: row['Contract'],
                    tradeDate: row['Trade Date'],
                    currency: row['Currency'],
                    raw: row
                }
            });
        }
        
        return trades;
    }

    /**
     * Parsear línea CSV respetando comillas
     */
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        
        return result;
    }

    /**
     * Detectar tipo de CSV y parsear apropiadamente
     */
    parseCSV(csvText) {
        const firstLine = csvText.split('\n')[0];
        
        // Detectar si es Tradovate Position History
        if (firstLine.includes('Position ID') && 
            firstLine.includes('Buy Price') && 
            firstLine.includes('Sell Price') && 
            firstLine.includes('P/L')) {
            console.log('📊 Detectado: Tradovate Position History CSV');
            return this.parseTradovatePositionHistory(csvText);
        }
        
        // Detectar si es NinjaTrader en español (usa punto y coma)
        if (firstLine.includes('Número de trade') && 
            firstLine.includes('Precio de entrada') && 
            firstLine.includes('Precio de salida')) {
            console.log('📊 Detectado: NinjaTrader CSV (Español)');
            return this.parseNinjaTraderSpanishCSV(csvText);
        }
        
        // Detectar si es NinjaTrader en inglés
        if (firstLine.includes('Instrument') && firstLine.includes('Action')) {
            console.log('📊 Detectado: NinjaTrader CSV (Inglés)');
            return this.parseNinjaTraderCSV(csvText);
        }
        
        // Por defecto intentar NinjaTrader inglés
        console.log('📊 Formato desconocido, intentando parseo genérico');
        return this.parseNinjaTraderCSV(csvText);
    }

    /**
     * Parsear archivo CSV de NinjaTrader en español
     */
    parseNinjaTraderSpanishCSV(csvText) {
        const lines = csvText.split('\n');
        const trades = [];
        
        // Primera línea son headers (separados por punto y coma)
        const headers = lines[0].split(';').map(h => h.trim());
        
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            const values = lines[i].split(';');
            const row = {};
            
            headers.forEach((header, index) => {
                row[header] = values[index]?.trim();
            });
            
            // Saltar si no tiene datos completos
            if (!row['Instrumento'] || !row['Ganancias']) continue;
            
            // Limpiar valores numéricos (quitar separadores de miles y cambiar coma por punto)
            const cleanNumber = (str) => {
                if (!str) return 0;
                return parseFloat(str.replace(/\./g, '').replace(',', '.').replace(/\s+/g, '').replace('$', '')) || 0;
            };
            
            const pnl = cleanNumber(row['Ganancias']);
            const commission = cleanNumber(row['Comisión']);
            const quantity = parseFloat(row['Cant.']) || 0;
            const entryPrice = cleanNumber(row['Precio de entrada']);
            const exitPrice = cleanNumber(row['Precio de salida']);
            
            // Determinar tipo (Long/Short)
            const marketPos = row['Mercado pos.']?.toLowerCase() || '';
            const isLong = marketPos.includes('long');
            
            trades.push({
                id: `ninjatrader_${row['Número de trade']}_${Date.now()}`,
                account_id: row['Cuenta'] || 'NinjaTrader',
                platform: 'ninjatrader',
                instrument: row['Instrumento'],
                type: isLong ? 'buy' : 'sell',
                entry_price: entryPrice,
                exit_price: exitPrice,
                quantity: quantity,
                entry_date: row['Tiempo de entrada'],
                exit_date: row['Tiempo de salida'],
                pnl: pnl,
                commission: commission,
                result: this.calculateResult(pnl),
                status: 'closed',
                notes: `Importado desde NinjaTrader - ${row['Estrategia'] || 'Manual'}`,
                metadata: {
                    tradeNumber: row['Número de trade'],
                    strategy: row['Estrategia'],
                    entryName: row['Nombre de entrada'],
                    exitName: row['Nombre de salida'],
                    netProfit: cleanNumber(row['Con ganancia neto']),
                    mae: cleanNumber(row['MAE']),
                    mfe: cleanNumber(row['MFE']),
                    etd: cleanNumber(row['ETD']),
                    raw: row
                }
            });
        }
        
        return trades;
    }

    /**
     * Parsear archivo CSV de NinjaTrader
     */
    parseNinjaTraderCSV(csvText) {
        const lines = csvText.split('\n');
        const trades = [];
        
        // Primera línea son headers
        const headers = lines[0].split(',').map(h => h.trim());
        
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            const values = lines[i].split(',');
            const trade = {};
            
            headers.forEach((header, index) => {
                trade[header.toLowerCase()] = values[index]?.trim();
            });
            
            if (trade.instrument && trade.action) {
                trades.push({
                    account: trade.account || 'Default',
                    time: trade.time || trade.date,
                    instrument: trade.instrument,
                    action: trade.action,
                    quantity: parseFloat(trade.quantity) || 0,
                    price: parseFloat(trade.price) || 0,
                    orderType: trade.ordertype || 'Market',
                    commission: parseFloat(trade.commission) || 0,
                    orderId: trade.orderid,
                    executionId: trade.executionid
                });
            }
        }
        
        return trades;
    }

    /**
     * Agrupar ejecuciones en trades completos
     */
    groupExecutionsIntoTrades(executions) {
        const tradeMap = new Map();
        
        executions.forEach(exec => {
            const key = `${exec.account}_${exec.instrument}_${exec.orderId || exec.time}`;
            
            if (!tradeMap.has(key)) {
                tradeMap.set(key, []);
            }
            
            tradeMap.get(key).push(exec);
        });
        
        const completedTrades = [];
        
        tradeMap.forEach((execs, key) => {
            // Buscar pares de entrada/salida
            const buys = execs.filter(e => e.action.toLowerCase().includes('buy'));
            const sells = execs.filter(e => e.action.toLowerCase().includes('sell'));
            
            // Emparejar
            const maxPairs = Math.min(buys.length, sells.length);
            
            for (let i = 0; i < maxPairs; i++) {
                const entry = buys[i].action.toLowerCase().includes('cover') ? sells[i] : buys[i];
                const exit = buys[i].action.toLowerCase().includes('cover') ? buys[i] : sells[i];
                
                const pnl = (exit.price - entry.price) * entry.quantity;
                const totalCommission = entry.commission + exit.commission;
                
                completedTrades.push({
                    id: `ninja_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    account_id: entry.account,
                    platform: 'ninjatrader',
                    instrument: entry.instrument,
                    type: entry.action.toLowerCase().includes('buy') ? 'buy' : 'sell',
                    entry_price: entry.price,
                    exit_price: exit.price,
                    quantity: entry.quantity,
                    entry_date: entry.time,
                    exit_date: exit.time,
                    pnl: pnl - totalCommission,
                    commission: totalCommission,
                    result: this.calculateResult(pnl - totalCommission),
                    status: 'closed',
                    notes: 'Importado desde NinjaTrader',
                    metadata: {
                        orderId: entry.orderId,
                        orderType: entry.orderType,
                        raw: { entry, exit }
                    }
                });
            }
        });
        
        return completedTrades;
    }

    calculateResult(pnl) {
        if (pnl > 0.01) return 'win';
        if (pnl < -0.01) return 'loss';
        return 'breakeven';
    }

    /**
     * Convertir fecha DD/MM/YYYY a YYYY-MM-DD
     */
    convertDateFormat(dateStr) {
        if (!dateStr) return null;
        
        // Si ya está en formato ISO o YYYY-MM-DD, devolverlo
        if (dateStr.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
            return dateStr.split('T')[0];
        }
        
        try {
            // Formato DD/MM/YYYY o DD/MM/YYYY HH:MM:SS
            const datePart = dateStr.split(' ')[0];
            const parts = datePart.split('/');
            
            if (parts.length === 3) {
                const [day, month, year] = parts;
                return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
        } catch (error) {
            console.error('Error convirtiendo fecha:', dateStr, error);
        }
        
        return null;
    }

    /**
     * Sincronizar archivos
     */
    async sync(onProgress) {
        if (!this.folderHandle) {
            throw new Error('Primero debes seleccionar una carpeta');
        }

        try {
            onProgress?.({ status: 'scanning', message: 'Escaneando archivos...' });
            
            const files = await this.scanFolder(this.folderHandle);
            
            if (files.length === 0) {
                return { success: false, message: 'No se encontraron archivos' };
            }

            onProgress?.({ 
                status: 'processing', 
                message: `Procesando ${files.length} archivos...`,
                total: files.length 
            });

            let allExecutions = [];
            const accountsFound = new Set();

            // Procesar cada archivo
            for (let i = 0; i < files.length; i++) {
                const fileEntry = files[i];
                
                try {
                    const file = await fileEntry.getFile();
                    const text = await file.text();
                    
                    let executions = [];
                    if (fileEntry.name.endsWith('.xml')) {
                        executions = this.parseNinjaTraderXML(text);
                    } else if (fileEntry.name.endsWith('.csv')) {
                        executions = this.parseCSV(text);
                    }
                    
executions.forEach(exec => {
                accountsFound.add(exec.account || exec.account_id);
            });
                    allExecutions.push(...executions);
                    
                    onProgress?.({ 
                        status: 'processing', 
                        current: i + 1, 
                        total: files.length,
                        message: `Procesado ${fileEntry.name}`
                    });
                } catch (error) {
                    console.error(`Error procesando ${fileEntry.name}:`, error);
                }
            }

            onProgress?.({ status: 'grouping', message: 'Agrupando trades...' });
            
            // Separar trades ya completos (Tradovate) de ejecuciones (NinjaTrader)
            const completedTrades = allExecutions.filter(e => e.id && e.platform);
            const executions = allExecutions.filter(e => !e.id || !e.platform);
            
            const ninjaTraderTrades = executions.length > 0 ? this.groupExecutionsIntoTrades(executions) : [];
            const trades = [...completedTrades, ...ninjaTraderTrades];
            
            this.accounts = Array.from(accountsFound);

            onProgress?.({ 
                status: 'importing', 
                message: `Importando ${trades.length} trades...`,
                total: trades.length
            });

            // Importar a Supabase
            let imported = 0;
            const errors = [];
            
            for (let i = 0; i < trades.length; i++) {
                try {
                    await this.importTrade(trades[i]);
                    imported++;
                    
                    onProgress?.({ 
                        status: 'importing', 
                        current: i + 1, 
                        total: trades.length,
                        message: `Importados ${imported} trades`
                    });
                } catch (error) {
                    errors.push({ trade: trades[i], error: error.message });
                }
            }

            this.lastSyncDate = new Date().toISOString();
            await this.saveSettings('last_sync_date', this.lastSyncDate);

            return {
                success: true,
                imported,
                total: trades.length,
                accounts: this.accounts,
                errors
            };

        } catch (error) {
            console.error('❌ Error en sincronización:', error);
            throw error;
        }
    }

    async importTrade(trade) {
        // Obtener usuario actual
        const { data: { user } } = await window.supabase.auth.getUser();
        
        if (!user) {
            throw new Error('Usuario no autenticado');
        }

        // Obtener el ID de la cuenta si existe (por nombre)
        let accountId = null;
        if (trade.account_id) {
            const { data: accountData } = await window.supabase
                .from('accounts')
                .select('id')
                .eq('user_id', user.id)
                .eq('name', trade.account_id)
                .maybeSingle();
            
            if (accountData && accountData.id) {
                accountId = accountData.id;
            }
        }

        // Convertir fechas DD/MM/YYYY a YYYY-MM-DD
        const entryDate = this.convertDateFormat(trade.entry_date) || new Date().toISOString().split('T')[0];
        const exitDate = this.convertDateFormat(trade.exit_date);
        
        // Mapear campos de trade a estructura de operations
        const operation = {
            id: trade.id,
            user_id: user.id,
            account_id: accountId,
            date: entryDate,
            instrument: trade.instrument,
            type: trade.type,
            entry: trade.entry_price,
            exit: trade.exit_price,
            entry_time: trade.entry_date,
            exit_time: trade.exit_date,
            volume: trade.quantity,
            result: trade.result,
            pl: trade.pnl,
            currency: 'USD',
            notes: trade.notes
        };

        // Calcular MAE/MFE estimados
        if (window.calculateEstimatedMAEMFE && operation.result) {
            const maemfe = window.calculateEstimatedMAEMFE(operation);
            operation.mae = maemfe.mae;
            operation.mfe = maemfe.mfe;
        } else {
            operation.mae = 0;
            operation.mfe = 0;
        }

        console.log('📤 Enviando operación a Supabase:', JSON.stringify(operation, null, 2));

        const { data, error } = await window.supabase
            .from('operations')
            .upsert(operation, { onConflict: 'id' })
            .select()
            .single();

        if (error) {
            console.error('❌ Error de Supabase:', JSON.stringify(error, null, 2));
            console.error('📊 Datos enviados:', JSON.stringify(operation, null, 2));
            throw error;
        }
        
        return data;
    }

    /**
     * Asegurar que la cuenta existe, crearla si no
     */
    async ensureAccountExists(userId, accountName, platform, initialBalance = null) {
        try {
            // Buscar si la cuenta ya existe
            const { data: existingAccounts } = await window.supabase
                .from('accounts')
                .select('*')
                .eq('user_id', userId)
                .eq('name', accountName);

            if (existingAccounts && existingAccounts.length > 0) {
                console.log(`✅ Cuenta "${accountName}" ya existe`);
                return existingAccounts[0];
            }

            // Crear nueva cuenta
            console.log(`📝 Creando cuenta "${accountName}" automáticamente...`);
            console.log(`💰 Balance inicial detectado: $${initialBalance || 0}`);
            
            const balance = initialBalance || 0;
            
            // Generar UUID para el ID
            const accountId = crypto.randomUUID();
            
            const newAccount = {
                id: accountId,
                user_id: userId,
                name: accountName,
                platform: platform,
                balance: balance,
                currency: 'USD'
            };

            const { data, error } = await window.supabase
                .from('accounts')
                .insert(newAccount)
                .select()
                .single();

            if (error) {
                console.warn('⚠️ No se pudo crear la cuenta automáticamente:', error.message);
                return null;
            }

            console.log(`✅ Cuenta "${accountName}" creada exitosamente con balance de $${balance}`);
            return data;

        } catch (error) {
            console.warn('⚠️ Error verificando/creando cuenta:', error);
            return null;
        }
    }
    
    /**
     * Calcular balance total de una cuenta desde los trades
     */
    calculateAccountBalance(trades, accountName) {
        let totalPnL = 0;
        
        trades.forEach(trade => {
            if (trade.account_id === accountName || trade.metadata?.raw?.Account === accountName) {
                totalPnL += trade.pnl || 0;
            }
        });
        
        console.log(`💰 P/L total calculado para "${accountName}": $${totalPnL}`);
        return totalPnL;
    }

    /**
     * Verificar si File System Access API está disponible
     */
    static isSupported() {
        return 'showDirectoryPicker' in window;
    }
}

// Exportar para uso global
window.NinjaTraderFileSync = NinjaTraderFileSync;
