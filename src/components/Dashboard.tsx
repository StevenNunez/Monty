import React, { useEffect, useMemo, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { DailyEntry, ExtraIncome, UserGoal, Budget, Expense, CreditInstallment, Loan } from '../types';
import { calculateStats } from '../lib/calculations';
import { formatCurrency, cn, localDateStr } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, TrendingDown, Target, Zap, Plus, ShoppingCart, Bell, Package, Handshake, X, Car } from 'lucide-react';
import IncomeForm from './IncomeForm';
import GoalManager from './GoalManager';
import ExtraIncomeForm from './ExtraIncomeForm';
import ExpenseForm from './ExpenseForm';
import ExpenseGroupManager from './ExpenseGroupManager';
import BudgetManager from './BudgetManager';
import InstallmentManager from './InstallmentManager';
import LoanForm from './LoanForm';
import LoanManager from './LoanManager';
import History from './History';
import BudgetView from './BudgetView';
import DashboardSkeleton from './DashboardSkeleton';
import ProgressRing from './ProgressRing';

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function Dashboard({
  user,
  activeTab,
  onCloseTab
}: {
  user: User;
  activeTab?: 'home' | 'history' | 'budget' | 'settings';
  onCloseTab?: () => void;
}) {
  const [goal, setGoal] = useState<UserGoal | null>(null);
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([]);
  const [extraIncomes, setExtraIncomes] = useState<ExtraIncome[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [installments, setInstallments] = useState<CreditInstallment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [groupItems, setGroupItems] = useState<{ amount: number; date?: string | null; created_at?: string | null }[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [showGoalManager, setShowGoalManager] = useState(false);
  const [showExtraForm, setShowExtraForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showBudgetManager, setShowBudgetManager] = useState(false);
  const [showInstallmentManager, setShowInstallmentManager] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [showLoanManager, setShowLoanManager] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [installmentToPay, setInstallmentToPay] = useState<CreditInstallment | null>(null);
  const [showBencinaPrompt, setShowBencinaPrompt] = useState(false);
  const [showBencinaExpenseForm, setShowBencinaExpenseForm] = useState(false);
  const [bencinaDate, setBencinaDate] = useState('');
  const [showSalaryPrompt, setShowSalaryPrompt] = useState(false);
  const [registeringSalary, setRegisteringSalary] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | null>(null);

  const today = useMemo(() => new Date(), []);

  const upcomingPayments = useMemo(() => {
    const currentDay = today.getDate();

    const fromBudgets = budgets
      .filter(b => b.due_day != null)
      .map(b => ({ id: b.id, label: b.category, amount: Number(b.amount), diff: (b.due_day as number) - currentDay, type: 'budget' as const }))
      .filter(p => p.diff >= 0 && p.diff <= 5);

    const fromInstallments = installments
      .filter(inst => {
        if (inst.due_day == null) return false;
        const monthDiff = (today.getFullYear() - inst.start_year) * 12 + (today.getMonth() + 1 - inst.start_month);
        return monthDiff < inst.total_installments;
      })
      .map(inst => ({ id: inst.id, label: inst.description, amount: Number(inst.installment_amount), diff: (inst.due_day as number) - currentDay, type: 'installment' as const }))
      .filter(p => p.diff >= 0 && p.diff <= 5);

    return [...fromBudgets, ...fromInstallments].sort((a, b) => a.diff - b.diff);
  }, [budgets, installments, today]);

  const stats = useMemo(
    () => calculateStats(goal, dailyEntries, extraIncomes, expenses, budgets, groupItems),
    [goal, dailyEntries, extraIncomes, expenses, budgets, groupItems]
  );

  useEffect(() => {
    if (activeTab === 'settings') setShowGoalManager(true);
  }, [activeTab]);

  useEffect(() => {
    if ('Notification' in window) setNotificationPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (initialLoading || !upcomingPayments.length) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const todayStr = today.toDateString();
    if (localStorage.getItem('monty_notif_date') === todayStr) return;
    localStorage.setItem('monty_notif_date', todayStr);
    upcomingPayments.forEach(p => {
      const msg = p.diff === 0 ? '¡Vence hoy!' : p.diff === 1 ? 'Vence mañana' : `Vence en ${p.diff} días`;
      new Notification(`${p.type === 'installment' ? '💳' : '📅'} ${p.label}`, {
        body: `${msg} · ${formatCurrency(p.amount)}`,
        icon: '/favicon.ico',
      });
    });
  }, [initialLoading, upcomingPayments, today]);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotificationPermission(perm);
  };

  // Prompt de sueldo: en modo sueldo/mixto, desde el día de pago pregunta
  // una vez al día hasta que el sueldo del mes quede registrado
  useEffect(() => {
    if (initialLoading || !goal) return;
    const mode = goal.income_mode || 'driver';
    if (mode === 'driver' || !goal.salary_amount || !goal.salary_pay_day) return;
    if (today.getDate() < goal.salary_pay_day) return;
    const received = extraIncomes.some(ei => {
      const d = new Date(ei.date + 'T00:00:00');
      return ei.type === 'salary' && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    });
    if (received) return;
    if (localStorage.getItem('monty_salary_prompt_skip') === localDateStr()) return;
    setShowSalaryPrompt(true);
  }, [initialLoading, goal, extraIncomes, today]);

  const registerSalary = async () => {
    if (!goal?.salary_amount) return;
    setRegisteringSalary(true);
    const { error } = await supabase.from('extra_income').insert({
      user_id: user.id,
      amount: goal.salary_amount,
      type: 'salary',
      affects_goal: false, // suma a la caja pero no infla la meta de ingresos por apps
      date: localDateStr(),
      description: 'Sueldo mensual',
    });
    setRegisteringSalary(false);
    if (!error) {
      setShowSalaryPrompt(false);
      fetchData();
    }
  };

  const skipSalaryPrompt = () => {
    localStorage.setItem('monty_salary_prompt_skip', localDateStr());
    setShowSalaryPrompt(false);
  };

  const fetchData = async () => {
    try {
      const [goalRes, entriesRes, extraRes, expensesRes, budgetsRes, installmentsRes, groupItemsRes, loansRes] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('daily_entries').select('*').eq('user_id', user.id),
        supabase.from('extra_income').select('*').eq('user_id', user.id),
        supabase.from('expenses').select('*').eq('user_id', user.id),
        supabase.from('budgets').select('*').eq('user_id', user.id),
        supabase.from('credit_installments').select('*').eq('user_id', user.id),
        supabase.from('expense_group_items').select('amount, date, created_at').eq('user_id', user.id),
        supabase.from('loans').select('*').eq('user_id', user.id),
      ]);

      if (goalRes.error && goalRes.error.code !== 'PGRST116') throw goalRes.error;
      if (entriesRes.error) throw entriesRes.error;
      if (extraRes.error) throw extraRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (budgetsRes.error) throw budgetsRes.error;
      if (installmentsRes.error) throw installmentsRes.error;

      if (goalRes.data) setGoal(goalRes.data);
      setDailyEntries(entriesRes.data || []);
      setExtraIncomes(extraRes.data || []);
      setExpenses(expensesRes.data || []);
      setBudgets(budgetsRes.data || []);
      setInstallments(installmentsRes.data || []);
      setGroupItems(groupItemsRes.data || []);
      setLoans(loansRes.data || []);
      setDbError(null);
    } catch (err: any) {
      console.error('Database fetch error:', err);
      setDbError(err.message || 'Error al conectar con la base de datos');
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const channels = [
      supabase.channel('entries').on('postgres_changes', { event: '*', schema: 'public', table: 'daily_entries', filter: `user_id=eq.${user.id}` }, () => fetchData()).subscribe(),
      supabase.channel('goals').on('postgres_changes', { event: '*', schema: 'public', table: 'goals', filter: `user_id=eq.${user.id}` }, () => fetchData()).subscribe(),
      supabase.channel('extras').on('postgres_changes', { event: '*', schema: 'public', table: 'extra_income', filter: `user_id=eq.${user.id}` }, () => fetchData()).subscribe(),
      supabase.channel('expenses').on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `user_id=eq.${user.id}` }, () => fetchData()).subscribe(),
      supabase.channel('budgets').on('postgres_changes', { event: '*', schema: 'public', table: 'budgets', filter: `user_id=eq.${user.id}` }, () => fetchData()).subscribe(),
      supabase.channel('installments').on('postgres_changes', { event: '*', schema: 'public', table: 'credit_installments', filter: `user_id=eq.${user.id}` }, () => fetchData()).subscribe(),
      supabase.channel('group_items').on('postgres_changes', { event: '*', schema: 'public', table: 'expense_group_items', filter: `user_id=eq.${user.id}` }, () => fetchData()).subscribe(),
      supabase.channel('loans').on('postgres_changes', { event: '*', schema: 'public', table: 'loans', filter: `user_id=eq.${user.id}` }, () => fetchData()).subscribe(),
    ];
    return () => channels.forEach(channel => supabase.removeChannel(channel));
  }, [user.id]);

  const renderContent = () => {
    if (activeTab === 'budget') {
      return (
        <BudgetView
          goal={goal}
          budgets={budgets}
          balances={stats.categoryBalances}
          unplannedSpent={stats.unplannedSpent}
          groupExpensesTotal={stats.groupExpensesTotal}
          installments={installments}
          allExpenses={expenses}
          onManageBudgets={() => setShowBudgetManager(true)}
          onManageGoals={() => setShowGoalManager(true)}
          onAddInstallment={() => setShowInstallmentManager(true)}
          onPayInstallment={(inst) => setInstallmentToPay(inst)}
        />
      );
    }

    if (initialLoading) return <DashboardSkeleton />;

    return (
      <div className="container mx-auto max-w-lg p-4 pt-8 pb-32">
        {dbError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-2xl text-sm font-medium">
            ⚠️ {dbError}
          </div>
        )}

        {/* Banner pagos próximos */}
        {upcomingPayments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 rounded-2xl bg-amber-50 border border-amber-200 p-4"
          >
            <div className="flex items-start gap-3">
              <Bell className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-800 mb-1.5">
                  {upcomingPayments.length === 1 ? '1 pago próximo' : `${upcomingPayments.length} pagos próximos`}
                </p>
                {upcomingPayments.map(p => (
                  <p key={p.id} className="text-xs text-amber-700 font-medium leading-relaxed">
                    • <span className="capitalize font-bold">{p.label}</span>{p.type === 'installment' ? ' 💳' : ''}: {formatCurrency(p.amount)} —{' '}
                    <span className={p.diff === 0 ? 'text-red-600 font-black' : ''}>
                      {p.diff === 0 ? '¡Hoy!' : p.diff === 1 ? 'mañana' : `en ${p.diff} días`}
                    </span>
                  </p>
                ))}
              </div>
              {notificationPermission !== 'granted' && 'Notification' in window && notificationPermission !== 'denied' && (
                <button
                  onClick={requestNotificationPermission}
                  title="Activar notificaciones"
                  className="flex-shrink-0 p-2 bg-amber-100 text-amber-600 rounded-xl hover:bg-amber-200 transition active:scale-95"
                >
                  <Bell className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Onboarding — sin meta configurada */}
        {!goal && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 rounded-[2rem] bg-indigo-50 border-2 border-dashed border-indigo-200 p-8 text-center"
          >
            <Target className="w-14 h-14 text-indigo-300 mx-auto mb-4" />
            <h2 className="text-xl font-black text-indigo-800 mb-2">¡Configura tu meta!</h2>
            <p className="text-sm text-indigo-500 mb-6 leading-relaxed">
              Cuéntale a Monty cómo generas tus ingresos — apps, sueldo fijo o ambos — y define tu meta del mes.
            </p>
            <button
              onClick={() => setShowGoalManager(true)}
              className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-2xl shadow-lg hover:bg-indigo-700 transition active:scale-95"
            >
              Configurar ahora →
            </button>
          </motion.div>
        )}

        {/* Main Stats Card */}
        {goal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 rounded-[2.5rem] bg-indigo-600 p-8 shadow-xl text-white relative overflow-hidden"
          >
            <div className="relative z-10 text-center">
              <div className="inline-block bg-white/20 rounded-full px-4 py-1 mb-3">
                <span className="text-white text-xs font-bold uppercase tracking-widest">
                  {MONTHS_ES[today.getMonth()]} {today.getFullYear()}
                </span>
              </div>
              {stats.incomeMode === 'driver' ? (
                <>
                  <span className="text-indigo-100 text-sm font-medium uppercase tracking-widest opacity-80 block mb-2">Saldo Libre</span>
                  <h2 className="text-6xl font-black mb-6 tracking-tighter">
                    {formatCurrency(stats.totalRemaining)}
                  </h2>
                </>
              ) : (
                <>
                  <span className="text-indigo-100 text-sm font-medium uppercase tracking-widest opacity-80 block mb-2">Libre para gastar</span>
                  <h2 className="text-6xl font-black mb-2 tracking-tighter">
                    {formatCurrency(stats.spendableRemaining)}
                  </h2>
                  <p className="text-indigo-200 text-[11px] font-medium mb-4">
                    Este mes, ya reservada tu meta de ahorro
                    {!stats.salaryReceived && (goal?.salary_amount || 0) > 0 && ' · asume tu sueldo por llegar'}
                  </p>
                  {stats.incomeMode === 'mixed' && stats.driveIncomeMonth > 0 && (
                    <div className="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-4 py-1.5 mb-4">
                      <Car className="w-3.5 h-3.5 text-emerald-300" />
                      <span className="text-xs font-bold text-emerald-200">
                        Apps: +{formatCurrency(stats.driveIncomeMonth)} este mes
                      </span>
                    </div>
                  )}
                </>
              )}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                {stats.incomeMode === 'driver' ? (
                  <div className="text-left">
                    <span className="text-indigo-200 block text-[10px] uppercase font-bold tracking-wider mb-1">Generado hoy</span>
                    <span className="font-bold text-lg">
                      {formatCurrency(stats.netToday)}
                      <span className="text-indigo-300 text-xs font-normal block">Meta bruta: {formatCurrency(stats.dailyTarget)}</span>
                    </span>
                  </div>
                ) : (
                  <div className="text-left">
                    <span className="text-indigo-200 block text-[10px] uppercase font-bold tracking-wider mb-1">Gastado hoy</span>
                    <span className="font-bold text-lg">
                      {formatCurrency(stats.spentToday)}
                      <span className="text-indigo-300 text-xs font-normal block">Límite hoy: {formatCurrency(stats.spendAvailableToday)}</span>
                    </span>
                  </div>
                )}
                <div className="text-right">
                  <span className="text-indigo-200 block text-[10px] uppercase font-bold tracking-wider mb-1">Plan Gastos</span>
                  <span className="font-bold text-lg">{formatCurrency(stats.totalBudgeted)}</span>
                  <span className="text-indigo-300 text-[10px] block">Asignado</span>
                </div>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full -mr-16 -mt-16 opacity-20" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />
          </motion.div>
        )}

        {/* Daily Progress Ring */}
        {goal && stats.incomeMode === 'driver' && (
          <div className="mb-6 bg-white rounded-[2rem] p-5 border border-gray-100 shadow-sm flex items-center gap-5">
            <ProgressRing
              value={stats.netToday}
              max={stats.dailyTarget}
              size={72}
              strokeWidth={7}
              color={stats.status === 'good' ? '#16a34a' : stats.status === 'warning' ? '#ca8a04' : '#dc2626'}
              trackColor="#f3f4f6"
            />
            <div className="flex-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Progreso del día</span>
              <div className={cn(
                "text-2xl font-black",
                stats.status === 'good' ? "text-green-600" : stats.status === 'warning' ? "text-yellow-600" : "text-red-600"
              )}>
                {formatCurrency(stats.netToday)}
              </div>
              <div className="text-xs text-gray-400">
                {stats.dailyTarget > 0
                  ? `${Math.round(Math.min(100, stats.netToday / stats.dailyTarget * 100))}% de ${formatCurrency(stats.dailyTarget)} meta`
                  : 'Sin meta diaria definida'}
              </div>
            </div>
            <div className={cn(
              "text-xs font-black px-3 py-1 rounded-full",
              stats.status === 'good' ? "bg-green-50 text-green-700" : stats.status === 'warning' ? "bg-yellow-50 text-yellow-700" : "bg-red-50 text-red-700"
            )}>
              {stats.status === 'good' ? '¡Vas bien!' : stats.status === 'warning' ? 'En camino' : 'Bajo meta'}
            </div>
          </div>
        )}

        {/* Gasto del día (modos sueldo/mixto): el anillo se llena con lo gastado */}
        {goal && stats.incomeMode !== 'driver' && (
          <div className="mb-6 bg-white rounded-[2rem] p-5 border border-gray-100 shadow-sm flex items-center gap-5">
            <ProgressRing
              value={stats.spentToday}
              max={Math.max(stats.spendAvailableToday, stats.spentToday, 1)}
              size={72}
              strokeWidth={7}
              color={stats.status === 'good' ? '#16a34a' : stats.status === 'warning' ? '#ca8a04' : '#dc2626'}
              trackColor="#f3f4f6"
            />
            <div className="flex-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Gasto libre de hoy</span>
              <div className={cn(
                "text-2xl font-black",
                stats.status === 'good' ? "text-green-600" : stats.status === 'warning' ? "text-yellow-600" : "text-red-600"
              )}>
                {formatCurrency(stats.spentToday)}
              </div>
              <div className="text-xs text-gray-400">
                {stats.spendAvailableToday > 0
                  ? `de ${formatCurrency(stats.spendAvailableToday)} disponibles hoy`
                  : 'Sin margen de gasto libre hoy'}
              </div>
            </div>
            <div className={cn(
              "text-xs font-black px-3 py-1 rounded-full",
              stats.status === 'good' ? "bg-green-50 text-green-700" : stats.status === 'warning' ? "bg-yellow-50 text-yellow-700" : "bg-red-50 text-red-700"
            )}>
              {stats.status === 'good' ? '¡Vas bien!' : stats.status === 'warning' ? 'Cuidado' : 'Te pasaste'}
            </div>
          </div>
        )}

        {/* Estado Diario + Acumulado */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Estado</span>
            <div className={cn(
              "text-lg font-bold flex items-center",
              stats.status === 'good' ? "text-green-600" : stats.status === 'warning' ? "text-yellow-600" : "text-red-600"
            )}>
              {stats.status === 'good' ? <TrendingUp className="w-5 h-5 mr-2" /> : <TrendingDown className="w-5 h-5 mr-2" />}
              {stats.status === 'good'
                ? '¡Vas bien!'
                : stats.incomeMode === 'driver' ? 'Bajo meta' : 'Gastando de más'}
            </div>
          </div>
          {(() => {
            const gastosReales = stats.plannedSpent + stats.unplannedSpent + stats.groupExpensesTotal;
            const netoReal = stats.totalCashIn - gastosReales;
            return (
              <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm border-l-4 border-l-green-500">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">En Bolsillo este Mes</span>
                <div className={cn("text-2xl font-black tracking-tight", netoReal >= 0 ? "text-green-600" : "text-red-500")}>
                  {formatCurrency(netoReal)}
                </div>
                <span className="text-[8px] text-gray-400 font-bold uppercase tracking-tighter">
                  Bruto {formatCurrency(stats.totalCashIn)} · Gastos -{formatCurrency(gastosReales)}
                </span>
              </div>
            );
          })()}
        </div>

        {/* Tarjeta Préstamos */}
        {(() => {
          const activosPrestamos = loans.filter(l => l.status !== 'saldado');
          const meDeben = activosPrestamos.filter(l => l.type === 'dado').reduce((s, l) => s + (l.amount - l.paid_amount), 0);
          const debo = activosPrestamos.filter(l => l.type === 'recibido').reduce((s, l) => s + (l.amount - l.paid_amount), 0);

          if (activosPrestamos.length === 0) {
            return (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full mb-6 bg-white rounded-[2rem] border border-dashed border-gray-200 p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-300 uppercase tracking-widest flex items-center gap-1.5">
                    <Handshake className="w-4 h-4" /> Préstamos
                  </span>
                  <button
                    onClick={() => setShowLoanForm(true)}
                    className="text-[11px] font-bold text-sky-500 hover:text-sky-600 flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Registrar
                  </button>
                </div>
              </motion.div>
            );
          }

          return (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full mb-6 bg-white rounded-[2rem] border border-gray-100 shadow-sm p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Handshake className="w-4 h-4" /> Préstamos activos
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowLoanForm(true)}
                    className="text-[11px] font-bold text-sky-400 hover:text-sky-600 flex items-center gap-1 transition p-1"
                    aria-label="Nuevo préstamo"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setShowLoanManager(true)}
                    className="text-[10px] font-bold text-sky-500 hover:text-sky-700 transition"
                  >
                    {activosPrestamos.length} activo{activosPrestamos.length !== 1 ? 's' : ''} →
                  </button>
                </div>
              </div>
              <button
                onClick={() => setShowLoanManager(true)}
                className="w-full text-left"
              >
                <div className="grid grid-cols-2 gap-3">
                  {meDeben > 0 && (
                    <div className="bg-sky-50 rounded-xl p-3 border border-sky-100">
                      <p className="text-[10px] font-bold text-sky-500 uppercase tracking-wider">Te deben</p>
                      <p className="text-lg font-black text-sky-700">{formatCurrency(meDeben)}</p>
                    </div>
                  )}
                  {debo > 0 && (
                    <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                      <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Debes</p>
                      <p className="text-lg font-black text-amber-700">{formatCurrency(debo)}</p>
                    </div>
                  )}
                </div>
              </button>
            </motion.div>
          );
        })()}

        {/* Progreso Meta Mensual (conductor) / Meta de Ahorro (sueldo/mixto) */}
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                {stats.incomeMode === 'driver' ? 'Progreso Meta Mensual' : 'Meta de Ahorro'}
              </span>
              <span className={cn(
                "text-sm font-bold",
                stats.incomeMode !== 'driver' && stats.monthlyProgress < 1 ? "text-amber-600" : "text-indigo-600"
              )}>
                {Math.round(Math.max(0, stats.monthlyProgress) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden mb-3">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(0, stats.monthlyProgress) * 100)}%` }}
                className={cn(
                  "h-full shadow-[0_0_10px_rgba(79,70,229,0.3)]",
                  stats.incomeMode !== 'driver' && stats.monthlyProgress < 1 ? "bg-amber-500" : "bg-indigo-600"
                )}
              />
            </div>
            {stats.incomeMode === 'driver' ? (
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[9px] text-gray-400 font-bold uppercase block">Ganado</span>
                  <span className="text-sm font-black text-gray-700">{formatCurrency(stats.accumulatedIncome)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-gray-400 font-bold uppercase block">Faltan</span>
                  <span className="text-sm font-black text-indigo-600">
                    {formatCurrency(Math.max(0, (goal?.monthly_target || 0) - stats.accumulatedIncome))}
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[9px] text-gray-400 font-bold uppercase block">Ahorro proyectado</span>
                    <span className={cn(
                      "text-sm font-black",
                      stats.projectedSavings >= (goal?.monthly_target || 0) ? "text-green-600" : "text-amber-600"
                    )}>
                      {formatCurrency(stats.projectedSavings)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-gray-400 font-bold uppercase block">Meta</span>
                    <span className="text-sm font-black text-indigo-600">
                      {formatCurrency(goal?.monthly_target || 0)}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-2">
                  {stats.monthlyProgress >= 1
                    ? '✓ Si mantienes tu ritmo de gasto, cumples tu meta de ahorro.'
                    : 'Tu gasto actual compromete la meta de ahorro. Reduce gastos o suma ingresos extra.'}
                  {stats.incomeMode === 'mixed' && stats.driveIncomeMonth > 0 &&
                    ` Las apps te aportaron ${formatCurrency(stats.driveIncomeMonth)}.`}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {renderContent()}

      {/* Quick Action Floating Panel */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-40">
        {/* Menú secundario expandible */}
        <AnimatePresence>
          {showMoreMenu && (
            <>
              {/* Backdrop para cerrar */}
              <div
                className="fixed inset-0 z-[-1]"
                onClick={() => setShowMoreMenu(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                className="mb-2 bg-gray-800 border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
              >
                <button
                  onClick={() => { setShowGroupForm(true); setShowMoreMenu(false); }}
                  className="w-full flex items-center gap-3 px-5 py-4 text-violet-300 hover:bg-violet-500/20 transition-colors active:scale-95 border-b border-white/5"
                >
                  <div className="p-2 rounded-xl bg-violet-500/20">
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-white">Gasto en grupo</p>
                    <p className="text-[11px] text-gray-400">Divide con otras personas</p>
                  </div>
                </button>
                <button
                  onClick={() => { setShowLoanForm(true); setShowMoreMenu(false); }}
                  className="w-full flex items-center gap-3 px-5 py-4 text-sky-300 hover:bg-sky-500/20 transition-colors active:scale-95"
                >
                  <div className="p-2 rounded-xl bg-sky-500/20">
                    <Handshake className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-white">Préstamo</p>
                    <p className="text-[11px] text-gray-400">Presté o me prestaron</p>
                  </div>
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Barra principal */}
        <div className="bg-gray-900 shadow-2xl rounded-3xl p-2 flex gap-2 border border-white/10 backdrop-blur-xl">
          <button
            onClick={() => setShowExpenseForm(true)}
            className="flex-1 flex items-center justify-center bg-red-500/10 text-red-400 p-4 rounded-2xl font-bold hover:bg-red-500 hover:text-white transition-all active:scale-95 gap-2"
          >
            <ShoppingCart className="w-5 h-5" />
            <span>Gastar</span>
          </button>
          <button
            onClick={() => setShowIncomeForm(true)}
            className="flex-1 flex items-center justify-center bg-green-500 text-white p-4 rounded-2xl font-bold shadow-lg hover:bg-green-600 transition-all active:scale-95 gap-2"
          >
            <Plus className="w-5 h-5" />
            <span>Ganar</span>
          </button>
          <button
            onClick={() => setShowMoreMenu(v => !v)}
            className={cn(
              "flex items-center justify-center w-14 rounded-2xl font-bold transition-all active:scale-95",
              showMoreMenu
                ? "bg-white/20 text-white"
                : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
            )}
            aria-label="Más acciones"
          >
            <motion.div
              animate={{ rotate: showMoreMenu ? 45 : 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              {showMoreMenu ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </motion.div>
          </button>
        </div>
      </div>

      {/* Modals */}
      {showIncomeForm && (
        <IncomeForm
          user={user}
          onClose={() => setShowIncomeForm(false)}
          onRefresh={fetchData}
          onSaved={(date) => {
            setBencinaDate(date);
            setTimeout(() => setShowBencinaPrompt(true), 500);
          }}
        />
      )}
      {showExpenseForm && <ExpenseForm user={user} categories={budgets.map(b => b.category)} onClose={() => setShowExpenseForm(false)} onRefresh={fetchData} />}
      {showGoalManager && (
        <GoalManager user={user} currentGoal={goal} onClose={() => {
          setShowGoalManager(false);
          onCloseTab?.();
        }} onRefresh={fetchData} />
      )}
      {showExtraForm && <ExtraIncomeForm user={user} onClose={() => setShowExtraForm(false)} onRefresh={fetchData} />}
      {showBudgetManager && (
        <BudgetManager
          user={user}
          budgets={budgets}
          onClose={() => setShowBudgetManager(false)}
          onRefresh={fetchData}
        />
      )}
      {showInstallmentManager && (
        <InstallmentManager
          user={user}
          installments={installments}
          onClose={() => setShowInstallmentManager(false)}
          onRefresh={fetchData}
        />
      )}
      {installmentToPay && (
        <ExpenseForm
          user={user}
          categories={budgets.map(b => b.category)}
          defaultCategory={installmentToPay.description}
          defaultAmount={installmentToPay.installment_amount}
          defaultIsUnplanned={true}
          onClose={() => setInstallmentToPay(null)}
          onRefresh={() => { fetchData(); setInstallmentToPay(null); }}
        />
      )}

      {showGroupForm && <ExpenseGroupManager user={user} onClose={() => setShowGroupForm(false)} onRefresh={fetchData} />}
      {showLoanForm && <LoanForm user={user} onClose={() => setShowLoanForm(false)} onRefresh={fetchData} />}
      {showLoanManager && <LoanManager user={user} loans={loans} onClose={() => setShowLoanManager(false)} onRefresh={fetchData} />}

      {activeTab === 'history' && <History userId={user.id} onClose={() => onCloseTab?.()} onRefresh={fetchData} />}

      {/* Prompt bencina post-ingreso */}
      {showBencinaPrompt && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[150] flex items-center justify-center p-4"
          onClick={() => setShowBencinaPrompt(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-7 max-w-xs w-full shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-5xl mb-4">⛽</div>
            <h3 className="text-xl font-black text-gray-800 mb-2">¿Cargaste bencina?</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Registra el gasto para que tu saldo libre y presupuesto sean exactos.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setShowBencinaPrompt(false);
                  setShowBencinaExpenseForm(true);
                }}
                className="bg-orange-500 text-white font-bold py-3 rounded-2xl hover:bg-orange-600 transition active:scale-95"
              >
                Sí, registrar
              </button>
              <button
                onClick={() => setShowBencinaPrompt(false)}
                className="bg-gray-100 text-gray-600 font-bold py-3 rounded-2xl hover:bg-gray-200 transition active:scale-95"
              >
                No, omitir
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showBencinaExpenseForm && (
        <ExpenseForm
          user={user}
          categories={budgets.map(b => b.category)}
          defaultCategory="bencina"
          defaultDate={bencinaDate}
          defaultIsUnplanned={!budgets.some(b => b.category.toLowerCase() === 'bencina')}
          onClose={() => setShowBencinaExpenseForm(false)}
          onRefresh={fetchData}
        />
      )}

      {/* Prompt de sueldo el día de pago (modos sueldo/mixto) */}
      {showSalaryPrompt && goal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[150] flex items-center justify-center p-4"
          onClick={skipSalaryPrompt}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-7 max-w-xs w-full shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-5xl mb-4">💰</div>
            <h3 className="text-xl font-black text-gray-800 mb-2">¿Te llegó tu sueldo?</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Registra tu sueldo de <b className="text-gray-700">{formatCurrency(Number(goal.salary_amount))}</b> para
              que tu disponible del mes sea exacto.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={registerSalary}
                disabled={registeringSalary}
                className="bg-emerald-500 text-white font-bold py-3 rounded-2xl hover:bg-emerald-600 transition active:scale-95 disabled:opacity-50"
              >
                {registeringSalary ? 'Guardando…' : 'Sí, registrar'}
              </button>
              <button
                onClick={skipSalaryPrompt}
                className="bg-gray-100 text-gray-600 font-bold py-3 rounded-2xl hover:bg-gray-200 transition active:scale-95"
              >
                Aún no
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-4">
              Si tu sueldo varió este mes, regístralo manualmente con el botón ⚡ como tipo "Sueldo".
            </p>
          </motion.div>
        </div>
      )}

      <button
        onClick={() => setShowExtraForm(true)}
        className="fixed top-6 right-4 p-3 bg-white shadow-xl rounded-full border border-gray-100 text-gray-500 hover:text-indigo-600 transition"
      >
        <Zap className="w-5 h-5" />
      </button>
    </>
  );
}
