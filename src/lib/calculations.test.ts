import { describe, it, expect } from 'vitest';
import { calculateDynamicDailyTarget, calculateStats } from './calculations';
import { DailyEntry, ExtraIncome, Expense, Budget, UserGoal } from '../types';

// ─── Helpers ────────────────────────────────────────────────────
const entry = (over: Partial<DailyEntry> & Pick<DailyEntry, 'date' | 'gross_income'>): DailyEntry => ({
  id: 'e' + Math.random(),
  user_id: 'u1',
  source_id: 's1',
  operational_costs: 0,
  net_income: over.gross_income,
  ...over,
});

const extra = (over: Partial<ExtraIncome> & Pick<ExtraIncome, 'date' | 'amount'>): ExtraIncome => ({
  id: 'x' + Math.random(),
  user_id: 'u1',
  type: 'other',
  affects_goal: true,
  ...over,
});

const expense = (over: Partial<Expense> & Pick<Expense, 'date' | 'amount' | 'category'>): Expense => ({
  id: 'g' + Math.random(),
  user_id: 'u1',
  ...over,
});

const budget = (category: string, amount: number, due_day?: number): Budget => ({
  id: 'b_' + category,
  user_id: 'u1',
  category,
  amount,
  due_day,
});

const driverGoal = (over: Partial<UserGoal> = {}): UserGoal => ({
  user_id: 'u1',
  monthly_target: 1000000,
  yearly_target: 12000000,
  working_days: [0, 1, 2, 3, 4, 5, 6],
  income_mode: 'driver',
  ...over,
});

// Julio 2026: mes de 31 días. Usamos el 15 como "hoy" salvo que se indique otra cosa.
const JULY_15 = new Date(2026, 6, 15);

describe('calculateDynamicDailyTarget', () => {
  it('divide el objetivo restante entre los días restantes', () => {
    // Faltan 700.000 en 7 días => 100.000/día
    expect(calculateDynamicDailyTarget(1000000, 300000, 0, 7)).toBe(100000);
  });

  it('descuenta también los extras que afectan la meta', () => {
    expect(calculateDynamicDailyTarget(1000000, 300000, 200000, 5)).toBe(100000);
  });

  it('nunca es negativo cuando ya se superó la meta', () => {
    expect(calculateDynamicDailyTarget(1000000, 1200000, 0, 5)).toBe(0);
  });

  it('si no quedan días, devuelve todo el restante de una vez', () => {
    expect(calculateDynamicDailyTarget(1000000, 300000, 0, 0)).toBe(700000);
  });

  it('si no quedan días y ya se cumplió la meta, devuelve 0', () => {
    expect(calculateDynamicDailyTarget(1000000, 1500000, 0, 0)).toBe(0);
  });
});

describe('calculateStats — modo driver', () => {
  it('sin meta configurada, no revienta y devuelve estado neutro', () => {
    const stats = calculateStats(null, [], [], [], [], [], JULY_15);
    expect(stats.incomeMode).toBe('driver');
    expect(stats.dailyTarget).toBe(0);
    expect(stats.monthlyProgress).toBe(0);
    expect(stats.accumulatedIncome).toBe(0);
  });

  it('acumula solo los ingresos del mes en curso (ignora otros meses)', () => {
    const entries = [
      entry({ date: '2026-07-01', gross_income: 50000 }),
      entry({ date: '2026-07-15', gross_income: 30000 }),
      entry({ date: '2026-06-30', gross_income: 999999 }), // mes anterior, no debe contar
    ];
    const stats = calculateStats(driverGoal(), entries, [], [], [], [], JULY_15);
    expect(stats.accumulatedIncome).toBe(80000);
    expect(stats.netToday).toBe(30000);
  });

  it('extra_income con affects_goal=true reduce la meta diaria; false no la reduce pero sí entra a caja', () => {
    const extras = [
      extra({ date: '2026-07-10', amount: 100000, affects_goal: true }),
      extra({ date: '2026-07-10', amount: 50000, affects_goal: false }), // ej. préstamo recibido
    ];
    const goal = driverGoal({ monthly_target: 500000 });
    const stats = calculateStats(goal, [], extras, [], [], [], JULY_15);
    expect(stats.accumulatedIncome).toBe(100000); // solo el que afecta la meta
    expect(stats.totalCashIn).toBe(150000); // pero ambos entran a la caja real
  });

  it('separa gastos planificados (con presupuesto) de imprevistos', () => {
    const budgets = [budget('arriendo', 300000)];
    const expenses = [
      expense({ date: '2026-07-05', amount: 300000, category: 'Arriendo' }), // case-insensitive
      expense({ date: '2026-07-06', amount: 15000, category: 'cine' }),
    ];
    const stats = calculateStats(driverGoal(), [], [], expenses, budgets, [], JULY_15);
    expect(stats.plannedSpent).toBe(300000);
    expect(stats.unplannedSpent).toBe(15000);
  });

  it('Saldo Libre = caja total − presupuestado − imprevistos − grupos', () => {
    const entries = [entry({ date: '2026-07-01', gross_income: 500000 })];
    const budgets = [budget('bencina', 100000)];
    const expenses = [expense({ date: '2026-07-02', amount: 20000, category: 'comida' })];
    const groupItems = [{ amount: 30000, date: '2026-07-03' }];
    const stats = calculateStats(driverGoal(), entries, [], expenses, budgets, groupItems, JULY_15);
    expect(stats.totalRemaining).toBe(500000 - 100000 - 20000 - 30000);
  });

  it('un ítem de grupo sin fecha (ni created_at) se incluye igual en el mes', () => {
    const groupItems = [{ amount: 25000 }];
    const stats = calculateStats(driverGoal(), [], [], [], [], groupItems, JULY_15);
    expect(stats.groupExpensesTotal).toBe(25000);
  });

  it('un ítem de grupo usa created_at como fallback cuando falta date', () => {
    const groupItems = [
      { amount: 10000, created_at: '2026-07-20T12:00:00Z' }, // dentro del mes
      { amount: 999999, created_at: '2026-06-01T12:00:00Z' }, // fuera del mes
    ];
    const stats = calculateStats(driverGoal(), [], [], [], [], groupItems, JULY_15);
    expect(stats.groupExpensesTotal).toBe(10000);
  });

  it('status "good" cuando el ingreso de hoy alcanza la meta diaria', () => {
    // Meta 700.000 en 7 días restantes = 100.000/día
    const goal = driverGoal({ monthly_target: 700000, working_days: [0, 1, 2, 3, 4, 5, 6] });
    const entries = [entry({ date: '2026-07-15', gross_income: 150000 })];
    const stats = calculateStats(goal, entries, [], [], [], [], JULY_15);
    expect(stats.status).toBe('good');
  });

  it('status "bad" cuando el ingreso de hoy está muy por debajo de la meta diaria', () => {
    const goal = driverGoal({ monthly_target: 700000, working_days: [0, 1, 2, 3, 4, 5, 6] });
    const entries = [entry({ date: '2026-07-15', gross_income: 1000 })];
    const stats = calculateStats(goal, entries, [], [], [], [], JULY_15);
    expect(stats.status).toBe('bad');
  });

  it('respeta working_days al calcular días laborales restantes', () => {
    // Solo trabaja los sábados (6). En julio 2026 el 18 y 25 son sábados después del 15.
    const goal = driverGoal({ monthly_target: 200000, working_days: [6] });
    const stats = calculateStats(goal, [], [], [], [], [], JULY_15);
    // 2 sábados restantes (18 y 25) => 200000 / 2 = 100000
    expect(stats.dailyTarget).toBe(100000);
  });
});

describe('calculateStats — modo salary', () => {
  const salaryGoal = (over: Partial<UserGoal> = {}): UserGoal => ({
    user_id: 'u1',
    monthly_target: 200000, // meta de ahorro
    yearly_target: 2400000,
    working_days: [0, 1, 2, 3, 4, 5, 6],
    income_mode: 'salary',
    salary_amount: 700000,
    salary_pay_day: 30,
    ...over,
  });

  it('sin movimientos, asume el sueldo pendiente para proyectar el ahorro del mes', () => {
    const budgets = [budget('arriendo', 300000), budget('comida', 100000)];
    const stats = calculateStats(salaryGoal(), [], [], [], budgets, [], JULY_15);
    // 700.000 (sueldo asumido) - 400.000 (presupuestos) = 300.000 proyectado
    expect(stats.projectedSavings).toBe(300000);
    expect(stats.salaryReceived).toBe(false);
    // Libre para gastar = ahorro proyectado - meta de ahorro = 300.000 - 200.000
    expect(stats.spendableRemaining).toBe(100000);
  });

  it('no cuenta el sueldo dos veces una vez registrado como extra_income', () => {
    const budgets = [budget('arriendo', 300000), budget('comida', 100000)];
    const extras = [extra({ date: '2026-07-01', amount: 700000, type: 'salary', affects_goal: false })];
    const stats = calculateStats(salaryGoal(), [], extras, [], budgets, [], JULY_15);
    expect(stats.salaryReceived).toBe(true);
    expect(stats.projectedSavings).toBe(300000); // mismo resultado que el caso pendiente
    expect(stats.totalCashIn).toBe(700000);
  });

  it('gastar más del límite diario dispara estado "bad"', () => {
    const budgets = [budget('arriendo', 300000)];
    // Límite libre = (700000 - 300000 - 200000) / días restantes; gasto de hoy muy por encima
    const expenses = [expense({ date: '2026-07-15', amount: 150000, category: 'compras' })];
    const stats = calculateStats(salaryGoal(), [], [], expenses, budgets, [], JULY_15);
    expect(stats.spentToday).toBe(150000);
    expect(stats.status).toBe('bad');
  });

  it('gastar dentro del límite diario mantiene estado "good"', () => {
    const budgets = [budget('arriendo', 300000)];
    const expenses = [expense({ date: '2026-07-15', amount: 1000, category: 'cafe' })];
    const stats = calculateStats(salaryGoal(), [], [], expenses, budgets, [], JULY_15);
    expect(stats.status).toBe('good');
  });
});

describe('calculateStats — modo mixed', () => {
  const mixedGoal: UserGoal = {
    user_id: 'u1',
    monthly_target: 200000,
    yearly_target: 2400000,
    working_days: [5, 6], // maneja viernes y sábado
    income_mode: 'mixed',
    salary_amount: 700000,
    salary_pay_day: 30,
  };
  const budgets = [budget('arriendo', 300000), budget('comida', 100000)];

  it('los ingresos de apps suman directo al ahorro proyectado', () => {
    const entries = [entry({ date: '2026-07-03', gross_income: 20000 })];
    const stats = calculateStats(mixedGoal, entries, [], [], budgets, [], new Date(2026, 6, 3));
    expect(stats.driveIncomeMonth).toBe(20000);
    // 700.000 (sueldo asumido) + 20.000 (apps) - 400.000 (presupuestos) = 320.000
    expect(stats.projectedSavings).toBe(320000);
  });

  it('modo driver no se ve afectado por los campos nuevos de sueldo', () => {
    const goal: UserGoal = { ...mixedGoal, income_mode: 'driver', monthly_target: 1000000 };
    const entries = [entry({ date: '2026-07-15', gross_income: 20000 })];
    const stats = calculateStats(goal, entries, [], [], budgets, [], JULY_15);
    expect(stats.incomeMode).toBe('driver');
    // El sueldo configurado no se asume como caja pendiente en modo driver
    expect(stats.salaryReceived).toBe(false);
    expect(stats.monthlyProgress).toBe(20000 / 1000000);
    expect(stats.dailyTarget).toBeGreaterThan(0);
  });
});
