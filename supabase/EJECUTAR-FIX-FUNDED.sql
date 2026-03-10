-- =====================================================
-- FIX PARA TABLA funded_accounts
-- Ejecutar este archivo completo en Supabase SQL Editor
-- =====================================================

-- ============================================
-- 1. AGREGAR COLUMNAS FALTANTES
-- ============================================

ALTER TABLE funded_accounts 
ADD COLUMN IF NOT EXISTS firm TEXT,
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'evaluation',
ADD COLUMN IF NOT EXISTS balance NUMERIC(20, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS earnings NUMERIC(20, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS fee NUMERIC(20, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS activation_date TEXT,
ADD COLUMN IF NOT EXISTS withdrawals_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS withdrawals_history JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================
-- 2. MIGRAR DATOS EXISTENTES
-- ============================================

-- Copiar datos de company a firm si no existe
UPDATE funded_accounts 
SET firm = company 
WHERE firm IS NULL;

-- ============================================
-- 3. AGREGAR COMENTARIOS A LAS COLUMNAS
-- ============================================

COMMENT ON COLUMN funded_accounts.firm IS 'Nombre de la prop firm (Funding Ticks, Topstep, etc.)';
COMMENT ON COLUMN funded_accounts.type IS 'Tipo de cuenta: evaluation o live';
COMMENT ON COLUMN funded_accounts.balance IS 'Balance actual de la cuenta';
COMMENT ON COLUMN funded_accounts.earnings IS 'Ganancias acumuladas (retiros)';
COMMENT ON COLUMN funded_accounts.fee IS 'Tarifa de activación/evaluación';
COMMENT ON COLUMN funded_accounts.activation_date IS 'Fecha de activación de la cuenta';
COMMENT ON COLUMN funded_accounts.withdrawals_count IS 'Número de retiros realizados';
COMMENT ON COLUMN funded_accounts.withdrawals_history IS 'Historial completo de retiros en formato JSON';
COMMENT ON COLUMN funded_accounts.notes IS 'Notas adicionales de la cuenta';

-- ============================================
-- 4. VERIFICAR RESULTADO
-- ============================================

-- Muestra la estructura de la tabla
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'funded_accounts'
ORDER BY ordinal_position;

-- Muestra las cuentas existentes con las nuevas columnas
SELECT 
  id,
  name,
  company,
  firm,
  type,
  balance,
  earnings,
  fee,
  status,
  activation_date,
  withdrawals_count,
  withdrawals_history
FROM funded_accounts;
