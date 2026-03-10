// Vercel Serverless Function - AI Coach para TradingSurvivor
// Llama a Groq (gratuito) con el contexto de stats del trader y devuelve consejos personalizados

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    try {
        const { message, stats, history } = req.body;

        if (!message) return res.status(400).json({ error: 'Mensaje requerido' });

        const GROQ_API_KEY = process.env.GROQ_API_KEY;
        if (!GROQ_API_KEY) return res.status(500).json({ error: 'API key de Groq no configurada en Vercel' });

        // Construir contexto completo con todas las tablas de datos del trader
        const fmt = (arr, cols) => (arr || []).slice(0, 12).map(row =>
            cols.map(c => `${c}:${typeof row[c] === 'number' ? '$' + row[c].toFixed(2) : row[c]}`).join(' | ')
        ).join('\n') || 'Sin datos';

        const statsContext = stats ? `
ANALIZANDO CUENTA: ${stats.accountName}

RESUMEN GENERAL (${stats.totalTrades} operaciones):
- P&L Neto: $${stats.netPL?.toFixed(2)}
- Win Rate: ${stats.winRate?.toFixed(1)}%
- Profit Factor: ${stats.profitFactor?.toFixed(2)}
- R:R Ratio: ${stats.rrRatio?.toFixed(2)}
- Avg Ganancia: $${stats.avgWin?.toFixed(2)} | Avg Pérdida: $${stats.avgLoss?.toFixed(2)}
- Drawdown máximo: ${stats.maxDrawdown?.toFixed(1)}%
- Racha max ganadora: ${stats.maxWinStreak} | Racha max perdedora: ${stats.maxLossStreak}
- Racha ACTUAL: ${stats.currentStreak}

RENDIMIENTO POR INSTRUMENTO/ACTIVO:
${fmt(stats.instrumentRanking, ['name', 'pl', 'trades', 'wr'])}

RENDIMIENTO POR SETUP:
${fmt(stats.setupRanking, ['setup', 'pl', 'trades', 'wr', 'pf'])}

RENDIMIENTO POR HORA DE ENTRADA:
Top mejores: ${(stats.hourRanking || []).slice(0, 5).map(h => `${h.hour}($${h.pl.toFixed(0)},WR${h.wr},${h.trades}t)`).join(' | ')}
Top peores: ${(stats.hourRanking || []).slice(-5).reverse().map(h => `${h.hour}($${h.pl.toFixed(0)},WR${h.wr},${h.trades}t)`).join(' | ')}

RENDIMIENTO POR DÍA DE SEMANA:
${(stats.dayRanking || []).map(d => `${d.day}: $${d.pl.toFixed(2)} (${d.trades}t, WR ${d.wr})`).join(' | ')}

RENDIMIENTO POR SESIÓN:
${(stats.sessionRanking || []).map(s => `${s.session}: $${s.pl.toFixed(2)} (${s.trades}t, WR ${s.wr})`).join(' | ')}

EVOLUCIÓN MENSUAL:
${(stats.monthRanking || []).map(m => `${m.month}: $${m.pl.toFixed(2)} (${m.trades}t, WR ${m.wr})`).join('\n')}

MEJORES 3 TRADES: ${(stats.topTrades || []).map(t => `${t.date} ${t.instrument} +$${t.pl.toFixed(2)}`).join(' | ')}
PEORES 3 TRADES: ${(stats.worstTrades || []).map(t => `${t.date} ${t.instrument} $${t.pl.toFixed(2)}`).join(' | ')}

ÚLTIMOS 15 TRADES (recientes primero):
${(stats.recentTrades || []).map(t => `${t.date} ${t.instrument} ${t.result} $${t.pl.toFixed(2)} [${t.session}][${t.setup}]`).join('\n')}
` : 'No hay datos de operaciones disponibles aún. Pide al trader que registre sus trades primero.';

        // Historial del chat para mantener contexto conversacional
        const conversationHistory = (history || []).slice(-8).map(m => ({
            role: m.role,
            content: m.content
        }));

        const messages = [
            {
                role: 'system',
                content: `Eres un coach de trading profesional de élite integrado en TradingSurvivor. Tu nombre es "Coach TS". Tienes acceso completo al historial real de operaciones del trader con desgloses por instrumento, setup, hora, día, sesión, mes y los últimos 15 trades.

INSTRUCCIONES CLAVE:
- Responde SIEMPRE en español
- Usa SIEMPRE los datos específicos del trader — NUNCA des consejos genéricos sin datos reales
- Cita cifras concretas: porcentajes, P&L exacto, win rates
- Analiza patrones cruzados: ej. "los miércoles con el setup X pierdes consistentemente"
- Sé directo y honesto: si algo está mal, dílo claramente con los números que lo prueban
- Si preguntan por un activo → usa la tabla de instrumentos
- Si preguntan por día, hora o setup → usa la tabla correspondiente con todos los datos
- Si preguntan por tendencia reciente → analiza los últimos 15 trades
- Detecta anomalías: setups con WR bajo, horas perdedoras, meses en regresión
- Identifica inconsistencias: ej. WR alto pero profit factor bajo → problema de RR
- Máximo 300 palabras salvo que pidan un análisis completo detallado
- Usa emojis con moderación

${statsContext}`
            },
            ...conversationHistory,
            {
                role: 'user',
                content: message
            }
        ];

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages,
                max_tokens: 800,
                temperature: 0.6
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            console.error('❌ Groq error:', errData);
            return res.status(500).json({ error: 'Error al contactar Groq', details: errData });
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content ?? 'No se pudo generar respuesta.';

        return res.status(200).json({ reply });

    } catch (error) {
        console.error('❌ Error en ai-coach (Groq):', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
}
