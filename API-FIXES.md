# Correcciones de APIs - TradingSurvivor

## ✅ Audición - CORREGIDO
**Problema**: Los gauges mostraban 0% aunque las métricas se calculaban correctamente.

**Causa**: La función `updateAudicionCharts` buscaba `metrics.totalPL` pero el objeto `fullMetrics` usa `netPL`.

**Solución**: Cambiado para usar `metrics.netPL || metrics.totalPL` con fallback.

**Resultado**: Los gauges ahora muestran los valores correctos de P&L, winrate, profit factor y day win rate.

---

## ✅ Bitget API - CORREGIDO
**Problema**: Errores "Request timestamp expired" y "sign signature error"

**Causa**: 
1. Endpoint de tiempo desactualizado (v1 → v2)
2. Posible latencia entre obtener timestamp y hacer la petición

**Soluciones aplicadas**:
1. ✅ Actualizado endpoint de tiempo: `api/v2/public/time` (más confiable)
2. ✅ Agregado buffer de +1 segundo al timestamp para compensar latencia
3. ✅ Mejorado el sistema de caché de timestamps

**Archivo modificado**: 
- `api/bitget.js` (líneas 29-32)
- `api/_utils.js` (líneas 192-194, 218)

**Prueba**: Reintentar "Test Connection" y "Sync Trades" en la sección de Bitget

---

## ✅ LBank API - CORREGIDO
**Problema**: Error "currency pair nonsupport"

**Causa**: El endpoint `/v2/supplement/transaction_history.do` requiere un par específico o ningún parámetro symbol.

**Solución**: Modificado para NO enviar el parámetro `symbol` a menos que el usuario especifique uno.

**Archivo modificado**: `platform.html` (clase LBankAPI, método getTradeHistory)

**Notas**: 
- Si necesitas trades de un par específico, selecciónalo en el dropdown antes de sincronizar
- Si no seleccionas par, LBank devolverá todos los pares disponibles

---

## ⚠️ MEXC API - REQUIERE CONFIGURACIÓN DEL USUARIO

**Problema**: Error 406 "Accessing IP is not in the whitelist"

**Causa**: MEXC requiere que agregues manualmente las IPs de Vercel a tu whitelist de API.

### 🔧 PASOS PARA SOLUCIONAR:

1. **Ve a MEXC → API Management**
   - URL: https://www.mexc.com/user/openapi

2. **Edita tu API Key**
   - Encuentra la API Key que estás usando en TradingSurvivor
   - Click en "Edit" o "Modify"

3. **Agrega las IPs de Vercel a la whitelist**:
   ```
   76.76.21.0/24
   76.76.21.93/24
   76.76.21.98/24
   76.76.21.241/24
   ```

4. **O bien, usa "Unrestricted" (menos seguro pero más fácil)**
   - Selecciona la opción "Unrestricted" o "No Restrictions"
   - ⚠️ ADVERTENCIA: Tu API estará expuesta, solo hazlo si confías en la seguridad de tus credenciales

5. **Guarda los cambios y espera 5 minutos**
   - MEXC puede tardar unos minutos en aplicar los cambios

6. **Recarga TradingSurvivor y prueba nuevamente**

### IPs adicionales de Vercel (si las anteriores no funcionan):
```
76.223.0.0/20
```

### Verificar tu IP actual de Vercel:
Ve a: https://tradersurvivor88.vercel.app/ y abre la consola del navegador, busca mensajes que digan la IP desde la que se hace la petición.

**Referencia**: [Vercel IP Ranges](https://vercel.com/docs/edge-network/regions)

---

## 🧪 PRUEBAS RECOMENDADAS

Después de subir estos cambios a Vercel:

### 1. Audición
- Ve a la sección "Audición"
- Selecciona una cuenta con operaciones
- Los 4 gauges circulares deben mostrar valores distintos a 0%

### 2. Bitget
- Ve a Platforms → Bitget
- Ingresa tus credenciales (API Key, Secret, Passphrase)
- Click "Test Connection" → Debe decir "Connected successfully"
- Click "Sync Trades" → Debe sincronizar sin errores

### 3. LBank
- Ve a Platforms → LBank
- Ingresa tus credenciales (API Key, Private Key RSA)
- Click "Test Connection" → Debe decir "Connected successfully"
- Click "Sync Trades" → Debe sincronizar (sin especificar par de trading)

### 4. MEXC
- Sigue los pasos de configuración de whitelist arriba
- Ve a Platforms → MEXC
- Ingresa tus credenciales
- Click "Test Connection" → Debe conectar exitosamente
- Click "Sync Trades" → Debe sincronizar operaciones

---

## 📝 NOTAS TÉCNICAS

### Timestamps y Sincronización
- Todos los exchanges ahora usan `getServerTime()` con caché de 5 segundos
- Bitget tiene un buffer adicional de +1s para compensar latencia de red
- Si sigues teniendo problemas de timestamp, puede ser por conexión lenta

### Rate Limiting
- Bitget: 10 req/s
- MEXC: 10 req/s  
- LBank: 5 req/s
- Bitunix: 10 req/s
- BingX: 5 req/s

### Formatos de Credenciales

#### Bitget
- API Key: `bg_xxxxxx`
- Secret Key: String alfanumérico
- Passphrase: Lo que configuraste al crear la API Key

#### MEXC
- API Key: `mx0vgl...`
- Secret Key: String hexadecimal largo

#### LBank
- API Key: String alfanumérico
- Private Key: **DEBE incluir** cabeceras PEM:
  ```
  -----BEGIN PRIVATE KEY-----
  MIIEvQIBADANBgkqhk...
  -----END PRIVATE KEY-----
  ```

---

## 🚀 DEPLOYMENT

Para subir estos cambios a Vercel:

```bash
# Si usas Git
git add .
git commit -m "Fix: Audición gauges, Bitget timestamp, LBank params"
git push origin main

# Vercel desplegará automáticamente
```

Verifica en https://vercel.com/dashboard que el deployment se completó sin errores.

---

## ❓ Troubleshooting

### Si Bitget sigue dando error de timestamp:
1. Verifica que las credenciales sean correctas
2. Asegúrate de que tu API Key de Bitget esté activa
3. Verifica que tengas permisos de "Futures" habilitados en la API Key
4. Espera 1 minuto y reintenta (el caché se limpia cada 5 segundos)

### Si LBank da error:
1. Verifica que la Private Key tenga el formato PEM completo
2. Asegúrate de que sea una clave RSA (no ECDSA ni Ed25519)
3. Confirma que tu API Key tenga permisos de lectura ("Read" enabled)

### Si MEXC sigue dando error 406:
1. Verifica que agregaste las IPs correctas
2. Espera 5-10 minutos después de cambiar el whitelist
3. Considera usar "Unrestricted" temporalmente para probar
4. Contacta soporte de MEXC si persiste

---

**Última actualización**: 2 de marzo de 2026
**Versión de correcciones**: 1.0.0
