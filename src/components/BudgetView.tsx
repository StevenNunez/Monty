import React, { useState } from 'react';
import { UserGoal, Budget, CategoryBalance, CreditInstallment, ActiveInstallment, Expense } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { motion } from 'motion/react';
import { Wallet, Target, ArrowRight, Plus, PieChart, ShoppingCart, CheckCircle, Clock, Calendar, CreditCard } from 'lucide-react';

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function getActiveInstallmentsForMonth(
  installments: CreditInstallment[],
  allExpenses: Expense[],
  year: number,
  month: number
): ActiveInstallment[] {
  const monthExp = allExpenses.filter(e => {
    const d = new Date(e.date + 'T00:00:00');
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  return installments
    .map(inst => {
      const monthsDiff = (year - inst.start_year) * 12 + (month - inst.start_month);
      const current_installment = monthsDiff + 1;
      if (current_installment < 1 || current_installment > inst.total_installments) return null;

      const amount_paid = monthExp
        .filter(e => e.category.trim().toLowerCase() === inst.description.trim().toLowerCase())
        .reduce((sum, e) => sum + Number(e.amount), 0);

      return {
        ...inst,
        current_installment,
        is_paid: amount_paid >= Number(inst.installment_amount),
        amount_paid,
      };
    })
    .filter((x): x is ActiveInstallment => x !== null);
}

export default function BudgetView({
  goal,
  budgets,
  balances,
  unplannedSpent,
  installments,
  allExpenses,
  onManageBudgets,
  onManageGoals,
  onAddInstallment,
  onPayInstallment,
}: {
  goal: UserGoal | null;
  budgets: Budget[];
  balances: CategoryBalance[];
  unplannedSpent: number;
  installments: CreditInstallment[];
  allExpenses: Expense[];
  onManageBudgets: () => void;
  onManageGoals: () => void;
  onAddInstallment: () => void;
  onPayInstallment: (inst: CreditInstallment) => void;
}) {
  const [viewingNextMonth, setViewingNextMonth] = useState(false);

  const today = new Date();
  const currentMonthName = MONTHS_ES[today.getMonth()];
  const nextMonthName = MONTHS_ES[(today.getMonth() + 1) % 12];

  // Determine the year/month being viewed
  const viewYear = viewingNextMonth
    ? (today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear())
    : today.getFullYear();
  const viewMonth = viewingNextMonth
    ? (today.getMonth() === 11 ? 1 : today.getMonth() + 2)
    : (today.getMonth() + 1);

  const activeInstallments = getActiveInstallmentsForMonth(installments, allExpenses, viewYear, viewMonth);
  const totalInstallmentsAmount = activeInstallments.reduce((s, i) => s + Number(i.installment_amount), 0);

  const totalBudgeted = budgets.reduce((sum, b) => sum + Number(b.amount), 0) + totalInstallmentsAmount;
  const monthlyIncome = goal?.monthly_target || 0;
  const theoreticalFree = monthlyIncome - totalBudgeted;
  const currentFreeBalance = theoreticalFree - unplannedSpent;

  // Only budgets with a due_day, sorted by day
  const scheduledBudgets = budgets
    .filter(b => b.due_day != null)
    .sort((a, b) => (a.due_day ?? 0) - (b.due_day ?? 0));

  const hasScheduledItems = scheduledBudgets.length > 0 || activeInstallments.length > 0;

  const getBalanceFor = (category: string) =>
    balances.find(bl => bl.category.trim().toLowerCase() === category.trim().toLowerCase());

  const getPaymentStatus = (budget: Budget): 'paid' | 'partial' | 'pending' => {
    if (viewingNextMonth) return 'pending';
    const bal = getBalanceFor(budget.category);
    if (!bal || bal.spent <= 0) return 'pending';
    if (bal.remaining <= 0) return 'paid';
    return 'partial';
  };

  const getDaysLabel = (budget: Budget): { label: string; urgent: boolean } => {
    if (!budget.due_day) return { label: '', urgent: false };
    const dueDay = budget.due_day;

    if (viewingNextMonth) {
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
      const diffDays = Math.ceil((nextMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) return { label: 'Mañana', urgent: true };
      return { label: `en ${diffDays} días`, urgent: diffDays <= 5 };
    }

    const diff = dueDay - today.getDate();
    if (diff < 0) return { label: `Venció hace ${Math.abs(diff)} días`, urgent: true };
    if (diff === 0) return { label: '¡Vence hoy!', urgent: true };
    if (diff === 1) return { label: 'Vence mañana', urgent: true };
    return { label: `Vence en ${diff} días`, urgent: diff <= 3 };
  };

  return (
    <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32">
      <header className="flex justify-between items-center mb-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Mi Plan Mensual</h2>
          <p className="text-gray-500">Gestión de meta y gastos fijos</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onAddInstallment}
            className="p-3 bg-purple-50 text-purple-600 rounded-2xl hover:bg-purple-100 transition"
            title="Gestionar cuotas"
          >
            <CreditCard className="w-5 h-5" />
          </button>
          <button onClick={onManageBudgets} className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Summary Card */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100">
        <div className="grid grid-cols-1 gap-6">
          <div className="flex items-center justify-between cursor-pointer" onClick={onManageGoals}>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-50 text-green-600 rounded-2xl">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Meta Ingresos</span>
                <span className="text-xl font-bold">{formatCurrency(monthlyIncome)}</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300" />
          </div>

          <div className="h-px bg-gray-100" />

          <div className="flex items-center justify-between cursor-pointer" onClick={onManageBudgets}>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Presupuestado Fijo</span>
                <span className="text-xl font-bold">{formatCurrency(totalBudgeted)}</span>
                {totalInstallmentsAmount > 0 && (
                  <span className="text-[10px] text-purple-500 font-bold block">
                    Incl. {formatCurrency(totalInstallmentsAmount)} en cuotas
                  </span>
                )}
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300" />
          </div>

          <div className="mt-4 p-5 bg-indigo-600 rounded-3xl text-white flex justify-between items-center shadow-lg shadow-indigo-200">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Saldo Libre Real</span>
              <div className="text-2xl font-black">{formatCurrency(currentFreeBalance)}</div>
              <span className="text-[8px] opacity-70">Descontando imprevistos</span>
            </div>
            <div className="p-2 bg-white/20 rounded-full">
              <PieChart className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Próximos Pagos */}
      {hasScheduledItems && (
        <section>
          <div className="flex justify-between items-center mb-4 px-2">
            <h3 className="text-lg font-bold text-gray-800">Próximos Pagos</h3>
            <div className="flex items-center bg-gray-100 rounded-2xl p-1">
              <button
                onClick={() => setViewingNextMonth(false)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition",
                  !viewingNextMonth ? "bg-white text-gray-800 shadow-sm" : "text-gray-400"
                )}
              >
                {currentMonthName}
              </button>
              <button
                onClick={() => setViewingNextMonth(true)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition",
                  viewingNextMonth ? "bg-white text-gray-800 shadow-sm" : "text-gray-400"
                )}
              >
                {nextMonthName}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {/* Scheduled budgets */}
            {scheduledBudgets.map((budget, i) => {
              const status = getPaymentStatus(budget);
              const { label: daysLabel, urgent } = getDaysLabel(budget);
              const bal = getBalanceFor(budget.category);

              return (
                <motion.div
                  key={budget.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-2xl border",
                    status === 'paid'
                      ? "bg-green-50 border-green-100"
                      : urgent
                        ? "bg-red-50 border-red-100"
                        : "bg-white border-gray-100 shadow-sm"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                    status === 'paid'   ? "bg-green-100 text-green-600" :
                    urgent             ? "bg-red-100 text-red-400" :
                                         "bg-gray-100 text-gray-400"
                  )}>
                    {status === 'paid'
                      ? <CheckCircle className="w-5 h-5" />
                      : <Clock className="w-5 h-5" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-800 capitalize">{budget.category}</span>
                      {status === 'paid' && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Pagado</span>
                      )}
                      {status === 'partial' && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">Parcial</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      <span className={cn(
                        "text-xs font-semibold",
                        urgent && status !== 'paid' ? "text-red-500" : "text-gray-400"
                      )}>
                        Día {budget.due_day} — {daysLabel}
                      </span>
                    </div>
                    {status === 'partial' && bal && (
                      <p className="text-[10px] text-orange-500 font-bold mt-0.5">
                        Pagado {formatCurrency(bal.spent)} de {formatCurrency(bal.budgeted)}
                      </p>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className={cn(
                      "text-lg font-black",
                      status === 'paid' ? "text-green-600" : "text-gray-700"
                    )}>
                      {formatCurrency(Number(budget.amount))}
                    </span>
                  </div>
                </motion.div>
              );
            })}

            {/* Active installments */}
            {activeInstallments.map((inst, i) => (
              <motion.div
                key={inst.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (scheduledBudgets.length + i) * 0.05 }}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-2xl border",
                  inst.is_paid
                    ? "bg-green-50 border-green-100"
                    : "bg-purple-50 border-purple-100"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                  inst.is_paid ? "bg-green-100 text-green-600" : "bg-purple-100 text-purple-600"
                )}>
                  {inst.is_paid ? <CheckCircle className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-800 capitalize">{inst.description}</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                      Cuota {inst.current_installment}/{inst.total_installments}
                    </span>
                    {inst.is_paid && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Pagado</span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-400 font-bold mt-0.5">
                    Total {formatCurrency(inst.total_amount)} en {inst.total_installments} cuotas
                  </div>
                  {inst.amount_paid > 0 && !inst.is_paid && (
                    <p className="text-[10px] text-orange-500 font-bold mt-0.5">
                      Pagado {formatCurrency(inst.amount_paid)} de {formatCurrency(inst.installment_amount)}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className={cn(
                    "text-lg font-black",
                    inst.is_paid ? "text-green-600" : "text-purple-700"
                  )}>
                    {formatCurrency(Number(inst.installment_amount))}
                  </span>
                  {!inst.is_paid && !viewingNextMonth && (
                    <button
                      onClick={() => onPayInstallment(inst)}
                      className="text-[10px] font-black uppercase tracking-widest text-white bg-purple-600 px-3 py-1 rounded-full hover:bg-purple-700 transition active:scale-95"
                    >
                      Pagar
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Unplanned Section */}
      <section>
        <div className="flex justify-between items-end mb-4 px-2">
          <h3 className="text-lg font-bold text-gray-800">Gastos No Planificados</h3>
          <span className="text-xs font-bold text-orange-600 uppercase">Imprevistos</span>
        </div>
        <div className="bg-orange-50 border border-orange-100 p-5 rounded-3xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-orange-500 shadow-sm">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-gray-800">Otros / Imprevistos</span>
              <p className="text-[10px] text-gray-500">Galletas, remedios, ropa, etc.</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-black text-orange-600">
              {formatCurrency(unplannedSpent)}
            </div>
            <span className="text-[10px] text-gray-400 font-bold uppercase">Gastado</span>
          </div>
        </div>
      </section>

      {/* Category List */}
      <section>
        <div className="flex justify-between items-end mb-4 px-2">
          <h3 className="text-lg font-bold text-gray-800">Gastos Planificados</h3>
          <span className="text-xs font-bold text-indigo-600 uppercase">{balances.length} Categorías</span>
        </div>

        <div className="space-y-4">
          {balances.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
              <p className="text-gray-400 text-sm">Aún no has definido tus gastos fijos.</p>
              <button onClick={onManageBudgets} className="mt-4 font-bold text-indigo-600 text-sm">
                + Empezar ahora
              </button>
            </div>
          ) : (
            balances.map((cat, i) => {
              const isPaid = cat.remaining <= 0;
              return (
                <motion.div
                  key={cat.category}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    "bg-white p-5 rounded-[2rem] border transition transform active:scale-98 cursor-pointer",
                    isPaid ? "border-green-100 bg-green-50/20" : "border-gray-50 shadow-sm"
                  )}
                  onClick={onManageBudgets}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center font-black",
                        isPaid ? "bg-green-100 text-green-600" : "bg-indigo-50 text-indigo-600"
                      )}>
                        {isPaid ? <CheckCircle className="w-5 h-5" /> : cat.category.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-bold text-gray-800 capitalize leading-none block">{cat.category}</span>
                        {isPaid && <span className="text-[9px] font-black uppercase text-green-600 tracking-widest">Pagado</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter block mb-1">Presupuesto</span>
                      <span className="text-lg font-black text-gray-900 leading-none">{formatCurrency(cat.budgeted)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (cat.spent / cat.budgeted) * 100)}%` }}
                        className={cn(
                          "h-full transition-colors",
                          isPaid ? "bg-green-500" : (cat.remaining < 0 ? "bg-red-500" : "bg-indigo-600")
                        )}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest">
                      <span className="text-gray-400">Gastado: {formatCurrency(cat.spent)}</span>
                      <span className={cn(cat.remaining < 0 ? "text-red-500" : "text-green-600")}>
                        {cat.remaining < 0
                          ? `Excedido: ${formatCurrency(Math.abs(cat.remaining))}`
                          : `Resta: ${formatCurrency(cat.remaining)}`}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
