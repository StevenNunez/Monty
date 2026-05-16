import { startOfMonth, endOfMonth, differenceInDays, isSameDay } from 'date-fns';
import { DailyEntry, ExtraIncome, UserGoal, DashboardStats, Expense, Budget, CategoryBalance } from '../types';

/**
 * daily_target = (monthly_target - accumulated_net_income_month - extra_income_applied) / remaining_days
 */
export function calculateDynamicDailyTarget(
  monthlyTarget: number,
  accumulatedNetMonth: number,
  extraIncomeAppliedMonth: number,
  remainingDays: number
): number {
  const remainingTarget = monthlyTarget - accumulatedNetMonth - extraIncomeAppliedMonth;
  if (remainingDays <= 0) return Math.max(0, remainingTarget);
  return Math.max(0, remainingTarget / remainingDays);
}

export function calculateStats(
  goal: UserGoal | null,
  dailyEntries: DailyEntry[],
  extraIncomes: ExtraIncome[],
  expenses: Expense[],
  budgets: Budget[],
  today: Date = new Date()
): DashboardStats {
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  
  const workingDays = goal?.working_days || [0, 1, 2, 3, 4, 5, 6];
  
  const getWorkingDaysInRange = (start: Date, end: Date, allowedDays: number[]) => {
    let count = 0;
    let curr = new Date(start);
    while (curr <= end) {
      if (allowedDays.includes(curr.getDay())) count++;
      curr.setDate(curr.getDate() + 1);
    }
    return count;
  };

  const totalWorkingDaysInMonth = getWorkingDaysInRange(monthStart, monthEnd, workingDays);
  
  // Remaining working days including today
  const remainingWorkingDays = getWorkingDaysInRange(today, monthEnd, workingDays);

  // INCOME CALCULATIONS
  const monthEntries = dailyEntries.filter(e => {
    const d = new Date(e.date + 'T00:00:00'); // Parse as local midnight
    return d >= monthStart && d <= monthEnd;
  });

  // Use gross_income: entries now store gross (bencina is a separate expense).
  // Old entries also have gross_income = what the platform paid, which is the correct base.
  const netToday = dailyEntries
    .filter(e => isSameDay(new Date(e.date + 'T00:00:00'), today))
    .reduce((sum, e) => sum + Number(e.gross_income), 0);

  const accumulatedNetMonth = monthEntries.reduce((sum, e) => sum + Number(e.gross_income), 0);

  const extraIncomeAppliedMonth = extraIncomes
    .filter(ei => {
      const d = new Date(ei.date + 'T00:00:00');
      return ei.affects_goal && d >= monthStart && d <= monthEnd;
    })
    .reduce((sum, ei) => sum + Number(ei.amount), 0);

  const monthlyTarget = goal?.monthly_target || 0;
  
  const dailyTarget = calculateDynamicDailyTarget(
    monthlyTarget,
    accumulatedNetMonth - netToday,
    extraIncomeAppliedMonth,
    remainingWorkingDays
  );

  const diff = netToday - dailyTarget;
  
  let status: 'good' | 'warning' | 'bad' = 'warning';
  if (diff >= 0) status = 'good';
  else if (Math.abs(diff) > dailyTarget * 0.2) status = 'bad';

  const monthlyProgress = monthlyTarget > 0 ? (accumulatedNetMonth + extraIncomeAppliedMonth) / monthlyTarget : 0;
  
  const workingDaysPassed = getWorkingDaysInRange(monthStart, today, workingDays);
  const avgNetPerWorkingDay = workingDaysPassed > 0 ? accumulatedNetMonth / workingDaysPassed : netToday;
  // Note: remainingWorkingDays includes today, but accumulatedNetMonth also includes today.
  // Projection = (what we have) + (avg * remaining working days excluding today)
  const remainingWorkingDaysExcludingToday = getWorkingDaysInRange(today, monthEnd, workingDays) - (workingDays.includes(today.getDay()) ? 1 : 0);
  const monthlyProjection = accumulatedNetMonth + (avgNetPerWorkingDay * remainingWorkingDaysExcludingToday);

  // BUDGET CALCULATIONS
  const monthExpenses = expenses.filter(e => {
    const d = new Date(e.date + 'T00:00:00');
    return d >= monthStart && d <= monthEnd;
  });

  const totalBudgeted = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
  
  const budgetCategories = new Set(budgets.map(b => b.category.trim().toLowerCase()));

  const plannedSpent = monthExpenses
    .filter(e => budgetCategories.has(e.category.trim().toLowerCase()))
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const unplannedSpent = monthExpenses
    .filter(e => !budgetCategories.has(e.category.trim().toLowerCase()))
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const categoryBalances: CategoryBalance[] = budgets.map(b => {
    const spent = monthExpenses
      .filter(e => e.category.trim().toLowerCase() === b.category.trim().toLowerCase())
      .reduce((sum, e) => sum + Number(e.amount), 0);
    
    return {
      category: b.category,
      budgeted: Number(b.amount),
      spent: spent,
      remaining: Number(b.amount) - spent
    };
  });

  // Saldo Libre: Lo que llevo generado - (Total Presupuestado + Gastos No Planificados)
  // Nota: No restamos la meta bruta aquí porque la meta es lo que queremos producir, no dinero que ya tenemos y debemos guardar necesariamente antes de gastar en comida, 
  // pero el usuario dice "no gasta de mas de lo que se intenta recibir mensual".
  // Si consideramos la meta como "dinero que ya no existe", entonces:
  // Saldo Libre = (Neto Generado hoy) - Gastos No Planificados (ya que los planificados tienen su propio sobre)
  // Pero para el dashboard, usaremos: Total Generado Mensual - Total Presupuestado - Gastos No Planificados
  const totalGenerated = accumulatedNetMonth + extraIncomeAppliedMonth;
  const totalRemaining = totalGenerated - totalBudgeted - unplannedSpent;

  return {
    netToday,
    dailyTarget,
    status,
    monthlyProgress,
    monthlyProjection,
    diff,
    totalBudgeted,
    plannedSpent,
    unplannedSpent,
    totalRemaining,
    accumulatedIncome: totalGenerated,
    categoryBalances
  };
}
