# 🚀 DEPLOY A GITHUB Y VERCEL

## ✅ Proyecto preparado y listo para deploy

### 📦 Cambios incluidos:
- ✅ APIs mejoradas con rate limiting, retry logic y server time sync
- ✅ Fix de credenciales Supabase (settings.api_keys en lugar de api_keys)
- ✅ Módulo `api/_utils.js` con funciones compartidas
- ✅ Soporte para LBank RSA con echostr
- ✅ Validación de respuestas de exchanges
- ✅ Manejo de errores robusto

---

## 📋 PASOS PARA SUBIR A GITHUB

### 1. Agregar archivos modificados
```bash
cd "c:\Users\Daniel HDZ\Desktop\TradingSurvivor\TraderSurvivor"
git add api/
git add platform.html
git add vercel.json
git add .gitignore
git add package.json
git add .env.example
```

### 2. Hacer commit
```bash
git commit -m "feat: Mejoras críticas en APIs - rate limiting, retry logic, server time sync"
```

### 3. Push a GitHub
```bash
git push origin main
```

---

## 🔧 DEPLOY A VERCEL

### Opción A: Deploy Automático (Recomendado)
Si ya vinculaste tu repo a Vercel:
- ✅ Al hacer `git push`, Vercel detecta automáticamente
- ✅ Deploy se inicia en 10-30 segundos
- ✅ Verás el progreso en: https://vercel.com/dashboard

### Opción B: Deploy Manual desde CLI
```bash
vercel --prod
```

### Opción C: Deploy desde Dashboard
1. Ve a: https://vercel.com
2. Click en "Import Project"
3. Selecciona tu repo de GitHub
4. Click en "Deploy"

---

## ⚙️ CONFIGURACIÓN EN VERCEL

**Variables de entorno (si las necesitas):**
1. Ve a tu proyecto en Vercel Dashboard
2. Settings → Environment Variables
3. Agrega las variables de`.env.example`

**Nota:** Las API keys de exchanges NO se ponen en Vercel, se guardan en Supabase por usuario.

---

## ✅ VERIFICAR QUE FUNCIONA

Después del deploy:

### 1. Probar la URL
```
https://tu-proyecto.vercel.app
```

### 2. Probar las APIs
```
https://tu-proyecto.vercel.app/api/lbank
https://tu-proyecto.vercel.app/api/bingx
```

### 3. Ver logs en tiempo real
```bash
vercel logs --follow
```

O en el Dashboard: https://vercel.com/tu-proyecto/deployments → Click en deployment → Logs

---

## 🔍 LOGS ESPERADOS

Si todo funciona, verás en Vercel logs:
```
⏰ Server time lbank: 2026-02-28T10:30:45Z
⏳ Rate limit alcanzado. Esperando 2000ms...
✅ LBank response OK
```

---

## 🐛 TROUBLESHOOTING

### Error: "Module not found: api/_utils.js"
- Verifica que `api/_utils.js` esté en el repo
- Haz: `git add api/_utils.js`

### Error: "Cannot find module 'crypto'"
- Normal en Vercel, crypto es built-in de Node.js
- Se resuelve automáticamente

### APIs devuelven 500
- Revisa logs: `vercel logs`
- Verifica que package.json tenga `"type": "module"`

---

## 📊 ARCHIVOS IMPORTANTES

✅ Incluidos en el commit:
- `api/*.js` - Todas las APIs mejoradas
- `api/_utils.js` - Módulo compartido
- `platform.html` - Frontend con fix de Supabase
- `vercel.json` - Configuración de rutas
- `.gitignore` - Ignora node_modules, .env, etc.
- `.env.example` - Template de variables de entorno

❌ Ignorados (no se suben):
- `node_modules/` - Dependencias (se instalan en Vercel)
- `.env` - Credenciales locales
- `.vercel/` - Config local de Vercel

---

## 🎯 COMANDOS RÁPIDOS

**Todo en uno:**
```bash
cd "c:\Users\Daniel HDZ\Desktop\TradingSurvivor\TraderSurvivor"
git add .
git commit -m "feat: APIs production-ready con rate limiting y retry logic"
git push origin main
```

---

✅ **LISTO PARA DEPLOY**
