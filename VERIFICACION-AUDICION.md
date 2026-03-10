# Verificación del Link de Audición

## 🔗 Link Compartido
```
https://tradersurvivor88.vercel.app/?audicion=7aa45b5f_1772459827110
```

## ✅ Estado del Sistema

### 1. Detección de Parámetro URL
- ✅ El código detecta correctamente el parámetro `?audicion=`
- ✅ Marca como vista pública si el ID tiene más de 5 caracteres
- ✅ Configuración: `window.IS_PUBLIC_AUDICION_VIEW = true`

### 2. Tabla en Supabase
- ✅ Tabla `public_audiciones` existe en schema
- ✅ Columnas: `id`, `user_id`, `data` (JSONB), `created_at`, `updated_at`
- ✅ RLS habilitado con política de lectura pública

### 3. Políticas RLS
```sql
-- Política de lectura pública (PERMITE lectura a TODOS)
CREATE POLICY "Public audiciones are viewable by everyone"
  ON public_audiciones FOR SELECT
  USING (true);
```

### 4. Función de Carga
- ✅ `loadPublicAudicion(audicionId)` implementada
- ✅ Consulta correcta a Supabase
- ✅ Manejo de errores

## 🧪 Verificaciones Necesarias

### A. Confirmar que el ID existe en Supabase

**SQL a ejecutar en Supabase SQL Editor:**
```sql
SELECT id, user_id, created_at, updated_at
FROM public_audiciones
WHERE id = '7aa45b5f_1772459827110';
```

**Resultado esperado:**
- Si devuelve 1 fila → El ID existe ✅
- Si devuelve 0 filas → El ID NO existe ❌

### B. Verificar estructura de datos

**SQL:**
```sql
SELECT 
  id,
  jsonb_typeof(data) as data_type,
  jsonb_object_keys(data) as keys
FROM public_audiciones
WHERE id = '7aa45b5f_1772459827110';
```

**Keys esperadas en el JSON:**
- `personalInfo`
- `metrics`
- `trades`
- `charts`
- `privacySettings`

### C. Verificar RLS (Row Level Security)

**SQL:**
```sql
-- Ver políticas activas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'public_audiciones';
```

**Resultado esperado:**
- Política "Public audiciones are viewable by everyone" con `qual = true`

## 🔍 Posibles Problemas y Soluciones

### Problema 1: ID No Existe
**Síntoma**: Error "No se encontró la audición solicitada"

**Solución**:
1. Verifica que guardaste la audición después de crear el link
2. En la aplicación, ve a Audición → Click "Guardar Públicamente"
3. Verifica el nuevo link generado

### Problema 2: Tabla No Existe
**Síntoma**: Error de Supabase "relation does not exist"

**Solución**:
Ejecutar en Supabase SQL Editor:
```sql
CREATE TABLE IF NOT EXISTS public_audiciones (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_audiciones_user ON public_audiciones(user_id);
CREATE INDEX IF NOT EXISTS idx_public_audiciones_created ON public_audiciones(created_at DESC);

ALTER TABLE public_audiciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public audiciones are viewable by everyone" ON public_audiciones;
CREATE POLICY "Public audiciones are viewable by everyone"
  ON public_audiciones FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert own audiciones" ON public_audiciones;
CREATE POLICY "Users can insert own audiciones"
  ON public_audiciones FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own audiciones" ON public_audiciones;
CREATE POLICY "Users can update own audiciones"
  ON public_audiciones FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own audiciones" ON public_audiciones;
CREATE POLICY "Users can delete own audiciones"
  ON public_audiciones FOR DELETE
  USING (auth.uid() = user_id);
```

### Problema 3: RLS Bloqueando Lectura
**Síntoma**: Error "permission denied" o "row-level security policy"

**Solución**:
Verificar y recrear la política pública:
```sql
-- Eliminar política antigua si existe
DROP POLICY IF EXISTS "Public audiciones are viewable by everyone" ON public_audiciones;

-- Crear nueva política que permita lectura a TODOS (sin autenticación)
CREATE POLICY "Public audiciones are viewable by everyone"
  ON public_audiciones FOR SELECT
  USING (true);
```

### Problema 4: Data Corrupta o Vacía
**Síntoma**: La página carga pero no muestra datos

**Verificación**:
```sql
SELECT 
  id,
  data->'personalInfo'->>'username' as username,
  data->'metrics'->>'totalPL' as total_pl,
  jsonb_array_length(data->'trades') as num_trades
FROM public_audiciones
WHERE id = '7aa45b5f_1772459827110';
```

**Solución**: Volver a guardar la audición desde la aplicación

## 📋 Checklist de Diagnóstico

Verifica en orden:

1. ⬜ El link tiene el formato correcto: `?audicion=ID`
2. ⬜ El ID tiene más de 5 caracteres
3. ⬜ La tabla `public_audiciones` existe en Supabase
4. ⬜ El ID existe en la tabla (consulta SQL A)
5. ⬜ Los datos tienen la estructura correcta (consulta SQL B)
6. ⬜ Las políticas RLS permiten lectura pública (consulta SQL C)
7. ⬜ El navegador permite CORS (no debe ser problema en Vercel)
8. ⬜ Supabase no tiene problemas de conectividad

## 🚀 Pasos para Regenerar el Link

Si nada funciona, regenera la audición:

1. **Login en TradingSurvivor**
2. **Ve a sección Audición**
3. **Selecciona la cuenta que quieres compartir**
4. **Click en "Guardar Públicamente"**
5. **Copia el nuevo link generado**
6. **Verifica que funciona**

El sistema debería:
- Generar un nuevo ID: `{user_id_8chars}_{timestamp}`
- Guardar en Supabase automáticamente
- Mostrar el link en un input de texto
- Permitir copiar con un botón

## 🔒 Verificación de Privacidad

La audición pública respeta la configuración de privacidad:
- Avatar (mostrar/ocultar)
- Email (mostrar/ocultar)  
- Member Since (mostrar/ocultar)
- Gráficos individuales

Esto se guarda en el campo `data.privacySettings`.

## 💡 Debugging en Producción

**Abrir DevTools en el link compartido:**
1. Abre: https://tradersurvivor88.vercel.app/?audicion=7aa45b5f_1772459827110
2. F12 → Console
3. Busca mensajes:
   - "📊 Modo Vista Pública de Audición activado"
   - "📥 Cargando audición pública:"
   - "✅ Datos cargados desde Supabase:"

**Si hay error:**
- "❌ Error cargando audición:" → Problema con Supabase o RLS
- "❌ No se encontraron datos" → ID no existe
- "❌ Supabase no está disponible" → Problema de inicialización

---

**Próximos pasos sugeridos:**
1. Ejecutar las consultas SQL de verificación en Supabase
2. Compartir los resultados para diagnosticar el problema exacto
3. Si es necesario, regenerar el link desde la aplicación
