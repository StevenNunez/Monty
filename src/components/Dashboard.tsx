import React, { useEffect, useMemo, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { DailyEntry, ExtraIncome, UserGoal, Budget, Expense, CreditInstallment } from '../types';
import { calculateStats } from '../lib/calculations';
import { formatCurrency, cn } from '../lib/utils';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Target, Zap, Plus, ShoppingCart, Bell } from 'lucide-react';
import IncomeForm from './IncomeForm';
import GoalManager from './GoalManager';
import ExtraIncomeForm from './ExtraIncomeForm';
import ExpenseForm from './ExpenseForm';
import BudgetManager from './BudgetManager';
import InstallmentManager from './InstallmentManager';
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
  const [initialLoading, setInitialLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [showGoalManager, setShowGoalManager] = useState(false);
  const [showExtraForm, setShowExtraForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showBudgetManager, setShowBudgetManager] = useState(false);
  const [showInstallmentManager, setShowInstallmentManager] = useState(false);
  const [installmentToPay, setInstallmentToPay] = useState<CreditInstallment | null>(null);
  const [showBencinaPrompt, setShowBencinaPrompt] = useState(false);
  const [showBencinaExpenseForm, setShowBencinaExpenseForm] = useState(false);
  const [bencinaDate, setBencinaDate] = useState('');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | null>(null);

  const today = useMemo(() => new Date(), []);

  const upcomingPayments = useMemo(() => {
    const currentDay = today.getDate();
    return budgets
      .filter(b => b.due_day != null)
      .map(b => ({ ...b, diff: (b.due_day as number) - currentDay }))
      .filter(b => b.diff >= 0 && b.diff <= 5)
      .sort((a, b) => a.diff - b.diff);
  }, [budgets, today]);

  const stats = useMemo(
    () => calculateStats(goal, dailyEntries, extraIncomes, expenses, budgets),
    [goal, dailyEntries, extraIncomes, expenses, budgets]
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
      new Notification(`💳 ${p.category}`, {
        body: `${msg} · ${formatCurrency(Number(p.amount))}`,
        icon: '/favicon.ico',
      });
    });
  }, [initialLoading, upcomingPayments, today]);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotificationPermission(perm);
  };

  const fetchData = async () => {
    try {
      const [goalRes, entriesRes, extraRes, expensesRes, budgetsRes, installmentsRes] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('daily_entries').select('*').eq('user_id', user.id),
        supabase.from('extra_income').select('*').eq('user_id', user.id),
        supabase.from('expenses').select('*').eq('user_id', user.id),
        supabase.from('budgets').select('*').eq('user_id', user.id),
        supabase.from('credit_installments').select('*').eq('user_id', user.id),
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
                    • <span className="capitalize font-bold">{p.category}</span>: {formatCurrency(Number(p.amount))} —{' '}
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
              Define cuánto quieres ganar al mes y Monty calculará tu meta diaria automáticamente.
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
              <span className="text-indigo-100 text-sm font-medium uppercase tracking-widest opacity-80 block mb-2">Saldo Libre</span>
              <h2 className="text-6xl font-black mb-6 tracking-tighter">
                {formatCurrency(stats.totalRemaining)}
              </h2>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                <div className="text-left">
                  <span className="text-indigo-200 block text-[10px] uppercase font-bold tracking-wider mb-1">Generado hoy</span>
                  <span className="font-bold text-lg">
                    {formatCurrency(stats.netToday)}
                    <span className="text-indigo-300 text-xs font-normal block">Meta bruta: {formatCurrency(stats.dailyTarget)}</span>
                  </span>
                </div>
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
        {goal && (
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

        {/* Estado Diario + Acumulado */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Estado</span>
            <div className={cn(
              "text-lg font-bold flex items-center",
              stats.status === 'good' ? "text-green-600" : stats.status === 'warning' ? "text-yellow-600" : "text-red-600"
            )}>
              {stats.status === 'good' ? <TrendingUp className="w-5 h-5 mr-2" /> : <TrendingDown className="w-5 h-5 mr-2" />}
              {stats.status === 'good' ? '¡Vas bien!' : 'Bajo meta'}
            </div>
          </div>
          {(() => {
            const gastosReales = stats.plannedSpent + stats.unplannedSpent;
            const netoReal = stats.accumulatedIncome - gastosReales;
            return (
              <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm border-l-4 border-l-green-500">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">En Bolsillo este Mes</span>
                <div className={cn("text-2xl font-black tracking-tight", netoReal >= 0 ? "text-green-600" : "text-red-500")}>
                  {formatCurrency(netoReal)}
                </div>
                <span className="text-[8px] text-gray-400 font-bold uppercase tracking-tighter">
                  Bruto {formatCurrency(stats.accumulatedIncome)} · Gastos -{formatCurrency(gastosReales)}
                </span>
              </div>
            );
          })()}
        </div>

        {/* Progreso Meta Mensual */}
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Progreso Meta Mensual</span>
              <span className="text-sm font-bold text-indigo-600">{Math.round(stats.monthlyProgress * 100)}%</span>
            </div>
            <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden mb-3">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, stats.monthlyProgress * 100)}%` }}
                className="h-full bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.3)]"
              />
            </div>
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
        <div className="bg-gray-900 shadow-2xl rounded-3xl p-2 flex gap-2 border border-white/10 backdrop-blur-xl">
          <button
            onClick={() => setShowExpenseForm(true)}
            className="flex-1 flex items-center justify-center bg-red-500/10 text-red-400 p-4 rounded-2xl font-bold hover:bg-red-500 hover:text-white transition-all active:scale-95"
          >
            <ShoppingCart className="w-5 h-5 mr-2" /> Gastar
          </button>
          <button
            onClick={() => setShowIncomeForm(true)}
            className="flex-1 flex items-center justify-center bg-green-500 text-white p-4 rounded-2xl font-bold shadow-lg hover:bg-green-600 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5 mr-2" /> Ganar
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
      {showExtraForm && <ExtraIncomeForm user={user} onClose={() => setShowExtraForm(false)} />}
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

      <button
        onClick={() => setShowExtraForm(true)}
        className="fixed top-6 right-4 p-3 bg-white shadow-xl rounded-full border border-gray-100 text-gray-500 hover:text-indigo-600 transition"
      >
        <Zap className="w-5 h-5" />
      </button>
    </>
  );
}
