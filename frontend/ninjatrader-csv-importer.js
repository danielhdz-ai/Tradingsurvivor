// =====================================================
// NINJATRADER CSV IMPORTER
// Importa archivos CSV de Executions de NinjaTrader 8
// =====================================================

class NinjaTraderCSVImporter {
    constructor() {
        this.trades = [];
        this.accounts = new Set();
    }

    /**
     * Parsear CSV de NinjaTrader - Usa el parser de ninjatrader-file-sync.js
     */
    parseCSV(csvText) {
        // Usar el parser universal del NinjaTraderFileSync
        if (window.NinjaTraderFileSync) {
            const fileSync = new window.NinjaTraderFileSync();
            const trades = fileSync.parseCSV(csvText);
            
            // Extraer cuentas únicas
            trades.forEach(trade => {
                this.accounts.add(trade.account_id);
            });
            
            console.log(`📊 Parseados ${trades.length} trades de ${this.accounts.size} cuentas`);
            return trades;
        }
        
        // Fallback: parser antiguo para CSV de ejecuciones
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) {
            throw new Error('El archivo CSV está vacío o no tiene datos');
        }

        // Header
        const headers = lines[0].split(';').map(h => h.trim());
        
        // Mapear headers a índices
        const columnMap = {
            instrument: headers.indexOf('Instrumento'),
            action: headers.indexOf('Acción'),
            quantity: headers.indexOf('Cantidad'),
            price: headers.indexOf('Precio'),
            time: headers.indexOf('Tiempo'),
            id: headers.indexOf('ID'),
            entryExit: headers.indexOf('E/X'),
            position: headers.indexOf('Posición'),
            orderId: headers.indexOf('ID de orden'),
            commission: headers.indexOf('Comisión'),
            fee: headers.indexOf('Tarifa'),
            account: headers.indexOf('Nombre de cuenta de pantalla'),
            connection: headers.indexOf('Conexión')
        };

        const executions = [];

        // Parsear cada línea
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            const values = lines[i].split(';');
            
            const execution = {
                instrument: values[columnMap.instrument]?.trim() || '',
                action: values[columnMap.action]?.trim() || '',
                quantity: this.parseNumber(values[columnMap.quantity]),
                price: this.parseNumber(values[columnMap.price]),
                time: values[columnMap.time]?.trim() || '',
                id: values[columnMap.id]?.trim() || '',
                entryExit: values[columnMap.entryExit]?.trim() || '',
                position: values[columnMap.position]?.trim() || '',
                orderId: values[columnMap.orderId]?.trim() || '',
                commission: this.parseCommission(values[columnMap.commission]),
                fee: this.parseCommission(values[columnMap.fee]),
                account: values[columnMap.account]?.trim() || 'Default',
                connection: values[columnMap.connection]?.trim() || ''
            };

            if (execution.instrument && execution.action) {
                executions.push(execution);
                this.accounts.add(execution.account);
            }
        }

        console.log(`📊 Parseadas ${executions.length} ejecuciones de ${this.accounts.size} cuentas`);
        return executions;
    }

    /**
     * Parsear números (maneja formato español con comas)
     */
    parseNumber(value) {
        if (!value) return 0;
        // Remover símbolos de moneda y espacios
        const cleaned = value.replace(/[$\s]/g, '').replace(',', '.');
        return parseFloat(cleaned) || 0;
    }

    /**
     * Parsear comisiones (formato: "0,87 $")
     */
    parseCommission(value) {
        if (!value) return 0;
        return this.parseNumber(value);
    }

    /**
     * Agrupar ejecuciones en trades completos
     */
    groupIntoTrades(executions) {
        // Agrupar por cuenta y ordenar por tiempo
        const accountGroups = new Map();

        executions.forEach(exec => {
            if (!accountGroups.has(exec.account)) {
                accountGroups.set(exec.account, []);
            }
            accountGroups.get(exec.account).push(exec);
        });

        const completedTrades = [];

        // Procesar cada cuenta
        accountGroups.forEach((execs, account) => {
            // Ordenar por tiempo
            execs.sort((a, b) => new Date(this.parseDateTime(a.time)) - new Date(this.parseDateTime(b.time)));

            console.log(`📊 Cuenta ${account}: ${execs.length} ejecuciones`);

            // Separar entradas y salidas
            const entries = execs.filter(e => e.entryExit === 'Entrada');
            const exits = execs.filter(e => e.entryExit === 'Salida');

            console.log(`  → ${entries.length} entradas, ${exits.length} salidas`);

            // Emparejar cada salida con su entrada más cercana anterior
            const usedEntries = new Set();

            exits.forEach(exit => {
                // Buscar la entrada correspondiente (sin usar aún)
                // Para cerrar un trade: Long cierra con Vender, Short cierra con Comprar
                const isClosingLong = exit.action.toLowerCase().includes('vender');
                const isClosingShort = exit.action.toLowerCase().includes('comprar');

                const entry = entries.find(e => {
                    if (usedEntries.has(e.id)) return false;
                    
                    const entryTime = new Date(this.parseDateTime(e.time));
                    const exitTime = new Date(this.parseDateTime(exit.time));
                    
                    if (entryTime >= exitTime) return false; // Entrada debe ser antes que salida
                    
                    // Verificar que coincidan los tipos
                    if (isClosingLong && e.action.toLowerCase().includes('comprar')) return true; // Long: Comprar → Vender
                    if (isClosingShort && e.action.toLowerCase().includes('vender')) return true; // Short: Vender → Comprar
                    
                    return false;
                });

                if (entry) {
                    usedEntries.add(entry.id);
                    
                    // Trade completo
                    const isLong = entry.action.toLowerCase().includes('comprar');
                    const pnl = this.calculatePnL(entry, exit, isLong);
                    const totalCommission = entry.commission + entry.fee + exit.commission + exit.fee;

                    // Formato de fecha para Supabase (YYYY-MM-DD)
                    const entryDateTime = this.parseDateTime(entry.time);
                    const exitDateTime = this.parseDateTime(exit.time);
                    const dateOnly = entryDateTime.split('T')[0];
                    
                    // Horas en formato HH:MM:SS
                    const entryTimeOnly = this.parseTime(entry.time);
                    const exitTimeOnly = this.parseTime(exit.time);

                    // P&L neto (ya incluye comisiones restadas)
                    const plNeto = pnl - totalCommission;

                    completedTrades.push({
                        id: `ninja_${entry.id}_${exit.id}`,
                        user_id: null,
                        account_id: `ninjatrader_${entry.account}`,
                        date: dateOnly,
                        instrument: entry.instrument,
                        type: isLong ? 'buy' : 'sell',
                        entry: entry.price,
                        exit: exit.price,
                        entry_time: entryTimeOnly,
                        exit_time: exitTimeOnly,
                        volume: entry.quantity,
                        result: this.calculateResult(plNeto),
                        pl: plNeto,
                        currency: 'USD',
                        notes: `NinjaTrader | Comisión: $${totalCommission.toFixed(2)} | Order: ${entry.orderId}`
                    });

                    console.log(`  ✅ Trade emparejado: ${isLong ? 'Long' : 'Short'} @ ${entry.price} → ${exit.price} = ${plNeto.toFixed(2)}`);
                } else {
                    console.warn(`  ⚠️ Salida sin entrada correspondiente: ${exit.action} @ ${exit.price}`);
                }
            });

            // Reportar entradas sin salida (posiciones abiertas)
            entries.forEach(entry => {
                if (!usedEntries.has(entry.id)) {
                    console.warn(`  ⚠️ Entrada sin salida (posición abierta): ${entry.action} @ ${entry.price}`);
                }
            });
        });

        console.log(`✅ ${completedTrades.length} trades completos encontrados`);
        return completedTrades;
    }

    /**
     * Calcular P&L según el tipo de instrumento
     */
    calculatePnL(entry, exit, isLong) {
        const priceDiff = exit.price - entry.price;
        const multiplier = this.getMultiplier(entry.instrument);
        
        if (isLong) {
            return priceDiff * entry.quantity * multiplier;
        } else {
            return -priceDiff * entry.quantity * multiplier;
        }
    }

    /**
     * Obtener multiplicador del instrumento
     */
    getMultiplier(instrument) {
        // Micro contratos
        if (instrument.includes('MNQ') || instrument.includes('Micro NQ')) return 2;   // Micro Nasdaq = $2/punto
        if (instrument.includes('MES') || instrument.includes('Micro ES')) return 5;   // Micro S&P = $5/punto
        if (instrument.includes('MYM') || instrument.includes('Micro YM')) return 0.5; // Micro Dow = $0.50/punto
        if (instrument.includes('M2K') || instrument.includes('Micro RTY')) return 5;  // Micro Russell = $5/punto

        // Contratos estándar
        if (instrument.includes('NQ')) return 20;  // Nasdaq = $20/punto
        if (instrument.includes('ES')) return 50;  // S&P = $50/punto
        if (instrument.includes('YM')) return 5;   // Dow = $5/punto
        if (instrument.includes('RTY')) return 50; // Russell = $50/punto

        // Default para futuros
        return 1;
    }

    /**
     * Parsear fecha/hora de NinjaTrader
     */
    parseDateTime(dateTimeStr) {
        // Formato: "31/12/2025 19:44:22"
        if (!dateTimeStr) return new Date().toISOString();

        try {
            const [datePart, timePart] = dateTimeStr.split(' ');
            const [day, month, year] = datePart.split('/');
            const [hours, minutes, seconds] = timePart.split(':');

            const date = new Date(year, month - 1, day, hours, minutes, seconds);
            return date.toISOString();
        } catch (error) {
            console.error('Error parseando fecha:', dateTimeStr, error);
            return new Date().toISOString();
        }
    }

    /**
     * Extraer solo la hora de un string de fecha/hora
     */
    parseTime(dateTimeStr) {
        // Formato: "31/12/2025 19:44:22" → "19:44:22"
        if (!dateTimeStr) return null;
        
        try {
            const parts = dateTimeStr.split(' ');
            return parts[1] || null; // Devolver solo la parte de hora
        } catch (error) {
            console.error('Error parseando hora:', dateTimeStr, error);
            return null;
        }
    }

    /**
     * Calcular resultado (win/loss/breakeven)
     */
    calculateResult(pnl) {
        if (pnl > 0.01) return 'win';
        if (pnl < -0.01) return 'loss';
        return 'breakeven';
    }

    /**
     * Importar trades a Supabase
     */
    async importToSupabase(trades, onProgress) {
        const user = await window.supabase.auth.getUser();
        if (!user.data.user) {
            throw new Error('Usuario no autenticado');
        }

        let imported = 0;
        const errors = [];

        for (let i = 0; i < trades.length; i++) {
            try {
                const trade = trades[i];
                
                // Obtener account_id desde Supabase si existe
                let accountId = null;
                if (trade.account_id) {
                    const { data: accountData } = await window.supabase
                        .from('accounts')
                        .select('id')
                        .eq('user_id', user.data.user.id)
                        .eq('name', trade.account_id)
                        .maybeSingle();
                    
                    if (accountData) {
                        accountId = accountData.id;
                    }
                }

                // Mapear a estructura de operations
                const operation = {
                    id: trade.id,
                    user_id: user.data.user.id,
                    account_id: accountId,
                    date: trade.date || new Date().toISOString().split('T')[0],
                    instrument: trade.instrument,
                    type: trade.type,
                    entry: trade.entry,
                    exit: trade.exit,
                    entry_time: trade.entry_time,
                    exit_time: trade.exit_time,
                    volume: trade.volume,
                    result: trade.result,
                    pl: trade.pl,
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

                console.log(`📝 Trade ${i + 1}:`, JSON.stringify(operation, null, 2));

                const { data, error } = await window.supabase
                    .from('operations')
                    .upsert(operation, { onConflict: 'id' })
                    .select()
                    .single();

                if (error) {
                    console.error(`❌ Error Supabase:`, JSON.stringify(error, null, 2));
                    throw error;
                }

                if (!data) {
                    console.error(`⚠️ Trade ${i + 1}: Upsert exitoso pero sin datos devueltos`);
                } else {
                    console.log(`✅ Trade ${i + 1} guardado exitosamente`);
                }
                
                imported++;
                
                onProgress?.({
                    current: i + 1,
                    total: trades.length,
                    imported
                });

            } catch (error) {
                errors.push({ trade: trades[i], error: error.message });
                console.error('❌ Error importando trade:', error);
                console.error('📄 Detalles del error:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code,
                    trade: trades[i]
                });
            }
        }

        return { imported, total: trades.length, errors };
    }

    /**
     * Crear cuentas de NinjaTrader si no existen
     */
    async ensureAccountsExist(accountNames, trades) {
        const user = await window.supabase.auth.getUser();
        if (!user.data.user) return;

        // Calcular balance por cuenta
        const accountBalances = new Map();
        trades.forEach(trade => {
            const accountName = trade.account_id;
            if (!accountBalances.has(accountName)) {
                accountBalances.set(accountName, 0);
            }
            accountBalances.set(accountName, accountBalances.get(accountName) + (trade.pl || 0));
        });

        for (const accountName of accountNames) {
            // Verificar si existe
            const { data: existing } = await window.supabase
                .from('accounts')
                .select('id')
                .eq('name', accountName)
                .eq('user_id', user.data.user.id)
                .maybeSingle();

            if (!existing) {
                // Crear cuenta con UUID y balance calculado
                const accountId = crypto.randomUUID();
                const balance = accountBalances.get(accountName) || 0;
                
                await window.supabase
                    .from('accounts')
                    .insert({
                        id: accountId,
                        user_id: user.data.user.id,
                        name: accountName,
                        currency: 'USD',
                        platform: 'ninjatrader',
                        balance: balance
                    });
                
                console.log(`✅ Cuenta NinjaTrader creada: ${accountName} con balance $${balance}`);
            }
        }
    }

    /**
     * Proceso completo de importación
     */
    async import(csvText, onProgress) {
        try {
            onProgress?.({ status: 'parsing', message: 'Parseando CSV...' });
            
            const parsedData = this.parseCSV(csvText);
            
            // Detectar si ya son trades completos o ejecuciones
            const areCompleteTrades = parsedData.length > 0 && parsedData[0].hasOwnProperty('pnl');
            
            let trades;
            if (areCompleteTrades) {
                // Ya vienen trades completos (formato Grid/Performance)
                console.log(`📊 Detectados ${parsedData.length} trades completos`);
                trades = parsedData;
            } else {
                // Son ejecuciones, necesitan agruparse
                onProgress?.({ 
                    status: 'grouping', 
                    message: `Agrupando ${parsedData.length} ejecuciones...` 
                });
                
                trades = this.groupIntoTrades(parsedData);
            }
            
            if (trades.length === 0) {
                return {
                    success: false,
                    message: 'No se encontraron trades completos'
                };
            }

            // Crear cuentas si no existen
            onProgress?.({ 
                status: 'accounts', 
                message: 'Verificando cuentas...'
            });
            
            await this.ensureAccountsExist(this.accounts, trades);

            onProgress?.({ 
                status: 'importing', 
                message: `Importando ${trades.length} trades...`,
                total: trades.length
            });

            const result = await this.importToSupabase(trades, onProgress);

            return {
                success: true,
                imported: result.imported,
                total: trades.length,
                accounts: Array.from(this.accounts),
                errors: result.errors
            };

        } catch (error) {
            console.error('Error en importación:', error);
            throw error;
        }
    }
}

// Exportar para uso global
window.NinjaTraderCSVImporter = NinjaTraderCSVImporter;
