// Test rápido de APIs sin servidor
// Ejecutar: node test-apis.js

import { getServerTime, validateExchangeResponse, rateLimiters } from './api/_utils.js';

console.log('\n🧪 TESTING EXCHANGE APIs\n');
console.log('='.repeat(50));

// Test 1: getServerTime
async function testServerTime() {
    console.log('\n📅 TEST 1: Server Time Sync');
    console.log('-'.repeat(50));
    
    const exchanges = ['lbank', 'bingx', 'bitget', 'mexc', 'bitunix'];
    
    for (const exchange of exchanges) {
        try {
            const time = await getServerTime(exchange);
            const date = new Date(time);
            console.log(`✅ ${exchange.toUpperCase()}: ${date.toISOString()}`);
        } catch (error) {
            console.log(`❌ ${exchange.toUpperCase()}: ${error.message}`);
        }
    }
}

// Test 2: Validate Response
function testValidateResponse() {
    console.log('\n📋 TEST 2: Response Validation');
    console.log('-'.repeat(50));
    
    // Bitget success
    const bitgetOk = { code: '00000', data: { balance: 1000 } };
    const result1 = validateExchangeResponse(bitgetOk, 'bitget');
    console.log(`Bitget OK: ${result1.success ? '✅' : '❌'}`);
    
    // Bitget error
    const bitgetErr = { code: '40001', msg: 'Invalid signature' };
    const result2 = validateExchangeResponse(bitgetErr, 'bitget');
    console.log(`Bitget Error: ${!result2.success ? '✅' : '❌'} (${result2.error})`);
    
    // BingX success
    const bingxOk = { code: 0, msg: 'success', data: {} };
    const result3 = validateExchangeResponse(bingxOk, 'bingx');
    console.log(`BingX OK: ${result3.success ? '✅' : '❌'}`);
    
    // MEXC success
    const mexcOk = { code: 200, data: {} };
    const result4 = validateExchangeResponse(mexcOk, 'mexc');
    console.log(`MEXC OK: ${result4.success ? '✅' : '❌'}`);
}

// Test 3: Rate Limiters
function testRateLimiters() {
    console.log('\n⏱️  TEST 3: Rate Limiters');
    console.log('-'.repeat(50));
    
    console.log('✅ LBank: ', rateLimiters.lbank ? 'Exists' : 'Missing');
    console.log('✅ BingX: ', rateLimiters.bingx ? 'Exists' : 'Missing');
    console.log('✅ Bitget:', rateLimiters.bitget ? 'Exists' : 'Missing');
    console.log('✅ Bitunix:', rateLimiters.bitunix ? 'Exists' : 'Missing');
    console.log('✅ MEXC:  ', rateLimiters.mexc ? 'Exists' : 'Missing');
}

// Test 4: Check imports
async function testImports() {
    console.log('\n📦 TEST 4: API Files Import Check');
    console.log('-'.repeat(50));
    
    const apis = [
        { name: 'BingX', path: './api/bingx.js' },
        { name: 'Bitget', path: './api/bitget.js' },
        { name: 'Bitunix', path: './api/bitunix.js' },
        { name: 'MEXC', path: './api/mexc.js' },
        { name: 'LBank', path: './api/lbank.js' }
    ];
    
    for (const api of apis) {
        try {
            const module = await import(api.path);
            const hasHandler = typeof module.default === 'function';
            console.log(`${hasHandler ? '✅' : '❌'} ${api.name}: ${hasHandler ? 'Handler OK' : 'Missing handler'}`);
        } catch (error) {
            console.log(`❌ ${api.name}: ${error.message.split('\n')[0]}`);
        }
    }
}

// Ejecutar todos los tests
async function runAllTests() {
    try {
        await testServerTime();
        testValidateResponse();
        testRateLimiters();
        await testImports();
        
        console.log('\n' + '='.repeat(50));
        console.log('✅ TESTS COMPLETADOS\n');
        console.log('💡 Para probar con datos reales, sube a Vercel o usa: vercel dev');
    } catch (error) {
        console.error('\n❌ ERROR EN TESTS:', error);
    }
}

runAllTests();
