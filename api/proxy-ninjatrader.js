// =====================================================
// API: NINJATRADER WEBHOOK
// POST /api/proxy-ninjatrader
// Recibe trades de NinjaTrader y los guarda automáticamente
// =====================================================

import { createClient } from '@supabase/supabase-js';

// Inicializar Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false, 
            error: 'Method not allowed. Use POST.' 
        });
    }

    try {
        // Autenticación por API Key
        const apiKey = req.headers['x-api-key'] || req.body.apiKey;
        
        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: 'API Key requerida. Incluye X-API-Key en headers o apiKey en body'
            });
        }

        // Verificar API Key y obtener usuario
        const { data: credential, error: credError } = await supabase
            .from('api_credentials')
            .select('user_id, account_id')
            .eq('platform', 'ninjatrader')
            .eq('api_key', apiKey)
            .eq('is_active', true)
            .single();

        if (credError || !credential) {
            return res.status(401).json({
                success: false,
                error: 'API Key inválida o inactiva'
            });
        }

        const userId = credential.user_id;
        const accountId = credential.account_id || 'NinjaTrader';

        // Extraer datos del trade
        const trade = req.body;

        // Validar datos mínimos requeridos
        if (!trade.instrument || !trade.action) {
            return res.status(400).json({
                success: false,
                error: 'Faltan campos requeridos: instrument, action'
            });
        }

        // Mapear datos de NinjaTrader a formato de Trader Survivor
        const operation = {
            id: trade.orderId || `ninja_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            user_id: userId,
            account_id: accountId,
            platform: 'ninjatrader',
            
            // Información básica
            instrument: trade.instrument || trade.symbol,
            type: mapTradeType(trade.action), // 'buy' o 'sell'
            
            // Precios y cantidades
            entry_price: parseFloat(trade.entryPrice || trade.avgFillPrice || 0),
            exit_price: parseFloat(trade.exitPrice || 0),
            quantity: parseFloat(trade.quantity || trade.filledQuantity || 0),
            
            // P&L
            pnl: parseFloat(trade.realizedPnL || trade.pnl || 0),
            commission: parseFloat(trade.commission || 0),
            
            // Fechas
            entry_date: trade.entryTime || trade.time || new Date().toISOString(),
            exit_date: trade.exitTime || (trade.exitPrice ? new Date().toISOString() : null),
            
            // Metadata
            status: trade.exitPrice ? 'closed' : 'open',
            notes: trade.notes || `Auto-importado desde NinjaTrader`,
            strategy: trade.strategy || null,
            
            // Timestamps
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            
            // Datos adicionales de NinjaTrader
            metadata: {
                orderType: trade.orderType,
                timeInForce: trade.timeInForce,
                executionId: trade.executionId,
                orderId: trade.orderId,
                raw: trade
            }
        };

        // Calcular resultado si el trade está cerrado
        if (operation.exit_price && operation.entry_price) {
            const pnlWithoutCommission = operation.pnl + (operation.commission || 0);
            
            if (pnlWithoutCommission > 0.01) {
                operation.result = 'win';
            } else if (pnlWithoutCommission < -0.01) {
                operation.result = 'loss';
            } else {
                operation.result = 'breakeven';
            }
        }

        // Insertar o actualizar operación
        const { data, error } = await supabase
            .from('operations')
            .upsert(operation, { 
                onConflict: 'id',
                returning: 'representation'
            })
            .select()
            .single();

        if (error) {
            console.error('❌ Error guardando operación de NinjaTrader:', error);
            throw error;
        }

        console.log(`✅ Trade de NinjaTrader guardado: ${data.id} - ${data.instrument} ${data.type}`);

        return res.status(200).json({
            success: true,
            message: 'Trade guardado exitosamente',
            data: {
                id: data.id,
                instrument: data.instrument,
                type: data.type,
                pnl: data.pnl,
                status: data.status
            }
        });

    } catch (error) {
        console.error('❌ Error en NinjaTrader webhook:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Error procesando trade de NinjaTrader'
        });
    }
}

// Función helper para mapear el tipo de trade
function mapTradeType(action) {
    if (!action) return 'buy';
    
    const actionLower = action.toLowerCase();
    
    if (actionLower.includes('buy') || actionLower.includes('long')) {
        return 'buy';
    } else if (actionLower.includes('sell') || actionLower.includes('short')) {
        return 'sell';
    }
    
    return 'buy';
}
