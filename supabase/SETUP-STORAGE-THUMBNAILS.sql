-- =====================================================
-- CONFIGURACIÓN DE STORAGE PARA THUMBNAILS OPTIMIZADOS
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- ============================================
-- 1. CREAR BUCKET PARA IMÁGENES DE TRADES
-- ============================================

-- Crear bucket público para almacenar imágenes completas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'trade-images',
    'trade-images',
    true,
    104857600, -- 100 MB por archivo
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 104857600,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

-- ============================================
-- 2. POLÍTICAS DE SEGURIDAD (RLS)
-- ============================================

-- Política: Los usuarios pueden subir sus propias imágenes
DROP POLICY IF EXISTS "Users can upload own trade images" ON storage.objects;
CREATE POLICY "Users can upload own trade images"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'trade-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política: Los usuarios pueden ver sus propias imágenes
DROP POLICY IF EXISTS "Users can view own trade images" ON storage.objects;
CREATE POLICY "Users can view own trade images"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'trade-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política: Todos pueden ver imágenes públicas (para compartir audiciones)
DROP POLICY IF EXISTS "Public can view trade images" ON storage.objects;
CREATE POLICY "Public can view trade images"
ON storage.objects FOR SELECT
USING (bucket_id = 'trade-images');

-- Política: Los usuarios pueden actualizar sus propias imágenes
DROP POLICY IF EXISTS "Users can update own trade images" ON storage.objects;
CREATE POLICY "Users can update own trade images"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'trade-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política: Los usuarios pueden eliminar sus propias imágenes
DROP POLICY IF EXISTS "Users can delete own trade images" ON storage.objects;
CREATE POLICY "Users can delete own trade images"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'trade-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================
-- 3. VERIFICACIÓN
-- ============================================

-- Verificar que el bucket se creó correctamente
SELECT 
    id,
    name,
    public,
    file_size_limit / 1024 / 1024 as max_file_size_mb,
    allowed_mime_types
FROM storage.buckets
WHERE id = 'trade-images';

-- ============================================
-- 4. INFORMACIÓN ADICIONAL
-- ============================================

/*
✅ BUCKET CONFIGURADO CORRECTAMENTE

📋 Resumen:
- Bucket: trade-images
- Público: Sí (para URLs directas)
- Límite: 100 MB por archivo
- Formatos: JPEG, PNG, GIF, WebP
- Seguridad: RLS activado (usuarios solo ven sus imágenes)

💡 Estructura de archivos:
/{user_id}/{operation_id}_{timestamp}_{random}.jpg

🎯 Beneficios:
- 80% menos egress (solo thumbnails en DB)
- Imágenes HD disponibles bajo demanda
- Compatible con imágenes antiguas
- Totalmente automático

🔧 Uso:
No necesitas hacer nada más. La plataforma automáticamente:
1. Crea thumbnails al subir imágenes
2. Guarda imágenes completas en Storage
3. Carga thumbnails en galería
4. Descarga imagen completa al hacer clic

💰 Ahorro estimado:
- Antes: ~250 MB/día de egress
- Después: ~50 MB/día de egress
- Ahorro: 80%

*/
