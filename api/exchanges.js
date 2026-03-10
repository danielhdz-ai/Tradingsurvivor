// Vercel Serverless Function — Proxy unificado para todos los exchanges
// Rutas: /api/bingx, /api/bitget, /api/mexc, /api/lbank, /api/bitunix
// Un solo archivo = 1 función Vercel (ahorra 4 slots del plan Hobby)
import crypto from 'crypto';
import {
    rateLimiters,
    fetchWithRetry,
    validateExchangeResponse,
    getServerTime,
    generateEchostr,
    setCorsHeaders
} from './_utils.js';

function detectExchange(url) {
    if (url.includes('/api/bingx'))   return 'bingx';
    if (url.includes('/api/bitget'))  return 'bitget';
    if (url.includes('/api/mexc'))    return 'mexc';
    if (url.includes('/api/lbank'))   return 'lbank';
    if (url.includes('/api/bitunix')) return 'bitunix';
    if (url.includes('/api/bybit'))   return 'bybit';
    if (url.includes('/api/binance')) return 'binance';
    if (url.includes('/api/okx'))     return 'okx';
    if (url.includes('/api/gate'))    return 'gate';
    if (url.includes('/api/phemex'))  return 'phemex';
    if (url.includes('/api/bitmart')) return 'bitmart';
    return null;
}

export default async function handler(req, res) {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const exchange = detectExchange(req.url);
    if (!exchange) return res.status(400).json({ success: false, error: 'Unknown exchange' });

    try {
        switch (exchange) {
            case 'bingx':   return await handleBingX(req, res);
            case 'bitget':  return await handleBitget(req, res);
            case 'mexc':    return await handleMEXC(req, res);
            case 'lbank':   return await handleLBank(req, res);
            case 'bitunix': return await handleBitunix(req, res);
            case 'bybit':   return await handleBybit(req, res);
            case 'binance': return await handleBinance(req, res);
            case 'okx':     return await handleOKX(req, res);
            case 'gate':    return await handleGate(req, res);
            case 'phemex':  return await handlePhemex(req, res);
            case 'bitmart': return await handleBitmart(req, res);
        }
    } catch (error) {
        console.error(`❌ exchanges.js [${exchange}] Error:`, error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// BINGX
// ─────────────────────────────────────────────────────────────────────────────
async function handleBingX(req, res) {
    await rateLimiters.bingx.throttle();

    let fullPath = req.url;
    if (fullPath.startsWith('/api/bingx')) fullPath = fullPath.replace('/api/bingx', '');

    const [endpoint, queryPart] = fullPath.split('?');
    const apiKey    = req.headers['x-api-key'];
    const secretKey = req.headers['x-secret-key'];

    // Llamada pública
    if (!apiKey || !secretKey) {
        const url = `https://open-api.bingx.com${endpoint}${queryPart ? '?' + queryPart : ''}`;
        const result = await fetchWithRetry(url, { method: req.method, headers: { 'Content-Type': 'application/json' } });
        if (!result.ok) return res.status(result.status).json(result.error);
        return res.json(result.data);
    }

    console.log('🔐 BingX Auth:', endpoint, apiKey.substring(0, 10) + '...');

    const timestamp     = (await getServerTime('bingx')).toString();
    const existingParams = queryPart ? Object.fromEntries(new URLSearchParams(queryPart)) : {};
    const allParams     = { ...existingParams, timestamp };
    const sortedKeys    = Object.keys(allParams).sort();
    const queryParams   = sortedKeys.map(k => `${k}=${allParams[k]}`).join('&');

    const signature = crypto.createHmac('sha256', secretKey).update(queryParams).digest('hex');
    const url       = `https://open-api.bingx.com${endpoint}?${queryParams}&signature=${signature}`;

    const result = await fetchWithRetry(url, {
        method: req.method,
        headers: { 'X-BX-APIKEY': apiKey, 'Content-Type': 'application/json' },
        body: req.method === 'POST' && req.body ? JSON.stringify(req.body) : undefined
    });

    if (!result.ok) return res.status(result.status).json(result.error);

    const validation = validateExchangeResponse(result.data, 'bingx');
    if (!validation.success) return res.status(400).json({ success: false, error: validation.error, code: validation.code });

    return res.json(result.data);
}

// ─────────────────────────────────────────────────────────────────────────────
// BITGET
// ─────────────────────────────────────────────────────────────────────────────
async function handleBitget(req, res) {
    await rateLimiters.bitget.throttle();

    let endpoint = req.url;
    if (endpoint.startsWith('/api/bitget')) endpoint = endpoint.replace('/api/bitget', '');

    const apiKey     = req.headers['x-api-key'];
    const secretKey  = req.headers['x-secret-key'];
    const passphrase = req.headers['x-passphrase'];

    if (!apiKey || !secretKey || !passphrase) {
        return res.status(400).json({ success: false, error: 'Faltan headers x-api-key, x-secret-key, x-passphrase' });
    }

    const method = req.method.toUpperCase();
    let serverTime;
    try { serverTime = await getServerTime('bitget'); } catch { serverTime = Date.now(); }
    const timestamp = serverTime.toString();

    let bodyStr = '';
    if (method === 'POST' && req.body && Object.keys(req.body).length > 0) {
        bodyStr = JSON.stringify(req.body);
    }

    const prehash   = timestamp + method + endpoint + bodyStr;
    const signature = crypto.createHmac('sha256', secretKey).update(prehash).digest('base64');
    const url       = 'https://api.bitget.com' + endpoint;

    const fetchOptions = {
        method,
        headers: {
            'ACCESS-KEY':       apiKey,
            'ACCESS-SIGN':      signature,
            'ACCESS-TIMESTAMP': timestamp,
            'ACCESS-PASSPHRASE': passphrase,
            'Content-Type':     'application/json',
            'locale':           'en-US'
        }
    };
    if (bodyStr) fetchOptions.body = bodyStr;

    const result = await fetchWithRetry(url, fetchOptions);
    if (!result.ok) return res.status(result.status).json(result.error);

    const validation = validateExchangeResponse(result.data, 'bitget');
    if (!validation.success) return res.status(400).json({ success: false, error: validation.error, code: validation.code });

    return res.json(result.data);
}

// ─────────────────────────────────────────────────────────────────────────────
// MEXC
// ─────────────────────────────────────────────────────────────────────────────
async function handleMEXC(req, res) {
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
    }

    await rateLimiters.mexc.throttle();

    const { apiKey, secretKey, endpoint, params = {} } = req.body;
    if (!apiKey || !secretKey || !endpoint) {
        return res.status(400).json({ success: false, error: 'Faltan apiKey, secretKey o endpoint en el body' });
    }

    const timestamp    = (await getServerTime('mexc')).toString();
    const sortedParams = Object.keys(params).sort().reduce((acc, key) => { acc[key] = params[key]; return acc; }, {});
    const queryString  = new URLSearchParams(sortedParams).toString();

    const signString = `${apiKey}${timestamp}${queryString}`;
    const signature  = crypto.createHmac('sha256', secretKey).update(signString).digest('hex');

    const url = `https://contract.mexc.com${endpoint}${queryString ? '?' + queryString : ''}`;
    console.log('🌐 MEXC Request:', url);

    const result = await fetchWithRetry(url, {
        method: 'GET',
        headers: {
            'ApiKey':       apiKey,
            'Request-Time': timestamp,
            'Signature':    signature,
            'Content-Type': 'application/json'
        }
    });

    if (!result.ok) return res.status(result.status).json(result.error);

    const validation = validateExchangeResponse(result.data, 'mexc');
    if (!validation.success) return res.status(400).json({ success: false, error: validation.error, code: validation.code });

    return res.json(result.data);
}

// ─────────────────────────────────────────────────────────────────────────────
// LBANK
// ─────────────────────────────────────────────────────────────────────────────
async function handleLBank(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
    }

    await rateLimiters.lbank.throttle();

    const { apiKey, privateKey, endpoint, params = {} } = req.body;
    if (!apiKey || !privateKey || !endpoint) {
        return res.status(400).json({ success: false, error: 'Faltan apiKey, privateKey o endpoint en el body' });
    }

    const lbankTimestamp = (await getServerTime('lbank')).toString();
    const echostr        = generateEchostr(35);

    const finalParams = {
        ...params,
        api_key:          apiKey,
        timestamp:        lbankTimestamp,
        signature_method: 'RSA',
        echostr
    };

    const sortedKeys  = Object.keys(finalParams).sort();
    const signString  = sortedKeys.map(k => `${k}=${finalParams[k]}`).join('&');
    const md5Hash     = crypto.createHash('md5').update(signString).digest('hex').toUpperCase();

    let signature = '';
    try {
        const signer = crypto.createSign('RSA-SHA256');
        signer.update(md5Hash);
        let formattedKey = privateKey;
        if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----')) {
            formattedKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
        }
        signature = signer.sign(formattedKey, 'base64');
    } catch (keyError) {
        console.error('❌ LBank RSA key error:', keyError);
        return res.status(400).json({ success: false, error: 'Formato de clave privada RSA inválido. Incluye -----BEGIN PRIVATE KEY-----' });
    }

    finalParams.sign = signature;

    const url    = `https://api.lbank.info${endpoint}`;
    const result = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    new URLSearchParams(finalParams).toString()
    });

    if (!result.ok) return res.status(result.status).json({ success: false, error: `LBank API error: ${result.status}`, details: result.error });

    const validation = validateExchangeResponse(result.data, 'lbank');
    if (!validation.success) return res.status(400).json({ success: false, error: validation.error, code: validation.code });

    return res.json(result.data);
}

// ─────────────────────────────────────────────────────────────────────────────
// BITUNIX
// ─────────────────────────────────────────────────────────────────────────────
async function handleBitunix(req, res) {
    await rateLimiters.bitunix.throttle();

    let fullPath = req.url;
    if (fullPath.startsWith('/api/bitunix')) fullPath = fullPath.replace('/api/bitunix', '');

    const [path, queryPart] = fullPath.split('?');
    const apiKey    = req.headers['x-api-key'];
    const secretKey = req.headers['x-secret-key'];

    // Llamada pública
    if (!apiKey || !secretKey) {
        const url      = `https://api.bitunix.com${path}${queryPart ? '?' + queryPart : ''}`;
        const response = await fetch(url, { method: req.method, headers: { 'Content-Type': 'application/json' } });
        const data     = await response.json();
        return res.json(data);
    }

    const timestamp   = Date.now().toString();
    const nonce       = crypto.randomBytes(16).toString('hex');
    const queryString = queryPart || '';
    const preHash     = nonce + apiKey + timestamp + queryString;
    const sign        = crypto.createHmac('sha256', secretKey).update(preHash).digest('hex');

    const method = req.method.toUpperCase();
    let body     = undefined;
    if (method === 'POST' && req.body && Object.keys(req.body).length > 0) {
        body = JSON.stringify(req.body);
    }

    const url    = `https://api.bitunix.com${path}${queryString ? '?' + queryString : ''}`;
    const result = await fetchWithRetry(url, {
        method,
        headers: {
            'api-key':        apiKey,
            'sign':           sign,
            'timestamp':      timestamp,
            'nonce':          nonce,
            'Content-Type':   'application/json',
            'Accept':         'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'User-Agent':     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Origin':         'https://www.bitunix.com',
            'Referer':        'https://www.bitunix.com/'
        },
        body
    });

    if (!result.ok) return res.status(result.status).json(result.error);

    console.log('✅ Bitunix response OK:', result.data?.code);
    return res.json(result.data);
}

// ─────────────────────────────────────────────────────────────────────────────
// BYBIT (V5)
// Sign: HMAC-SHA256(timestamp + apiKey + recvWindow + queryString, secretKey) → hex
// ─────────────────────────────────────────────────────────────────────────────
async function handleBybit(req, res) {
    await rateLimiters.bingx.throttle(); // reuse a limiter

    let fullPath = req.url;
    if (fullPath.startsWith('/api/bybit')) fullPath = fullPath.replace('/api/bybit', '');

    const [endpoint, queryPart] = fullPath.split('?');
    const apiKey    = req.headers['x-api-key'];
    const secretKey = req.headers['x-secret-key'];

    if (!apiKey || !secretKey) {
        // Public call
        const url = `https://api.bybit.com${endpoint}${queryPart ? '?' + queryPart : ''}`;
        const result = await fetchWithRetry(url, { method: req.method, headers: { 'Content-Type': 'application/json' } });
        if (!result.ok) return res.status(result.status).json(result.error);
        return res.json(result.data);
    }

    const timestamp  = Date.now().toString();
    const recvWindow = '5000';
    const queryString = queryPart || '';

    const preHash = timestamp + apiKey + recvWindow + queryString;
    const signature = crypto.createHmac('sha256', secretKey).update(preHash).digest('hex');

    const url = `https://api.bybit.com${endpoint}${queryString ? '?' + queryString : ''}`;
    const result = await fetchWithRetry(url, {
        method: req.method,
        headers: {
            'X-BAPI-API-KEY':    apiKey,
            'X-BAPI-SIGN':       signature,
            'X-BAPI-TIMESTAMP':  timestamp,
            'X-BAPI-RECV-WINDOW': recvWindow,
            'Content-Type':      'application/json'
        },
        body: req.method === 'POST' && req.body ? JSON.stringify(req.body) : undefined
    });

    if (!result.ok) return res.status(result.status).json(result.error);
    return res.json(result.data);
}

// ─────────────────────────────────────────────────────────────────────────────
// BINANCE FUTURES (fapi)
// Sign: HMAC-SHA256(queryString + timestamp, secretKey) → hex, appended to query
// ─────────────────────────────────────────────────────────────────────────────
async function handleBinance(req, res) {
    await rateLimiters.bingx.throttle();

    let fullPath = req.url;
    if (fullPath.startsWith('/api/binance')) fullPath = fullPath.replace('/api/binance', '');

    const [endpoint, queryPart] = fullPath.split('?');
    const apiKey    = req.headers['x-api-key'];
    const secretKey = req.headers['x-secret-key'];

    if (!apiKey || !secretKey) {
        const url = `https://fapi.binance.com${endpoint}${queryPart ? '?' + queryPart : ''}`;
        const result = await fetchWithRetry(url, { method: req.method, headers: { 'X-MBX-APIKEY': apiKey || '' } });
        if (!result.ok) return res.status(result.status).json(result.error);
        return res.json(result.data);
    }

    const timestamp   = Date.now().toString();
    const existingQS  = queryPart || '';
    const queryToSign = existingQS ? `${existingQS}&timestamp=${timestamp}` : `timestamp=${timestamp}`;
    const signature   = crypto.createHmac('sha256', secretKey).update(queryToSign).digest('hex');

    const url = `https://fapi.binance.com${endpoint}?${queryToSign}&signature=${signature}`;
    const result = await fetchWithRetry(url, {
        method: req.method,
        headers: { 'X-MBX-APIKEY': apiKey, 'Content-Type': 'application/json' }
    });

    if (!result.ok) return res.status(result.status).json(result.error);
    return res.json(result.data);
}

// ─────────────────────────────────────────────────────────────────────────────
// OKX
// Sign: HMAC-SHA256(timestamp + method + path + body, secretKey) → base64
// ─────────────────────────────────────────────────────────────────────────────
async function handleOKX(req, res) {
    await rateLimiters.bitget.throttle();

    let endpoint = req.url;
    if (endpoint.startsWith('/api/okx')) endpoint = endpoint.replace('/api/okx', '');

    const apiKey     = req.headers['x-api-key'];
    const secretKey  = req.headers['x-secret-key'];
    const passphrase = req.headers['x-passphrase'];

    if (!apiKey || !secretKey || !passphrase) {
        return res.status(400).json({ success: false, error: 'Faltan headers x-api-key, x-secret-key, x-passphrase' });
    }

    const method    = req.method.toUpperCase();
    const timestamp = new Date().toISOString(); // ISO 8601 required by OKX
    let bodyStr = '';
    if (method === 'POST' && req.body && Object.keys(req.body).length > 0) {
        bodyStr = JSON.stringify(req.body);
    }

    const prehash   = timestamp + method + endpoint + bodyStr;
    const signature = crypto.createHmac('sha256', secretKey).update(prehash).digest('base64');

    const url    = 'https://www.okx.com' + endpoint;
    const result = await fetchWithRetry(url, {
        method,
        headers: {
            'OK-ACCESS-KEY':        apiKey,
            'OK-ACCESS-SIGN':       signature,
            'OK-ACCESS-TIMESTAMP':  timestamp,
            'OK-ACCESS-PASSPHRASE': passphrase,
            'Content-Type':         'application/json',
            'x-simulated-trading':  '0'
        },
        body: bodyStr || undefined
    });

    if (!result.ok) return res.status(result.status).json(result.error);
    return res.json(result.data);
}

// ─────────────────────────────────────────────────────────────────────────────
// GATE.IO FUTURES
// Sign: HMAC-SHA512("GET\n" + path + "\n" + sha512(body) + "\n" + timestamp, secret) → hex
// ─────────────────────────────────────────────────────────────────────────────
async function handleGate(req, res) {
    await rateLimiters.mexc.throttle();

    let fullPath = req.url;
    if (fullPath.startsWith('/api/gate')) fullPath = fullPath.replace('/api/gate', '');

    const [endpoint, queryPart] = fullPath.split('?');
    const apiKey    = req.headers['x-api-key'];
    const secretKey = req.headers['x-secret-key'];

    if (!apiKey || !secretKey) {
        const url = `https://api.gateio.ws${endpoint}${queryPart ? '?' + queryPart : ''}`;
        const result = await fetchWithRetry(url, { method: req.method });
        if (!result.ok) return res.status(result.status).json(result.error);
        return res.json(result.data);
    }

    const method    = req.method.toUpperCase();
    const body      = (method === 'POST' && req.body) ? JSON.stringify(req.body) : '';
    const bodyHash  = crypto.createHash('sha512').update(body).digest('hex');
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const path      = endpoint + (queryPart ? `?${queryPart}` : '');

    const signString = `${method}\n${path}\n${bodyHash}\n${timestamp}`;
    const signature  = crypto.createHmac('sha512', secretKey).update(signString).digest('hex');

    const url    = `https://api.gateio.ws${path}`;
    const result = await fetchWithRetry(url, {
        method,
        headers: {
            'KEY':           apiKey,
            'SIGN':          signature,
            'Timestamp':     timestamp,
            'Content-Type':  'application/json',
            'Accept':        'application/json'
        },
        body: body || undefined
    });

    if (!result.ok) return res.status(result.status).json(result.error);
    return res.json(result.data);
}

// ─────────────────────────────────────────────────────────────────────────────
// PHEMEX
// Sign: HMAC-SHA256(path + queryString + expiry, secretKey) → hex
// ─────────────────────────────────────────────────────────────────────────────
async function handlePhemex(req, res) {
    await rateLimiters.bingx.throttle();

    let fullPath = req.url;
    if (fullPath.startsWith('/api/phemex')) fullPath = fullPath.replace('/api/phemex', '');

    const [endpoint, queryPart] = fullPath.split('?');
    const apiKey    = req.headers['x-api-key'];
    const secretKey = req.headers['x-secret-key'];

    if (!apiKey || !secretKey) {
        const url = `https://api.phemex.com${endpoint}${queryPart ? '?' + queryPart : ''}`;
        const result = await fetchWithRetry(url, { method: req.method });
        if (!result.ok) return res.status(result.status).json(result.error);
        return res.json(result.data);
    }

    const expiry     = (Math.floor(Date.now() / 1000) + 60).toString(); // +60s
    const queryString = queryPart || '';
    const preHash    = endpoint + queryString + expiry;
    const signature  = crypto.createHmac('sha256', secretKey).update(preHash).digest('hex');

    const url    = `https://api.phemex.com${endpoint}${queryString ? '?' + queryString : ''}`;
    const result = await fetchWithRetry(url, {
        method: req.method,
        headers: {
            'x-phemex-access-token':      apiKey,
            'x-phemex-request-signature': signature,
            'x-phemex-request-expiry':    expiry,
            'Content-Type':               'application/json'
        }
    });

    if (!result.ok) return res.status(result.status).json(result.error);
    return res.json(result.data);
}

// ─────────────────────────────────────────────────────────────────────────────
// BITMART FUTURES
// Sign: HMAC-SHA256(timestamp + "#" + memo + "#" + queryString, secretKey) → hex
// ─────────────────────────────────────────────────────────────────────────────
async function handleBitmart(req, res) {
    await rateLimiters.bingx.throttle();

    let fullPath = req.url;
    if (fullPath.startsWith('/api/bitmart')) fullPath = fullPath.replace('/api/bitmart', '');

    const [endpoint, queryPart] = fullPath.split('?');
    const apiKey    = req.headers['x-api-key'];
    const secretKey = req.headers['x-secret-key'];
    const memo      = req.headers['x-passphrase'] || ''; // Bitmart uses "memo" (same header)

    if (!apiKey || !secretKey) {
        const url = `https://api-cloud.bitmart.com${endpoint}${queryPart ? '?' + queryPart : ''}`;
        const result = await fetchWithRetry(url, { method: req.method });
        if (!result.ok) return res.status(result.status).json(result.error);
        return res.json(result.data);
    }

    const timestamp   = Date.now().toString();
    const queryString = queryPart || '';
    const method      = req.method.toUpperCase();
    let bodyStr = '';
    if (method === 'POST' && req.body && Object.keys(req.body).length > 0) {
        bodyStr = JSON.stringify(req.body);
    }
    const signRaw  = method === 'GET'
        ? `${timestamp}#${memo}#${queryString}`
        : `${timestamp}#${memo}#${bodyStr}`;

    const signature = crypto.createHmac('sha256', secretKey).update(signRaw).digest('hex');

    const url    = `https://api-cloud.bitmart.com${endpoint}${queryString ? '?' + queryString : ''}`;
    const result = await fetchWithRetry(url, {
        method,
        headers: {
            'X-BM-KEY':       apiKey,
            'X-BM-SIGN':      signature,
            'X-BM-TIMESTAMP': timestamp,
            'Content-Type':   'application/json'
        },
        body: bodyStr || undefined
    });

    if (!result.ok) return res.status(result.status).json(result.error);
    return res.json(result.data);
}

