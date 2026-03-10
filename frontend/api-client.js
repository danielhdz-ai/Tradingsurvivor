// =====================================================
// HELPER PARA LLAMADAS AUTENTICADAS AL BACKEND
// Usar en el frontend para llamar a las APIs
// =====================================================

/**
 * Cliente API con autenticación automática
 */
class AuthenticatedAPI {
    constructor() {
        this.baseURL = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000' 
            : 'https://tradersurvivir.vercel.app'; // ← Cambiar por tu URL de Vercel
    }

    /**
     * Obtener token de sesión actual
     */
    async getToken() {
        if (!window.supabase) {
            throw new Error('Supabase no está inicializado');
        }

        const { data: { session }, error } = await window.supabase.auth.getSession();
        
        if (error || !session) {
            throw new Error('No hay sesión activa. Por favor inicia sesión.');
        }

        return session.access_token;
    }

    /**
     * Hacer request autenticado
     */
    async request(endpoint, options = {}) {
        try {
            const token = await this.getToken();

            const defaultHeaders = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };

            const response = await fetch(`${this.baseURL}${endpoint}`, {
                ...options,
                headers: {
                    ...defaultHeaders,
                    ...options.headers
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            return data;

        } catch (error) {
            console.error(`❌ Error en ${endpoint}:`, error);
            throw error;
        }
    }

    // ============================================
    // CREDENCIALES
    // ============================================

    /**
     * Guardar credenciales de exchange
     */
    async saveCredentials(platform, apiKey, secretKey, passphrase = null, accountId = null) {
        return this.request('/api/credentials/save', {
            method: 'POST',
            body: JSON.stringify({
                platform,
                api_key: apiKey,
                secret_key: secretKey,
                passphrase,
                account_id: accountId
            })
        });
    }

    /**
     * Obtener credenciales de exchange
     */
    async getCredentials(platform, accountId = null) {
        const params = new URLSearchParams({ platform });
        if (accountId) params.append('account_id', accountId);
        
        return this.request(`/api/credentials/get?${params}`);
    }

    /**
     * Listar todas las credenciales
     */
    async listCredentials() {
        return this.request('/api/credentials/list');
    }

    // ============================================
    // OPERACIONES
    // ============================================

    /**
     * Crear operación
     */
    async createOperation(operation) {
        return this.request('/api/operations/create', {
            method: 'POST',
            body: JSON.stringify(operation)
        });
    }

    /**
     * Listar operaciones
     */
    async listOperations(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/api/operations/list?${params}`);
    }

    /**
     * Actualizar operación
     */
    async updateOperation(id, updates) {
        return this.request('/api/operations/update', {
            method: 'PUT',
            body: JSON.stringify({ id, ...updates })
        });
    }

    /**
     * Eliminar operación
     */
    async deleteOperation(id) {
        return this.request(`/api/operations/delete?id=${id}`, {
            method: 'DELETE'
        });
    }

    // ============================================
    // BINGX
    // ============================================

    /**
     * Llamar a BingX API
     */
    async bingx(endpoint, params = {}, accountId = null) {
        return this.request('/api/bingx', {
            method: 'POST',
            body: JSON.stringify({
                endpoint,
                params,
                account_id: accountId
            })
        });
    }

    /**
     * Obtener historial de trades de BingX
     */
    async getBingXTrades(symbol = '', limit = 100, accountId = null) {
        return this.bingx('/openApi/swap/v2/trade/allOrders', {
            symbol,
            pageSize: limit,
            pageIndex: 1
        }, accountId);
    }

    /**
     * Obtener balance de BingX
     */
    async getBingXBalance(accountId = null) {
        return this.bingx('/openApi/swap/v2/user/balance', {}, accountId);
    }

    // ============================================
    // BITGET
    // ============================================

    /**
     * Llamar a Bitget API
     */
    async bitget(method, endpoint, body = '', accountId = null) {
        return this.request('/api/bitget', {
            method: 'POST',
            body: JSON.stringify({
                method,
                endpoint,
                body,
                account_id: accountId
            })
        });
    }

    /**
     * Obtener historial de trades de Bitget
     */
    async getBitgetTrades(productType = 'USDT-FUTURES', symbol = '', accountId = null) {
        return this.bitget('GET', `/api/v2/mix/order/fills`, '', accountId);
    }

    // ============================================
    // MEXC
    // ============================================

    /**
     * Llamar a MEXC API
     */
    async mexc(endpoint, params = {}, accountId = null) {
        return this.request('/api/mexc', {
            method: 'POST',
            body: JSON.stringify({
                endpoint,
                params,
                account_id: accountId
            })
        });
    }

    /**
     * Obtener historial de trades de MEXC
     */
    async getMEXCTrades(symbol = '', limit = 100, accountId = null) {
        return this.mexc('/api/v1/private/order/list/history_orders', {
            page_num: 1,
            page_size: limit,
            symbol
        }, accountId);
    }
}

// Crear instancia global
window.api = new AuthenticatedAPI();

console.log('✅ Cliente API autenticado listo: window.api');

// Ejemplos de uso:
/*

// 1. Guardar credenciales
await api.saveCredentials('bingx', 'mi-api-key', 'mi-secret-key', null, 'cuenta-1');

// 2. Sincronizar trades de BingX
const trades = await api.getBingXTrades('BTC-USDT', 100, 'cuenta-1');

// 3. Crear operación manual
await api.createOperation({
    id: 'manual-001',
    instrument: 'EURUSD',
    type: 'buy',
    entry: 1.0850,
    exit: 1.0920,
    volume: 1.0,
    pl: 70,
    currency: 'USD',
    date: '2025-12-28',
    account_id: 'demo-account'
});

// 4. Listar operaciones
const ops = await api.listOperations({ 
    account_id: 'cuenta-1',
    date_from: '2025-01-01',
    date_to: '2025-12-31'
});

*/
