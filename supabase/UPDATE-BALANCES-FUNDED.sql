-- =====================================================
-- ACTUALIZAR BALANCES Y EARNINGS DE CUENTAS FUNDED
-- Script para establecer balances y recalcular earnings
-- =====================================================

-- Ver estado actual de las cuentas
SELECT 
  id,
  name,
  company,
  type,
  status,
  balance,
  earnings,
  fee,
  activation_date,
  withdrawals_history
FROM funded_accounts
ORDER BY activation_date DESC;

-- =====================================================
-- PASO 1: RECALCULAR EARNINGS DESDE withdrawals_history
-- =====================================================
-- Esto suma todos los retiros en withdrawals_history y actualiza earnings

UPDATE funded_accounts
SET earnings = (
  SELECT COALESCE(SUM(CAST(withdrawal->>'amount' AS NUMERIC)), 0)
  FROM jsonb_array_elements(withdrawals_history) AS withdrawal
)
WHERE withdrawals_history IS NOT NULL 
  AND jsonb_array_length(withdrawals_history) > 0;

-- Verificar earnings actualizados
SELECT 
  name,
  company,
  type,
  status,
  earnings,
  jsonb_array_length(withdrawals_history) as num_retiros,
  withdrawals_history
FROM funded_accounts
WHERE withdrawals_history IS NOT NULL 
  AND jsonb_array_length(withdrawals_history) > 0;

-- =====================================================
-- PASO 2: ACTUALIZAR BALANCES
-- =====================================================

-- OPCIÓN A: Balance específico por nombre de cuenta
-- Descomenta y modifica según tus cuentas reales:

-- UPDATE funded_accounts 
-- SET balance = 50000.00  -- Cambia este valor al balance real
-- WHERE name = 'FTPROFUNDINGTICK83454';

-- UPDATE funded_accounts 
-- SET balance = 50000.00  -- Cambia este valor al balance real
-- WHERE name = 'TOPSETP223343';

-- OPCIÓN B: Establecer balance predeterminado para todas las cuentas live sin balance
UPDATE funded_accounts 
SET balance = 50000.00
WHERE type = 'live' 
  AND status = 'active'
  AND (balance IS NULL OR balance = 0);

-- OPCIÓN C: Establecer balance basado en el nombre de la empresa
-- Diferentes prop firms tienen diferentes tamaños de cuenta:

-- Topstep (suele ser $50K)
-- UPDATE funded_accounts 
-- SET balance = 50000.00
-- WHERE company LIKE '%Topstep%' 
--   AND type = 'live'
--   AND (balance IS NULL OR balance = 0);

-- Funding Ticks (varía, usar $25K como ejemplo)
-- UPDATE funded_accounts 
-- SET balance = 25000.00
-- WHERE company LIKE '%Funding%' 
--   AND type = 'live'
--   AND (balance IS NULL OR balance = 0);

-- =====================================================
-- VERIFICAR CAMBIOS FINALES
-- =====================================================
SELECT 
  name,
  company,
  type,
  status,
  balance,
  earnings,
  fee,
  (earnings - fee) as beneficio_neto,
  jsonb_array_length(COALESCE(withdrawals_history, '[]'::jsonb)) as num_retiros
FROM funded_accounts
ORDER BY type DESC, status DESC, balance DESC;

-- =====================================================
-- ESTADÍSTICAS DESPUÉS DE LA ACTUALIZACIÓN
-- =====================================================
SELECT 
  type,
  status,
  COUNT(*) as total_cuentas,
  SUM(balance) as balance_total,
  SUM(earnings) as earnings_total,
  SUM(fee) as fees_total,
  SUM(earnings - fee) as beneficio_neto_total
FROM funded_accounts
GROUP BY type, status
ORDER BY type DESC, status DESC;
