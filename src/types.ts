export interface UserGoal {
  user_id: string;
  monthly_target: number;
  yearly_target: number;
  working_days?: number[]; // [0, 1, 2, 3, 4, 5, 6] representing days of the week
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
  type: 'bonus' | 'tax_return' | 'sale' | 'other';
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
  created_at?: string;
}

export interface ActiveInstallment extends CreditInstallment {
  current_installment: number;
  is_paid: boolean;
  amount_paid: number;
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
  totalRemaining: number;
  accumulatedIncome: number;
  categoryBalances: CategoryBalance[];
}
