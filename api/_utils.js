// Utilidades compartidas para todas las APIs de exchanges
// Rate Limiting, Retry Logic, Error Handling

class RateLimiter {
    constructor(maxRequests, windowMs) {
        this.requests = [];
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
    }
    
    async throttle() {
        const now = Date.now();
        // Limpiar requests antiguos
        this.requests = this.requests.filter(time => now - time < this.windowMs);
        
        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = this.requests[0];
            const waitTime = this.windowMs - (now - oldestRequest);
            console.log(`⏳ Rate limit alcanzado. Esperando ${waitTime}ms...`);
            await this.sleep(waitTime);
            return this.throttle(); // Retry después de esperar
        }
        
        this.requests.push(now);
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Rate limiters por exchange (según documentación oficial)
export const rateLimiters = {
    lbank: new RateLimiter(200, 10000),    // 200 req/10s
    bingx: new RateLimiter(500, 10000),    // 500 req/10s
    bitget: new RateLimiter(10, 1000),     // 10 req/s
    bitunix: new RateLimiter(100, 10000),  // 100 req/10s (estimado)
    mexc: new RateLimiter(100, 10000)      // 100 req/10s (estimado)
};

// Fetch con retry automático y exponential backoff
export async function fetchWithRetry(url, options = {}, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            
            // Si es rate limit (429), esperar y reintentar
            if (response.status === 429) {
                const waitTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
                console.log(`⚠️ Rate limit 429. Intento ${attempt + 1}/${maxRetries}. Esperando ${waitTime}ms...`);
                await sleep(waitTime);
                continue;
            }
            
            // Si es error de servidor (5xx), reintentar
            if (response.status >= 500) {
                const waitTime = Math.pow(2, attempt) * 1000;
                console.log(`⚠️ Error ${response.status}. Intento ${attempt + 1}/${maxRetries}. Esperando ${waitTime}ms...`);
                await sleep(waitTime);
                continue;
            }
            
            // Si no es 2xx, intentar parsear el error
            if (!response.ok) {
                let errorData;
                const contentType = response.headers.get('content-type');
                
                if (contentType && contentType.includes('application/json')) {
                    try {
                        errorData = await response.json();
                    } catch (e) {
                        errorData = { error: await response.text() };
                    }
                } else {
                    errorData = { error: await response.text() };
                }
                
                return {
                    ok: false,
                    status: response.status,
                    error: errorData
                };
            }
            
            // Success - parsear respuesta
            const data = await response.json();
            return {
                ok: true,
                status: response.status,
                data: data
            };
            
        } catch (error) {
            console.error(`❌ Fetch error (intento ${attempt + 1}/${maxRetries}):`, error.message);
            
            // Si es el último intento, lanzar el error
            if (attempt === maxRetries - 1) {
                throw error;
            }
            
            // Esperar antes del siguiente intento
            const waitTime = Math.pow(2, attempt) * 1000;
            await sleep(waitTime);
        }
    }
    
    throw new Error('Max retries alcanzado');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Validar respuesta de exchange y extraer errores
export function validateExchangeResponse(data, exchangeName) {
    // Cada exchange tiene diferentes códigos de éxito
    const successCodes = {
        lbank: ['10000', 10000, 'success'],
        bingx: [0, '0'],
        bitget: ['00000'],
        mexc: [200, 0],
        bitunix: [0, '0']
    };
    
    const codes = successCodes[exchangeName] || [0, '0'];
    
    // Verificar si el código indica éxito
    if (data.code !== undefined) {
        const isSuccess = codes.some(c => c == data.code);
        
        if (!isSuccess) {
            return {
                success: false,
                error: data.msg || data.message || 'Error desconocido',
                code: data.code
            };
        }
    }
    
    // Si tiene propiedad 'success' o 'result_code'
    if (data.success === false || data.result_code === 'error') {
        return {
            success: false,
            error: data.msg || data.message || data.error || 'Error desconocido',
            code: data.code || data.error_code
        };
    }
    
    return {
        success: true,
        data: data.data || data.result || data
    };
}

// Generar echostr para LBank (30-40 caracteres alfanuméricos)
export function generateEchostr(length = 35) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Obtener timestamp del servidor (evita errores de sincronización)
const serverTimeCache = {
    lbank: { time: 0, cachedAt: 0 },
    bingx: { time: 0, cachedAt: 0 },
    bitget: { time: 0, cachedAt: 0 },
    mexc: { time: 0, cachedAt: 0 },
    bitunix: { time: 0, cachedAt: 0 }
};

export async function getServerTime(exchange) {
    const CACHE_TTL = 30000; // 30 segundos
    const cached = serverTimeCache[exchange];
    
    if (cached && (Date.now() - cached.cachedAt) < CACHE_TTL) {
        // Usar tiempo cacheado + offset
        const offset = Date.now() - cached.cachedAt;
        return cached.time + offset;
    }
    
    try {
        let timeEndpoint;
        switch(exchange) {
            case 'lbank':
                timeEndpoint = 'https://api.lbank.info/v2/timestamp.do';
                break;
            case 'bingx':
                timeEndpoint = 'https://open-api.bingx.com/openApi/swap/v2/server/time';
                break;
            case 'bitget':
                // Usar el endpoint v2 que es más confiable
                timeEndpoint = 'https://api.bitget.com/api/v2/public/time';
                break;
            case 'mexc':
                timeEndpoint = 'https://contract.mexc.com/api/v1/contract/ping';
                break;
            case 'bitunix':
                timeEndpoint = 'https://api.bitunix.com/api/v1/time';
                break;
            default:
                return Date.now();
        }
        
        const response = await fetch(timeEndpoint);
        const data = await response.json();
        
        let serverTime;
        if (exchange === 'lbank') {
            serverTime = parseInt(data.data);
        } else if (exchange === 'bingx') {
            serverTime = data.data.serverTime;
        } else if (exchange === 'bitget') {
            // Bitget v2 devuelve { code: "00000", data: "1234567890123" }
            serverTime = parseInt(data.data);
        } else if (exchange === 'mexc') {
            serverTime = data.data?.serverTime || data.serverTime || Date.now();
        } else if (exchange === 'bitunix') {
            serverTime = data.data?.serverTime || data.serverTime || Date.now();
        }
        
        serverTimeCache[exchange] = {
            time: serverTime,
            cachedAt: Date.now()
        };
        
        console.log(`⏰ Server time ${exchange}:`, new Date(serverTime).toISOString());
        
        return serverTime;
    } catch (error) {
        console.warn(`⚠️ No se pudo obtener server time de ${exchange}, usando time local:`, error.message);
        return Date.now();
    }
}

// Headers CORS estándar
export function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-API-KEY, X-SECRET-KEY, X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization');
}
