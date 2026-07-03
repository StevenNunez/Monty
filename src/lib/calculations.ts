import { startOfMonth, endOfMonth, differenceInDays, isSameDay } from 'date-fns';
import { DailyEntry, ExtraIncome, UserGoal, DashboardStats, Expense, Budget, CategoryBalance, IncomeMode } from '../types';

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
  groupItems: { amount: number; date?: string | null; created_at?: string | null }[] = [],
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

  // Todo el dinero extra que entró este mes (para cálculo de caja real, independiente de la meta)
  const allExtraIncomeMonth = extraIncomes
    .filter(ei => {
      const d = new Date(ei.date + 'T00:00:00');
      return d >= monthStart && d <= monthEnd;
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

  // Gastos de grupos del mes — usa date si existe, sino created_at como fallback
  const monthGroupItems = groupItems.filter(item => {
    const rawDate = item.date ?? (item.created_at ? item.created_at.split('T')[0] : null);
    if (!rawDate) return true; // sin fecha: incluir siempre (no excluir gastos reales)
    const d = new Date(rawDate + 'T00:00:00');
    return d >= monthStart && d <= monthEnd;
  });
  const groupExpensesTotal = monthGroupItems.reduce((sum, item) => sum + Number(item.amount), 0);

  // Para la meta: solo ingresos relevantes al objetivo (affects_goal)
  const totalGenerated = accumulatedNetMonth + extraIncomeAppliedMonth;
  // Para el saldo real de caja: incluye TODO el dinero que entró (préstamos, cobros, etc.)
  const totalCashIn = accumulatedNetMonth + allExtraIncomeMonth;
  const totalRemaining = totalCashIn - totalBudgeted - unplannedSpent - groupExpensesTotal;

  // ─── Modos salary / mixed ─────────────────────────────────────
  // La lógica se invierte: en vez de "cuánto me falta ganar hoy",
  // la pregunta es "cuánto puedo gastar hoy" y la meta mensual es meta de ahorro.
  const incomeMode: IncomeMode = goal?.income_mode || 'driver';
  const salaryAmount = Number(goal?.salary_amount || 0);

  const salaryReceived = extraIncomes.some(ei => {
    const d = new Date(ei.date + 'T00:00:00');
    return ei.type === 'salary' && d >= monthStart && d <= monthEnd;
  });
  // Si el sueldo aún no llega, se asume que llegará (permite planificar el mes completo)
  const pendingSalary = incomeMode !== 'driver' && !salaryReceived ? salaryAmount : 0;

  // Gasto libre de HOY (imprevistos + grupos; lo presupuestado ya está descontado completo)
  const unplannedSpentToday = monthExpenses
    .filter(e => !budgetCategories.has(e.category.trim().toLowerCase()) && isSameDay(new Date(e.date + 'T00:00:00'), today))
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const groupSpentToday = monthGroupItems
    .filter(item => {
      const rawDate = item.date ?? (item.created_at ? item.created_at.split('T')[0] : null);
      return rawDate ? isSameDay(new Date(rawDate + 'T00:00:00'), today) : false;
    })
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const spentToday = unplannedSpentToday + groupSpentToday;

  // Ahorro proyectado = caja esperada del mes − presupuestos − gasto libre ya hecho
  const projectedSavings = totalCashIn + pendingSalary - totalBudgeted - unplannedSpent - groupExpensesTotal;
  // Lo que queda libre para gastar sin comprometer la meta de ahorro
  const spendableRemaining = projectedSavings - monthlyTarget;
  const remainingCalendarDays = Math.max(1, differenceInDays(monthEnd, today) + 1);
  // Límite de hoy: se calcula ANTES de descontar lo gastado hoy, para comparar contra spentToday
  const spendAvailableToday = Math.max(0, (spendableRemaining + spentToday) / remainingCalendarDays);

  if (incomeMode !== 'driver') {
    const overspend = spentToday - spendAvailableToday;
    if (overspend <= 0) status = 'good';
    else if (overspend > spendAvailableToday * 0.2) status = 'bad';
    else status = 'warning';
  }

  const finalMonthlyProgress = incomeMode !== 'driver'
    ? (monthlyTarget > 0 ? projectedSavings / monthlyTarget : 0)
    : monthlyProgress;
  const finalMonthlyProjection = incomeMode !== 'driver' ? projectedSavings : monthlyProjection;

  return {
    netToday,
    dailyTarget,
    status,
    monthlyProgress: finalMonthlyProgress,
    monthlyProjection: finalMonthlyProjection,
    diff,
    totalBudgeted,
    plannedSpent,
    unplannedSpent,
    groupExpensesTotal,
    totalRemaining,
    accumulatedIncome: totalGenerated,
    totalCashIn,
    categoryBalances,
    incomeMode,
    salaryReceived,
    spentToday,
    spendAvailableToday,
    spendableRemaining,
    projectedSavings,
    driveIncomeMonth: accumulatedNetMonth
  };
}
