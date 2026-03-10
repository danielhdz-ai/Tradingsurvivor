# 🔧 Solución de Errores en APIs de Exchanges

## ✅ Correcciones Aplicadas

### 1. **Bitget** - Error "Request timestamp expired" y "sign signature error"

**Problema:**
- Bitget requiere timestamp en milisegundos
- Error de sync de tiempo entre servidor y exchange

**Solución Aplicada:**
- ✅ Timestamp ahora se obtiene del servidor de Bitget directamente
- ✅ Cache de 30 segundos con offset calculado para evitar múltiples requests
- ✅ Firma HMAC-SHA256 con formato correcto: `timestamp + method + endpoint + body`

**Archivo modificado:** `api/_utils.js`

---

### 2. **Bitunix** - Error 403 "Error desconocido"

**Problema:**
- Firma incorrecta en los parámetros
- Faltaba `recvWindow` en la request
- Los parámetros no estaban siendo URL-encoded correctamente

**Solución Aplicada:**
- ✅ Agregado `recvWindow: '5000'` (ventana de 5 segundos)
- ✅ Parámetros ahora se URL-encodean con `encodeURIComponent()`
- ✅ Firma HMAC-SHA256 del query string ordenado alfabéticamente

**Archivo modificado:** `api/bitunix.js`

---

### 3. **LBank** - Credenciales se guardan pero API no responde

**Estado:** 
- ✅ La función de guardado funciona correctamente (logs confirman guardado en Supabase)
- ✅ La carga de credenciales funciona desde Supabase
- ✅ La inicialización de API funciona

**Posible problema restante:**
- Verificar que la clave privada RSA tenga el formato correcto con headers:
  ```
  -----BEGIN PRIVATE KEY-----
  [tu_clave_aqui]
  -----END PRIVATE KEY-----
  ```

**Archivo modificado:** `api/lbank.js` (agregado log adicional para debug)

---

### 4. **MEXC** - Error "Accessing IP is not in the whitelist"

**Problema:**
Este es un **error de configuración del usuario en MEXC**, NO del código.

**Solución requerida por parte del usuario:**

1. **Ir al panel de MEXC:**
   - Login → API Management → Editar tu API Key

2. **Agregar IPs de Vercel a la whitelist:**
   - Las IPs de Vercel cambian dinámicamente
   - **Recomendación:** Usar "Unrestrict API access to all IPs" (menos seguro pero funcional)
   - **O:** Agregar el rango de IPs de Vercel manualmente

3. **Permisos necesarios en MEXC:**
   - ✅ Read Permissions
   - ✅ Trading Permissions (para ver historial)
   - ❌ NO habilitar Withdrawal

**Nota:** Este error NO se puede solucionar desde el código, es una restricción de seguridad de MEXC.

---

## 🚀 Siguientes Pasos

1. **Hacer commit de los cambios:**
   ```bash
   git add api/_utils.js api/bitunix.js api/lbank.js
   git commit -m "fix: Corregir firmas y timestamps de Bitget, Bitunix y LBank"
   git push origin main
   ```

2. **Esperar deploy automático en Vercel** (1-2 minutos)

3. **Probar las conexiones:**
   - Bitget: Debería funcionar ahora con timestamp correcto
   - Bitunix: Debería funcionar con recvWindow y encoding correcto
   - LBank: Verificar formato de clave privada RSA
   - MEXC: Usuario debe configurar whitelist IP en su cuenta

---

## 📋 Checklist de Pruebas

- [ ] Bitget - Test Connection
- [ ] Bitget - Sync Trades
- [ ] Bitunix - Test Connection
- [ ] Bitunix - Sync Trades
- [ ] LBank - Verificar formato de clave RSA
- [ ] LBank - Test Connection
- [ ] LBank - Sync Trades
- [ ] MEXC - Configurar whitelist IP
- [ ] MEXC - Test Connection
- [ ] MEXC - Sync Trades

---

## 🔍 Cómo Verificar que Funcionó

### Bitget
Buscar en consola:
```
✅ Bitget API conectada
📡 Bitget Request (al proxy): GET /api/v2/mix/account/accounts
```

### Bitunix
Buscar en consola:
```
✅ Bitunix response OK
```

### LBank
Buscar en consola:
```
✅ LBank response OK
🔐 LBank echostr generado: ...
```

### MEXC
Si sigue saliendo error 406, es porque falta configurar whitelist IP en MEXC.

---

## 📞 Soporte Adicional

Si después de aplicar estos cambios siguen los problemas:

1. **Abrir DevTools (F12) → Console**
2. **Copiar el error completo**
3. **Revisar este documento para la solución específica**

