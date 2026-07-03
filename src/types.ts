export type IncomeMode = 'driver' | 'salary' | 'mixed';

export interface UserGoal {
  user_id: string;
  monthly_target: number; // modo driver: meta bruta de ingreso · modos salary/mixed: meta de ahorro
  yearly_target: number;
  working_days?: number[]; // [0, 1, 2, 3, 4, 5, 6] representing days of the week
  income_mode?: IncomeMode;
  salary_amount?: number;
  salary_pay_day?: number | null;
}

export interface IncomeSource {
  id: string;
  user_id: string;
  name: string;
}

export interface DailyEntry {
  id: string;
  user_id: string;
  source_id: string;
  date: string;
  gross_income: number;
  operational_costs: number;
  net_income: number;
}

export interface Expense {
  id: string;
  user_id: string;
  amount: number;
  category: string;
  date: string;
}

export interface ExtraIncome {
  id: string;
  user_id: string;
  amount: number;
  date: string;
  type: 'bonus' | 'tax_return' | 'sale' | 'salary' | 'other';
  affects_goal: boolean;
  description?: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  due_day?: number | null;
}

export interface CategoryBalance {
  category: string;
  budgeted: number;
  spent: number;
  remaining: number;
}

export interface CreditInstallment {
  id: string;
  user_id: string;
  description: string;
  total_amount: number;
  installment_amount: number;
  total_installments: number;
  start_year: number;
  start_month: number;
  due_day?: number | null;
  created_at?: string;
}

export interface ActiveInstallment extends CreditInstallment {
  current_installment: number;
  is_paid: boolean;
  amount_paid: number;
}

export interface ExpenseGroupItem {
  id: string;
  group_id: string;
  user_id: string;
  description: string;
  amount: number;
  date?: string;
  created_at?: string;
}

export interface ExpenseGroup {
  id: string;
  user_id: string;
  name: string;
  created_at?: string;
  expense_group_items?: ExpenseGroupItem[];
}

export interface Loan {
  id: string;
  user_id: string;
  type: 'dado' | 'recibido';
  person: string;
  amount: number;
  paid_amount: number;
  status: 'pendiente' | 'parcial' | 'saldado';
  date: string;
  notes?: string;
  created_at?: string;
}

export interface LoanPayment {
  id: string;
  loan_id: string;
  user_id: string;
  amount: number;
  date: string;
  notes?: string;
  created_at?: string;
}

export interface DashboardStats {
  netToday: number;
  dailyTarget: number;
  status: 'good' | 'warning' | 'bad';
  monthlyProgress: number;
  monthlyProjection: number;
  diff: number;
  totalBudgeted: number;
  plannedSpent: number;
  unplannedSpent: number;
  groupExpensesTotal: number;
  totalRemaining: number;
  accumulatedIncome: number; // Solo ingresos que cuentan para la meta
  totalCashIn: number;       // Todo el dinero real que entró (incluye préstamos)
  categoryBalances: CategoryBalance[];
  // ─── Modos salary / mixed ───
  incomeMode: IncomeMode;
  salaryReceived: boolean;     // si el sueldo del mes ya fue registrado
  spentToday: number;          // gastado hoy fuera de presupuesto (imprevistos + grupos)
  spendAvailableToday: number; // límite de gasto libre de hoy sin comprometer la meta de ahorro
  spendableRemaining: number;  // libre para gastar el resto del mes (ya descontado lo gastado)
  projectedSavings: number;    // ahorro proyectado del mes (asume el sueldo aunque no haya llegado)
  driveIncomeMonth: number;    // ingresos por conducción (apps) del mes
}
