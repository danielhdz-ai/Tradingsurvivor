-- =====================================================
-- SCHEMA DE BASE DE DATOS PARA TRADING SURVIVOR
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- ============================================
-- 1. TABLA DE CREDENCIALES DE APIS (CIFRADAS)
-- ============================================
CREATE TABLE IF NOT EXISTS api_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform VARCHAR(50) NOT NULL, -- 'bingx', 'bitget', 'mexc', etc.
  api_key TEXT NOT NULL,
  secret_key TEXT NOT NULL,
  passphrase TEXT, -- Solo para Bitget
  account_id TEXT, -- ID de cuenta del usuario en la plataforma
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform, account_id)
);

-- Índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_api_credentials_user ON api_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_api_credentials_platform ON api_credentials(user_id, platform);

-- RLS: Solo el usuario puede ver sus propias credenciales
ALTER TABLE api_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own credentials" ON api_credentials;
CREATE POLICY "Users can view own credentials"
  ON api_credentials FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own credentials" ON api_credentials;
CREATE POLICY "Users can insert own credentials"
  ON api_credentials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own credentials" ON api_credentials;
CREATE POLICY "Users can update own credentials"
  ON api_credentials FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own credentials" ON api_credentials;
CREATE POLICY "Users can delete own credentials"
  ON api_credentials FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 2. TABLA DE CUENTAS DE TRADING
-- ============================================
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  platform TEXT NOT NULL,
  initial_balance NUMERIC(20, 2) DEFAULT 0,
  balance NUMERIC(20, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own accounts" ON accounts;
CREATE POLICY "Users can view own accounts"
  ON accounts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own accounts" ON accounts;
CREATE POLICY "Users can insert own accounts"
  ON accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own accounts" ON accounts;
CREATE POLICY "Users can update own accounts"
  ON accounts FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own accounts" ON accounts;
CREATE POLICY "Users can delete own accounts"
  ON accounts FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 3. TABLA DE OPERACIONES
-- ============================================
CREATE TABLE IF NOT EXISTS operations (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id TEXT,
  date TEXT NOT NULL,
  instrument TEXT NOT NULL,
  type TEXT NOT NULL,
  entry NUMERIC(20, 8),
  exit NUMERIC(20, 8),
  entry_time TEXT,
  exit_time TEXT,
  volume NUMERIC(20, 8),
  result TEXT,
  pl NUMERIC(20, 2),
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  image_datas TEXT[],
  manual_pl NUMERIC(20, 2),
  session TEXT,
  platform TEXT,
  order_id TEXT,
  commission NUMERIC(20, 4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operations_user ON operations(user_id);
CREATE INDEX IF NOT EXISTS idx_operations_account ON operations(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_operations_date ON operations(user_id, date);
CREATE INDEX IF NOT EXISTS idx_operations_instrument ON operations(user_id, instrument);

ALTER TABLE operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own operations" ON operations;
CREATE POLICY "Users can view own operations"
  ON operations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own operations" ON operations;
CREATE POLICY "Users can insert own operations"
  ON operations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own operations" ON operations;
CREATE POLICY "Users can update own operations"
  ON operations FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own operations" ON operations;
CREATE POLICY "Users can delete own operations"
  ON operations FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 4. TABLA DE FINANZAS
-- ============================================
CREATE TABLE IF NOT EXISTS finances (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date TEXT NOT NULL,
  amount NUMERIC(20, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finances_user ON finances(user_id);

ALTER TABLE finances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own finances" ON finances;
CREATE POLICY "Users can view own finances"
  ON finances FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own finances" ON finances;
CREATE POLICY "Users can insert own finances"
  ON finances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own finances" ON finances;
CREATE POLICY "Users can update own finances"
  ON finances FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own finances" ON finances;
CREATE POLICY "Users can delete own finances"
  ON finances FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 5. TABLA DE SETUPS (PLAYBOOK)
-- ============================================
CREATE TABLE IF NOT EXISTS setups (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  rules TEXT,
  image_url TEXT,
  stats JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_setups_user ON setups(user_id);

ALTER TABLE setups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own setups" ON setups;
CREATE POLICY "Users can view own setups"
  ON setups FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own setups" ON setups;
CREATE POLICY "Users can insert own setups"
  ON setups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own setups" ON setups;
CREATE POLICY "Users can update own setups"
  ON setups FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own setups" ON setups;
CREATE POLICY "Users can delete own setups"
  ON setups FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 6. TABLA DE FUNDED ACCOUNTS
-- ============================================
CREATE TABLE IF NOT EXISTS funded_accounts (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  initial_capital NUMERIC(20, 2),
  profit_target NUMERIC(20, 2),
  max_daily_loss NUMERIC(20, 2),
  max_total_loss NUMERIC(20, 2),
  phase TEXT,
  status TEXT,
  start_date TEXT,
  end_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_funded_accounts_user ON funded_accounts(user_id);

ALTER TABLE funded_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own funded accounts" ON funded_accounts;
CREATE POLICY "Users can view own funded accounts"
  ON funded_accounts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own funded accounts" ON funded_accounts;
CREATE POLICY "Users can insert own funded accounts"
  ON funded_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own funded accounts" ON funded_accounts;
CREATE POLICY "Users can update own funded accounts"
  ON funded_accounts FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own funded accounts" ON funded_accounts;
CREATE POLICY "Users can delete own funded accounts"
  ON funded_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 7. TABLA DE SUSCRIPCIONES
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free', -- 'free', 'pro', 'premium'
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'cancelled', 'past_due', 'trialing'
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Solo el backend puede modificar suscripciones
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON subscriptions;
CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 8. TABLA DE USER SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- 9. FUNCIÓN PARA CREAR SUSCRIPCIÓN FREE AL REGISTRARSE
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Crear suscripción gratuita
  INSERT INTO public.subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active');
  
  -- Crear settings vacíos
  INSERT INTO public.user_settings (user_id, settings)
  VALUES (NEW.id, '{}');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para ejecutar la función cuando se crea un usuario
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 10. FUNCIÓN PARA ACTUALIZAR updated_at AUTOMÁTICAMENTE
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a todas las tablas
CREATE TRIGGER update_api_credentials_updated_at BEFORE UPDATE ON api_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_operations_updated_at BEFORE UPDATE ON operations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_finances_updated_at BEFORE UPDATE ON finances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_setups_updated_at BEFORE UPDATE ON setups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_funded_accounts_updated_at BEFORE UPDATE ON funded_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FIN DEL SCHEMA
-- ============================================

-- ============================================
-- 9. TABLA DE AUDICIONES PÚBLICAS (LINKS CORTOS)
-- ============================================
CREATE TABLE IF NOT EXISTS public_audiciones (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_audiciones_user ON public_audiciones(user_id);
CREATE INDEX IF NOT EXISTS idx_public_audiciones_created ON public_audiciones(created_at DESC);

-- RLS: Permitir lectura pública pero solo el usuario puede crear/actualizar
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

-- Para verificar que todo se creó correctamente:
SELECT 
  tablename, 
  schemaname 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
