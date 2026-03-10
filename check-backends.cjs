const fs = require('fs');

function check() {
    const bitunix = fs.readFileSync('api/bitunix.js', 'utf8');
    console.log('BITUNIX:\n', bitunix.includes('crypto.createHmac') ? 'DOES SERVER SIGNING' : 'CLIENT SIGNING');
    
    const bingx = fs.readFileSync('api/bingx.js', 'utf8');
    console.log('BINGX:\n', bingx.includes('crypto.createHmac') ? 'DOES SERVER SIGNING' : 'CLIENT SIGNING');

    const mexc = fs.readFileSync('api/mexc.js', 'utf8');
    console.log('MEXC:\n', mexc.includes('crypto.createHmac') || mexc.includes('URLSearchParams(finalParams).toString()') ? 'DOES SERVER SIGNING' : 'CLIENT SIGNING');
}

check();
