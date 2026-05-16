-- SQL Schema para Monty (Supabase)
-- Seguro de ejecutar múltiples veces: usa IF NOT EXISTS y DO blocks para políticas

-- 1. Fuentes de ingreso (Uber, Didi, etc.)
CREATE TABLE IF NOT EXISTS income_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE income_sources ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can manage their own income sources" ON income_sources
      FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Registros diarios de ingresos
CREATE TABLE IF NOT EXISTS daily_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    source_id UUID REFERENCES income_sources(id) ON DELETE SET NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    gross_income DECIMAL(12,2) NOT NULL DEFAULT 0,
    operational_costs DECIMAL(12,2) NOT NULL DEFAULT 0,
    net_income DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE daily_entries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can manage their own daily entries" ON daily_entries
      FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Gastos
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can manage their own expenses" ON expenses
      FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Ingresos extra (bonos, ventas, etc.)
CREATE TABLE IF NOT EXISTS extra_income (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('bonus', 'tax_return', 'sale', 'other')),
    affects_goal BOOLEAN DEFAULT TRUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE extra_income ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can manage their own extra income" ON extra_income
      FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Metas mensuales/anuales
CREATE TABLE IF NOT EXISTS goals (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    monthly_target DECIMAL(12,2) NOT NULL DEFAULT 0,
    yearly_target DECIMAL(12,2) NOT NULL DEFAULT 0,
    working_days INTEGER[] DEFAULT '{1,2,3,4,5,6}',
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE goals ADD COLUMN IF NOT EXISTS working_days INTEGER[] DEFAULT '{1,2,3,4,5,6}';

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can manage their own goals" ON goals
      FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Presupuestos mensuales por categoría
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    category TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    due_day INTEGER CHECK (due_day BETWEEN 1 AND 31),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, category)
);

-- Migración: agrega due_day si la tabla ya existía sin esa columna
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS due_day INTEGER CHECK (due_day BETWEEN 1 AND 31);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can manage their own budgets" ON budgets
      FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
