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
    type TEXT NOT NULL CHECK (type IN ('bonus', 'tax_return', 'sale', 'salary', 'other')),
    affects_goal BOOLEAN DEFAULT TRUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Migración: permitir tipo 'salary' en tablas existentes (el nombre del constraint
-- es el autogenerado por Postgres para el CHECK inline de la columna type)
ALTER TABLE extra_income DROP CONSTRAINT IF EXISTS extra_income_type_check;
ALTER TABLE extra_income ADD CONSTRAINT extra_income_type_check
    CHECK (type IN ('bonus', 'tax_return', 'sale', 'salary', 'other'));

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
    income_mode TEXT DEFAULT 'driver',
    salary_amount DECIMAL(12,2) DEFAULT 0,
    salary_pay_day INTEGER,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE goals ADD COLUMN IF NOT EXISTS working_days INTEGER[] DEFAULT '{1,2,3,4,5,6}';

-- Migración: modo de ingreso (conductor / sueldo fijo / mixto) y sueldo recurrente
ALTER TABLE goals ADD COLUMN IF NOT EXISTS income_mode TEXT DEFAULT 'driver';
ALTER TABLE goals ADD COLUMN IF NOT EXISTS salary_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS salary_pay_day INTEGER;
DO $$ BEGIN
  ALTER TABLE goals ADD CONSTRAINT goals_income_mode_check
      CHECK (income_mode IN ('driver', 'salary', 'mixed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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

-- 7. Cuotas de tarjeta de crédito
CREATE TABLE IF NOT EXISTS credit_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    installment_amount DECIMAL(12,2) NOT NULL,
    total_installments INTEGER NOT NULL CHECK (total_installments >= 1),
    start_year INTEGER NOT NULL,
    start_month INTEGER NOT NULL CHECK (start_month BETWEEN 1 AND 12),
    due_day INTEGER CHECK (due_day BETWEEN 1 AND 31),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Migración: agrega due_day si la tabla ya existía sin esa columna
ALTER TABLE credit_installments ADD COLUMN IF NOT EXISTS due_day INTEGER CHECK (due_day BETWEEN 1 AND 31);

ALTER TABLE credit_installments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can manage their own credit installments" ON credit_installments
      FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 8. Grupos de gastos (viajes, eventos, etc.)
CREATE TABLE IF NOT EXISTS expense_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE expense_groups ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can manage their own expense groups" ON expense_groups
      FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9. Ítems dentro de grupos de gastos
CREATE TABLE IF NOT EXISTS expense_group_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES expense_groups(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE expense_group_items ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;

ALTER TABLE expense_group_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can manage their own expense group items" ON expense_group_items
      FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 10. Préstamos (dado = presté yo, recibido = me prestaron)
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('dado', 'recibido')),
    person TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'parcial', 'saldado')),
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can manage their own loans" ON loans
      FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 11. Pagos/abonos de préstamos
CREATE TABLE IF NOT EXISTS loan_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID REFERENCES loans(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can manage their own loan payments" ON loan_payments
      FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
