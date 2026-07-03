import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, cn, localDateStr } from '../lib/utils';
import { X, ArrowUpRight, ArrowDownRight, Gift, ChevronLeft, ChevronRight, ChevronDown, Trash2, Save, RefreshCw, Download, BarChart2, CalendarDays, Package, Plus, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ExpenseGroup } from '../types';

interface HistoryItem {
  id: string;
  type: 'income' | 'expense' | 'extra' | 'group_expense';
  amount: number;
  description: string;
  date: string;
  groupName?: string;
  extraType?: string; // subtipo de extra_income (salary, bonus, etc.)
}

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

type AnalysisPeriod = 'month' | '3m' | 'year' | 'all';

export default function History({ userId, onClose, onRefresh }: { userId: string; onClose: () => void; onRefresh?: () => void }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(localDateStr());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeView, setActiveView] = useState<'movimientos' | 'analisis' | 'grupos'>('movimientos');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [expenseGroups, setExpenseGroups] = useState<ExpenseGroup[]>([]);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [addingItemToGroupId, setAddingItemToGroupId] = useState<string | null>(null);
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemAmt, setNewItemAmt] = useState('');
  const [newItemDate, setNewItemDate] = useState(localDateStr());
  const [savingItem, setSavingItem] = useState(false);
  const [saveItemError, setSaveItemError] = useState<string | null>(null);

  const [periodType, setPeriodType] = useState<AnalysisPeriod>('month');
  const [periodAnchor, setPeriodAnchor] = useState(new Date());

  const [editingGroupItemId, setEditingGroupItemId] = useState<string | null>(null);
  const [editItemDesc, setEditItemDesc] = useState('');
  const [editItemAmt, setEditItemAmt] = useState('');
  const [editItemDate, setEditItemDate] = useState('');
  const [editItemError, setEditItemError] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameGroupValue, setRenameGroupValue] = useState('');

  const fetchGroups = async () => {
    const { data } = await supabase
      .from('expense_groups')
      .select('*, expense_group_items(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setExpenseGroups(data || []);
  };

  const handleAddItemToGroup = async (groupId: string) => {
    if (!newItemDesc.trim() || Number(newItemAmt) <= 0) return;
    setSavingItem(true);
    setSaveItemError(null);

    const payload: Record<string, unknown> = {
      group_id: groupId,
      user_id: userId,
      description: newItemDesc.trim(),
      amount: Number(newItemAmt),
    };
    if (newItemDate) payload.date = newItemDate;

    const { error } = await supabase.from('expense_group_items').insert(payload);

    if (!error) {
      setNewItemDesc('');
      setNewItemAmt('');
      setNewItemDate(localDateStr());
      setAddingItemToGroupId(null);
      setSaveItemError(null);
      fetchGroups();
    } else {
      // Si falló por la columna date (tabla sin la migración), reintentar sin date
      if (error.message?.includes('date') || error.code === '42703') {
        const { error: error2 } = await supabase.from('expense_group_items').insert({
          group_id: groupId,
          user_id: userId,
          description: newItemDesc.trim(),
          amount: Number(newItemAmt),
        });
        if (!error2) {
          setNewItemDesc('');
          setNewItemAmt('');
          setNewItemDate(localDateStr());
          setAddingItemToGroupId(null);
          setSaveItemError(null);
          fetchGroups();
        } else {
          setSaveItemError(error2.message);
        }
      } else {
        setSaveItemError(error.message);
      }
    }
    setSavingItem(false);
  };

  const handleUpdateGroupItem = async (itemId: string) => {
    if (!editItemDesc.trim() || Number(editItemAmt) <= 0) return;
    setSavingItem(true);
    setEditItemError(null);

    const payload: Record<string, unknown> = {
      description: editItemDesc.trim(),
      amount: Number(editItemAmt),
    };
    if (editItemDate) payload.date = editItemDate;

    let { error } = await supabase.from('expense_group_items').update(payload).eq('id', itemId);

    // Si falló por la columna date (tabla sin la migración), reintentar sin date
    if (error && (error.message?.includes('date') || error.code === '42703')) {
      ({ error } = await supabase
        .from('expense_group_items')
        .update({ description: editItemDesc.trim(), amount: Number(editItemAmt) })
        .eq('id', itemId));
    }

    if (!error) {
      setEditingGroupItemId(null);
      fetchGroups();
      fetchHistory(true);
      onRefresh?.();
    } else {
      setEditItemError(error.message);
    }
    setSavingItem(false);
  };

  const handleDeleteGroupItem = async (itemId: string) => {
    if (deletingItemId !== itemId) {
      setDeletingItemId(itemId);
      setTimeout(() => setDeletingItemId(null), 3000);
      return;
    }
    const { error } = await supabase.from('expense_group_items').delete().eq('id', itemId);
    if (!error) {
      setDeletingItemId(null);
      setEditingGroupItemId(null);
      fetchGroups();
      fetchHistory(true);
      onRefresh?.();
    } else {
      setEditItemError(error.message);
    }
  };

  const handleRenameGroup = async (groupId: string) => {
    const trimmed = renameGroupValue.trim();
    if (!trimmed) return;
    const { error } = await supabase.from('expense_groups').update({ name: trimmed }).eq('id', groupId);
    if (!error) {
      setRenamingGroupId(null);
      fetchGroups();
      fetchHistory(true); // el nombre del grupo aparece en los movimientos
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (deletingGroupId !== groupId) {
      setDeletingGroupId(groupId);
      setTimeout(() => setDeletingGroupId(null), 3000);
      return;
    }
    const { error } = await supabase.from('expense_groups').delete().eq('id', groupId);
    if (!error) {
      setDeletingGroupId(null);
      setExpandedGroupId(null);
      fetchGroups();
    }
  };

  const fetchHistory = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    const [entries, expenses, extras, groupItems] = await Promise.all([
      supabase.from('daily_entries').select('*, income_sources(name)').eq('user_id', userId),
      supabase.from('expenses').select('*').eq('user_id', userId),
      supabase.from('extra_income').select('*').eq('user_id', userId),
      supabase.from('expense_group_items').select('*, expense_groups(name)').eq('user_id', userId),
    ]);

    const history: HistoryItem[] = [
      ...(entries.data || []).map(e => ({
        id: e.id,
        type: 'income' as const,
        amount: Number(e.gross_income),
        description: (e.income_sources as { name: string } | null)?.name ?? 'Sin fuente',
        date: e.date
      })),
      ...(expenses.data || []).map(e => ({
        id: e.id,
        type: 'expense' as const,
        amount: Number(e.amount),
        description: `${e.category.charAt(0).toUpperCase() + e.category.slice(1)}`,
        date: e.date
      })),
      ...(extras.data || []).map(e => {
        const typeLabels: Record<string, string> = {
          bonus: 'Bono', tax_return: 'Devolución impuestos', sale: 'Venta', salary: 'Sueldo', other: 'Otro'
        };
        return {
          id: e.id,
          type: 'extra' as const,
          amount: Number(e.amount),
          description: e.type === 'salary' ? 'Sueldo' : `Extra: ${typeLabels[e.type] ?? e.type}`,
          date: e.date,
          extraType: e.type
        };
      }),
      ...(groupItems.data || []).map(item => {
        const groupName = (item.expense_groups as { name: string } | null)?.name ?? 'Grupo';
        const itemDate = item.date || item.created_at?.split('T')[0] || localDateStr();
        return {
          id: item.id,
          type: 'group_expense' as const,
          amount: Number(item.amount),
          description: item.description,
          date: itemDate,
          groupName,
        };
      }),
    ];

    setItems(history);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchHistory(); fetchGroups(); }, [userId]);

  const handleUpdateAmount = async (item: HistoryItem) => {
    const newAmount = Number(editAmount);
    if (isNaN(newAmount)) return;

    let table = '';
    let column = 'amount';
    if (item.type === 'income') { table = 'daily_entries'; column = 'net_income'; }
    else if (item.type === 'expense') table = 'expenses';
    else if (item.type === 'extra') table = 'extra_income';
    else if (item.type === 'group_expense') table = 'expense_group_items';

    const updatePayload: Record<string, number> = { [column]: newAmount };
    if (item.type === 'income') {
      const { data: entry } = await supabase.from('daily_entries').select('operational_costs').eq('id', item.id).single();
      updatePayload.gross_income = newAmount + Number(entry?.operational_costs ?? 0);
    }

    const { error } = await supabase.from(table).update(updatePayload).eq('id', item.id);
    if (!error) { setEditingId(null); fetchHistory(true); onRefresh?.(); }
  };

  const handleDelete = async (item: HistoryItem) => {
    if (deletingId !== item.id) {
      setDeletingId(item.id);
      setTimeout(() => setDeletingId(null), 3000);
      return;
    }
    let table = '';
    if (item.type === 'income') table = 'daily_entries';
    else if (item.type === 'expense') table = 'expenses';
    else if (item.type === 'extra') table = 'extra_income';
    else if (item.type === 'group_expense') table = 'expense_group_items';

    const { error } = await supabase.from(table).delete().eq('id', item.id);
    if (!error) {
      setDeletingId(null);
      fetchHistory(true);
      if (item.type === 'group_expense') fetchGroups();
      onRefresh?.();
    }
    else alert('Error al eliminar: ' + error.message);
  };

  // ─── Calendario ───────────────────────────────────────────────
  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const firstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const days = daysInMonth(year, month);
    const firstDay = (firstDayOfMonth(year, month) + 6) % 7;
    const blanks = Array(firstDay).fill(null);
    const daysArray = Array.from({ length: days }, (_, i) => i + 1);
    const monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

    return (
      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 mb-4">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => setCurrentMonth(new Date(year, month - 1))} className="p-2 hover:bg-gray-100 rounded-full">
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </button>
          <h4 className="font-bold text-gray-800">{monthNames[month]} {year}</h4>
          <button onClick={() => setCurrentMonth(new Date(year, month + 1))} className="p-2 hover:bg-gray-100 rounded-full">
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {['L','M','M','J','V','S','D'].map((d, i) => (
            <div key={i} className="text-[10px] font-black text-gray-300 uppercase mb-2">{d}</div>
          ))}
          {blanks.map((_, i) => <div key={`b-${i}`} />)}
          {daysArray.map(day => {
            const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const isSelected = selectedDate === dateStr;
            const hasData = items.some(item => item.date === dateStr);
            const netForDay = items.filter(item => item.date === dateStr)
              .reduce((sum, item) => (item.type === 'expense' || item.type === 'group_expense') ? sum - item.amount : sum + item.amount, 0);
            return (
              <button
                key={day}
                onClick={() => setSelectedDate(dateStr)}
                className={cn(
                  "aspect-square flex flex-col items-center justify-center rounded-2xl relative transition-all",
                  isSelected ? "bg-indigo-600 text-white shadow-lg" : "hover:bg-gray-50",
                  !isSelected && hasData && "bg-indigo-50"
                )}
              >
                <span className="text-sm font-bold">{day}</span>
                {hasData && !isSelected && (
                  <div className={cn("w-1 h-1 rounded-full absolute bottom-2",
                    netForDay >= 0 ? "bg-green-500" : "bg-red-500")} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ─── Memos ────────────────────────────────────────────────────
  const filteredItems = useMemo(
    () => items.filter(item => item.date === selectedDate),
    [items, selectedDate]
  );

  const daySummary = useMemo(() => {
    const ingresos = filteredItems.filter(i => i.type !== 'expense' && i.type !== 'group_expense').reduce((s, i) => s + i.amount, 0);
    const gastos = filteredItems.filter(i => i.type === 'expense' || i.type === 'group_expense').reduce((s, i) => s + i.amount, 0);
    return { ingresos, gastos, neto: ingresos - gastos };
  }, [filteredItems]);

  const weeklyData = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const dateStr = localDateStr(d);
      const dayItems = items.filter(item => item.date === dateStr);
      const net = dayItems.reduce((sum, item) => (item.type === 'expense' || item.type === 'group_expense') ? sum - item.amount : sum + item.amount, 0);
      return {
        date: dateStr,
        net,
        label: d.toLocaleDateString('es-CL', { weekday: 'short' }).toUpperCase().slice(0, 2),
        isToday: dateStr === localDateStr(today),
      };
    });
  }, [items]);

  // ─── Período de análisis ──────────────────────────────────────
  const period = useMemo(() => {
    const y = periodAnchor.getFullYear();
    const m = periodAnchor.getMonth();
    let start: Date, end: Date, prevStart: Date, prevEnd: Date, label: string;
    if (periodType === 'month') {
      start = new Date(y, m, 1); end = new Date(y, m + 1, 0);
      prevStart = new Date(y, m - 1, 1); prevEnd = new Date(y, m, 0);
      label = `${MONTH_NAMES[m]} ${y}`;
    } else if (periodType === '3m') {
      start = new Date(y, m - 2, 1); end = new Date(y, m + 1, 0);
      prevStart = new Date(y, m - 5, 1); prevEnd = new Date(y, m - 2, 0);
      label = `${MONTH_NAMES[start.getMonth()]} – ${MONTH_NAMES[m]} ${y}`;
    } else if (periodType === 'year') {
      start = new Date(y, 0, 1); end = new Date(y, 11, 31);
      prevStart = new Date(y - 1, 0, 1); prevEnd = new Date(y - 1, 11, 31);
      label = `Año ${y}`;
    } else {
      start = new Date(2000, 0, 1); end = new Date(2100, 0, 1);
      prevStart = start; prevEnd = start;
      label = 'Todo el historial';
    }
    return {
      startStr: localDateStr(start), endStr: localDateStr(end),
      prevStartStr: localDateStr(prevStart), prevEndStr: localDateStr(prevEnd),
      label,
    };
  }, [periodType, periodAnchor]);

  const shiftPeriod = (dir: -1 | 1) => {
    setPeriodAnchor(prev => {
      if (periodType === 'year') return new Date(prev.getFullYear() + dir, prev.getMonth(), 1);
      const step = periodType === '3m' ? 3 : 1;
      return new Date(prev.getFullYear(), prev.getMonth() + dir * step, 1);
    });
  };

  const periodItems = useMemo(
    () => periodType === 'all' ? items : items.filter(i => i.date >= period.startStr && i.date <= period.endStr),
    [items, period, periodType]
  );
  const prevPeriodItems = useMemo(
    () => periodType === 'all' ? [] : items.filter(i => i.date >= period.prevStartStr && i.date <= period.prevEndStr),
    [items, period, periodType]
  );

  const sumTotals = (arr: HistoryItem[]) => {
    const ingresos = arr.filter(i => i.type !== 'expense' && i.type !== 'group_expense').reduce((s, i) => s + i.amount, 0);
    const gastos = arr.filter(i => i.type === 'expense' || i.type === 'group_expense').reduce((s, i) => s + i.amount, 0);
    return { ingresos, gastos, neto: ingresos - gastos };
  };

  // Comparativa período actual vs anterior
  const comparison = useMemo(() => {
    const curr = sumTotals(periodItems);
    const prev = sumTotals(prevPeriodItems);
    const pct = (c: number, p: number) => (p !== 0 ? ((c - p) / Math.abs(p)) * 100 : null);
    return {
      curr, prev,
      ingresosPct: pct(curr.ingresos, prev.ingresos),
      gastosPct: pct(curr.gastos, prev.gastos),
      netoPct: pct(curr.neto, prev.neto),
      hasPrev: prevPeriodItems.length > 0,
    };
  }, [periodItems, prevPeriodItems]);

  // Evolución de los últimos 6 meses (termina en el mes del período seleccionado)
  const monthlyEvolution = useMemo(() => {
    const ref = periodType === 'all' ? new Date() : periodAnchor;
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(ref.getFullYear(), ref.getMonth() - (5 - i), 1);
      const mStart = localDateStr(d);
      const mEnd = localDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0));
      const monthItems = items.filter(it => it.date >= mStart && it.date <= mEnd);
      return {
        label: d.toLocaleDateString('es-CL', { month: 'short' }).replace('.', '').toUpperCase(),
        isRef: i === 5,
        ...sumTotals(monthItems),
      };
    });
  }, [items, periodAnchor, periodType]);
  const maxMonthlyVal = useMemo(
    () => Math.max(...monthlyEvolution.map(mo => Math.max(mo.ingresos, mo.gastos)), 1),
    [monthlyEvolution]
  );

  // Promedios, récords y top gastos del período
  const periodInsights = useMemo(() => {
    const incomeByDay = new Map<string, number>();
    const expenseByDay = new Map<string, number>();
    const netByDay = new Map<string, number>();
    periodItems.forEach(i => {
      const isExp = i.type === 'expense' || i.type === 'group_expense';
      netByDay.set(i.date, (netByDay.get(i.date) || 0) + (isExp ? -i.amount : i.amount));
      if (i.type === 'income') incomeByDay.set(i.date, (incomeByDay.get(i.date) || 0) + i.amount);
      if (isExp) expenseByDay.set(i.date, (expenseByDay.get(i.date) || 0) + i.amount);
    });
    const totalIncome = Array.from(incomeByDay.values()).reduce((s, v) => s + v, 0);
    const totalExpense = Array.from(expenseByDay.values()).reduce((s, v) => s + v, 0);
    let bestDay: { date: string; net: number } | null = null;
    netByDay.forEach((net, date) => {
      if (bestDay === null || net > bestDay.net) bestDay = { date, net };
    });
    let topSpendDay: { date: string; total: number } | null = null;
    expenseByDay.forEach((total, date) => {
      if (topSpendDay === null || total > topSpendDay.total) topSpendDay = { date, total };
    });
    const topExpenses = periodItems
      .filter(i => i.type === 'expense' || i.type === 'group_expense')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    return {
      avgIncomePerWorkedDay: incomeByDay.size > 0 ? totalIncome / incomeByDay.size : 0,
      workedDays: incomeByDay.size,
      avgExpensePerSpendDay: expenseByDay.size > 0 ? totalExpense / expenseByDay.size : 0,
      spendDays: expenseByDay.size,
      bestDay: bestDay as { date: string; net: number } | null,
      topSpendDay: topSpendDay as { date: string; total: number } | null,
      topExpenses,
    };
  }, [periodItems]);

  // Desglose del período: sueldo / apps / extras / gastos
  const periodBreakdown = useMemo(() => {
    const sueldo = periodItems.filter(i => i.type === 'extra' && i.extraType === 'salary').reduce((s, i) => s + i.amount, 0);
    const apps = periodItems.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0);
    const extras = periodItems.filter(i => i.type === 'extra' && i.extraType !== 'salary').reduce((s, i) => s + i.amount, 0);
    const gastos = periodItems.filter(i => i.type === 'expense' || i.type === 'group_expense').reduce((s, i) => s + i.amount, 0);
    const totalIn = sueldo + apps + extras;
    return { sueldo, apps, extras, gastos, totalIn, neto: totalIn - gastos, appsShare: totalIn > 0 ? apps / totalIn : 0 };
  }, [periodItems]);

  const sourceData = useMemo(() => {
    const map = new Map<string, number>();
    periodItems.filter(item => item.type === 'income').forEach(item => {
      map.set(item.description, (map.get(item.description) || 0) + item.amount);
    });
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [periodItems]);

  const maxWeeklyNet = useMemo(() => Math.max(...weeklyData.map(d => Math.abs(d.net)), 1), [weeklyData]);
  const maxSourceTotal = useMemo(() => Math.max(...sourceData.map(s => s.total), 1), [sourceData]);

  const expenseCategoryData = useMemo(() => {
    const map = new Map<string, number>();
    periodItems.filter(item => item.type === 'expense').forEach(item => {
      map.set(item.description, (map.get(item.description) || 0) + item.amount);
    });
    periodItems.filter(item => item.type === 'group_expense').forEach(item => {
      const key = item.groupName || 'Grupo';
      map.set(key, (map.get(key) || 0) + item.amount);
    });
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [periodItems]);

  const maxExpenseCategory = useMemo(() => Math.max(...expenseCategoryData.map(e => e.total), 1), [expenseCategoryData]);

  // ─── Export PDF ───────────────────────────────────────────────
  const exportPDF = () => {
    const fmt = (n: number) =>
      new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n);

    const totalIncome  = periodItems.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0);
    const totalExtra   = periodItems.filter(i => i.type === 'extra').reduce((s, i) => s + i.amount, 0);
    const totalExpense = periodItems.filter(i => i.type === 'expense' || i.type === 'group_expense').reduce((s, i) => s + i.amount, 0);
    const totalNet     = totalIncome + totalExtra - totalExpense;

    const sortedItems = [...periodItems].sort((a, b) => b.date.localeCompare(a.date));

    const firstDate = sortedItems.length
      ? new Date(sortedItems[sortedItems.length - 1].date + 'T00:00:00')
          .toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
      : '—';
    const lastDate = sortedItems.length
      ? new Date(sortedItems[0].date + 'T00:00:00')
          .toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
      : '—';
    const periodLabel = periodType === 'all' ? `${firstDate} — ${lastDate}` : period.label;
    const generatedAt = new Date().toLocaleDateString('es-CL', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const weeklySectionRows = weeklyData.map(d => `
      <tr>
        <td>${new Date(d.date + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'short' })}</td>
        <td style="text-align:right; font-weight:700; color:${d.net >= 0 ? '#4f46e5' : '#ef4444'}">
          ${d.net === 0 ? '—' : (d.net > 0 ? '+' : '') + fmt(d.net)}
        </td>
      </tr>`).join('');

    const sourceSectionRows = sourceData.map(s => `
      <tr>
        <td>${s.name}</td>
        <td style="text-align:right; font-weight:700; color:#16a34a">${fmt(s.total)}</td>
        <td style="text-align:right; color:#6b7280">${totalIncome > 0 ? Math.round(s.total / totalIncome * 100) : 0}%</td>
      </tr>`).join('');

    const expenseSectionRows = expenseCategoryData.map(c => `
      <tr>
        <td>${c.name}</td>
        <td style="text-align:right; font-weight:700; color:#ef4444">-${fmt(c.total)}</td>
        <td style="text-align:right; color:#6b7280">${totalExpense > 0 ? Math.round(c.total / totalExpense * 100) : 0}%</td>
      </tr>`).join('');

    const transactionRows = sortedItems.map(item => {
      const isExpense = item.type === 'expense' || item.type === 'group_expense';
      const typeLabel = item.type === 'income' ? 'Ingreso' : item.type === 'extra' ? 'Extra' : item.type === 'group_expense' ? `Grupo: ${item.groupName ?? ''}` : 'Gasto';
      const typeColor = item.type === 'income' ? '#4f46e5' : item.type === 'extra' ? '#f97316' : '#ef4444';
      return `
        <tr>
          <td>${new Date(item.date + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
          <td><span style="background:${typeColor}1a; color:${typeColor}; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:700">${typeLabel}</span></td>
          <td>${item.description}</td>
          <td style="text-align:right; font-weight:700; color:${isExpense ? '#ef4444' : '#16a34a'}">
            ${isExpense ? '-' : '+'}${fmt(item.amount)}
          </td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Informe Monty — ${periodLabel}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; background: #fff; font-size: 13px; }
    .page { max-width: 780px; margin: 0 auto; padding: 40px 32px; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #e5e7eb; }
    .header-left h1 { font-size: 28px; font-weight: 900; letter-spacing: -1px; color: #111827; }
    .header-left p { color: #6b7280; font-size: 13px; margin-top: 4px; }
    .header-right { text-align: right; }
    .header-right .period { font-size: 12px; color: #6b7280; }
    .header-right .generated { font-size: 11px; color: #9ca3af; margin-top: 4px; }

    /* Summary cards */
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 32px; }
    .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 16px; padding: 16px; }
    .card .label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; margin-bottom: 6px; }
    .card .value { font-size: 18px; font-weight: 900; }
    .card.net { background: #eef2ff; border-color: #c7d2fe; }
    .card.net .value { color: #4f46e5; }

    /* Sections */
    .section { margin-bottom: 28px; page-break-inside: avoid; }
    .section h2 { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; margin-bottom: 12px; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; }
    th { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: #9ca3af; padding: 8px 12px; border-bottom: 2px solid #e5e7eb; text-align: left; }
    td { padding: 9px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #374151; }
    tr:last-child td { border-bottom: none; }
    tbody tr:hover { background: #f9fafb; }

    /* Net total row */
    .net-row td { border-top: 2px solid #e5e7eb; font-weight: 800; font-size: 14px; color: #4f46e5; padding-top: 12px; }

    /* Footer */
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
    .footer .brand { font-size: 11px; color: #9ca3af; }
    .footer .brand strong { background: linear-gradient(90deg, #2563eb, #a855f7, #22c55e); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 800; }
    .footer .page-info { font-size: 11px; color: #9ca3af; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 20px 24px; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <h1>Monty</h1>
      <p>Informe de Ingresos y Gastos</p>
    </div>
    <div class="header-right">
      <div class="period">Período: ${periodLabel}</div>
      <div class="generated">Generado el ${generatedAt}</div>
    </div>
  </div>

  <!-- Summary -->
  <div class="summary">
    <div class="card">
      <div class="label">Ingresos Trabajo</div>
      <div class="value" style="color:#16a34a">${fmt(totalIncome)}</div>
    </div>
    <div class="card">
      <div class="label">Ingresos Extra</div>
      <div class="value" style="color:#f97316">${fmt(totalExtra)}</div>
    </div>
    <div class="card">
      <div class="label">Gastos</div>
      <div class="value" style="color:#ef4444">-${fmt(totalExpense)}</div>
    </div>
    <div class="card net">
      <div class="label">Neto Total</div>
      <div class="value">${fmt(totalNet)}</div>
    </div>
  </div>

  ${(periodType === 'all' || (localDateStr() >= period.startStr && localDateStr() <= period.endStr)) && weeklyData.some(d => d.net !== 0) ? `
  <!-- Últimos 7 días -->
  <div class="section">
    <h2>Últimos 7 días</h2>
    <table>
      <thead><tr><th>Día</th><th style="text-align:right">Neto</th></tr></thead>
      <tbody>${weeklySectionRows}</tbody>
      <tfoot>
        <tr class="net-row">
          <td>Total semana</td>
          <td style="text-align:right">${fmt(weeklyData.reduce((s, d) => s + d.net, 0))}</td>
        </tr>
      </tfoot>
    </table>
  </div>` : ''}

  ${sourceData.length > 0 ? `
  <!-- Por plataforma -->
  <div class="section">
    <h2>Ingresos por Plataforma</h2>
    <table>
      <thead><tr><th>Plataforma</th><th style="text-align:right">Total</th><th style="text-align:right">%</th></tr></thead>
      <tbody>${sourceSectionRows}</tbody>
    </table>
  </div>` : ''}

  ${expenseCategoryData.length > 0 ? `
  <!-- Gastos por categoría -->
  <div class="section">
    <h2>Gastos por Categoría</h2>
    <table>
      <thead><tr><th>Categoría</th><th style="text-align:right">Total</th><th style="text-align:right">%</th></tr></thead>
      <tbody>${expenseSectionRows}</tbody>
    </table>
  </div>` : ''}

  ${sortedItems.length > 0 ? `
  <!-- Movimientos del período -->
  <div class="section">
    <h2>Movimientos del período (${sortedItems.length})</h2>
    <table>
      <thead><tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th style="text-align:right">Monto</th></tr></thead>
      <tbody>${transactionRows}</tbody>
    </table>
  </div>` : ''}

  <!-- Footer -->
  <div class="footer">
    <div class="brand">Desarrollado por <strong>Teo Labs</strong> ®</div>
    <div class="page-info">Monty — informe generado en tiempo real</div>
  </div>

</div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 600);
  };

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-gray-50 z-[200] flex flex-col sm:max-w-lg sm:mx-auto">
      {/* Header */}
      <div className="p-6 flex justify-between items-center bg-white border-b border-gray-100">
        <h3 className="text-2xl font-black tracking-tight">Historial</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchHistory(true)}
            className={cn("p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition",
              refreshing && "animate-spin")}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-100 px-6 pb-0">
        <button
          onClick={() => setActiveView('movimientos')}
          className={cn(
            "flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition",
            activeView === 'movimientos' ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-400"
          )}
        >
          <CalendarDays className="w-4 h-4" /> Movimientos
        </button>
        <button
          onClick={() => setActiveView('analisis')}
          className={cn(
            "flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition",
            activeView === 'analisis' ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-400"
          )}
        >
          <BarChart2 className="w-4 h-4" /> Análisis
        </button>
        <button
          onClick={() => { setActiveView('grupos'); fetchGroups(); }}
          className={cn(
            "flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition",
            activeView === 'grupos' ? "border-violet-600 text-violet-600" : "border-transparent text-gray-400"
          )}
        >
          <Package className="w-4 h-4" /> Grupos
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-12">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : activeView === 'movimientos' ? (
          <>
            {renderCalendar()}

            {/* Resumen del día */}
            {filteredItems.length > 0 && (
              <div className="bg-white rounded-[2rem] p-5 border border-gray-100 shadow-sm mb-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Ingresos</span>
                  <span className="text-base font-black text-green-600">{formatCurrency(daySummary.ingresos)}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Gastos</span>
                  <span className="text-base font-black text-red-500">-{formatCurrency(daySummary.gastos)}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Neto</span>
                  <span className={cn("text-base font-black", daySummary.neto >= 0 ? "text-indigo-600" : "text-red-600")}>
                    {formatCurrency(daySummary.neto)}
                  </span>
                </div>
              </div>
            )}

            {/* Lista de movimientos */}
            <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <h5 className="font-bold text-gray-800">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })}
                </h5>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {filteredItems.length} movimientos
                </span>
              </div>

              <AnimatePresence mode="popLayout">
                {filteredItems.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-12 bg-white rounded-[2rem] border-2 border-dashed border-gray-200"
                  >
                    <p className="text-gray-400 text-sm">No hay actividad para este día.</p>
                  </motion.div>
                ) : (
                  filteredItems.map((item) => (
                    <motion.div
                      key={`${item.type}-${item.id}`}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="flex items-center justify-between p-5 bg-white rounded-3xl border border-gray-100 shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${
                          item.type === 'income' ? 'bg-green-50 text-green-600' :
                          item.type === 'extra' ? 'bg-orange-50 text-orange-600' :
                          item.type === 'group_expense' ? 'bg-violet-50 text-violet-600' :
                          'bg-red-50 text-red-600'
                        }`}>
                          {item.type === 'income' ? <ArrowUpRight className="w-5 h-5" /> :
                           item.type === 'extra' ? <Gift className="w-5 h-5" /> :
                           item.type === 'group_expense' ? <Package className="w-5 h-5" /> :
                           <ArrowDownRight className="w-5 h-5" />}
                        </div>
                        <div>
                          <span className="font-bold text-gray-800 block text-sm">{item.description}</span>
                          <span className="text-[10px] text-gray-400 uppercase font-black tracking-tighter">
                            {item.type === 'income' ? 'Ingreso' :
                             item.type === 'extra' ? 'Extra' :
                             item.type === 'group_expense' ? item.groupName ?? 'Grupo' :
                             'Gasto'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {editingId === item.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              autoFocus
                              className="w-20 bg-gray-50 border-2 border-indigo-600 rounded-lg px-2 py-1 font-bold text-sm"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateAmount(item);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                            />
                            <button onClick={() => handleUpdateAmount(item)} className="p-1 bg-indigo-600 text-white rounded-md">
                              <Save className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingId(item.id); setEditAmount(item.amount.toString()); }}
                            className={`font-black text-sm ${(item.type === 'expense' || item.type === 'group_expense') ? 'text-red-500' : 'text-green-600'}`}
                          >
                            {(item.type === 'expense' || item.type === 'group_expense') ? '-' : '+'}{formatCurrency(item.amount)}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(item)}
                          className={cn("p-2 rounded-xl transition-all duration-300",
                            deletingId === item.id ? "bg-red-500 text-white shadow-lg scale-110" : "text-gray-300 hover:text-red-500")}
                        >
                          <Trash2 className={cn("w-4 h-4", deletingId === item.id && "animate-pulse")} />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </>
        ) : activeView === 'grupos' ? (
          /* ── Vista Grupos ── */
          <div className="space-y-4">
            {expenseGroups.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-[2rem] border-2 border-dashed border-violet-200">
                <Package className="w-12 h-12 text-violet-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm font-bold">Sin grupos de gastos aún</p>
                <p className="text-gray-400 text-xs mt-1">Crea uno desde el botón "Grupo" en el panel principal.</p>
              </div>
            ) : (
              expenseGroups.map((group) => {
                const groupTotal = (group.expense_group_items || []).reduce((s, i) => s + Number(i.amount), 0);
                const isExpanded = expandedGroupId === group.id;
                const isDeleting = deletingGroupId === group.id;
                return (
                  <motion.div
                    key={group.id}
                    layout
                    className="bg-white rounded-[2rem] border border-violet-100 shadow-sm overflow-hidden"
                  >
                    <div
                      className="flex items-center gap-4 p-5 cursor-pointer"
                      onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                    >
                      <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-violet-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-gray-800 block truncate">{group.name}</span>
                        <span className="text-xs text-gray-400">
                          {group.created_at ? new Date(group.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                          {' · '}{(group.expense_group_items || []).length} ítem{(group.expense_group_items || []).length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex flex-col items-end shrink-0 gap-1">
                        <span className="text-lg font-black text-violet-600">{formatCurrency(groupTotal)}</span>
                        <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", isExpanded && "rotate-180")} />
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 space-y-2">
                            {(group.expense_group_items || []).sort((a, b) => (a.date || a.created_at || '').localeCompare(b.date || b.created_at || '')).map((item) => (
                              editingGroupItemId === item.id ? (
                                <div key={item.id} className="bg-violet-50 rounded-2xl px-4 py-3 space-y-2 border border-violet-200">
                                  <input
                                    type="text"
                                    autoFocus
                                    placeholder="Descripción"
                                    className="w-full bg-white rounded-xl px-3 py-2.5 text-sm font-bold text-gray-700 border-none outline-none focus:ring-2 focus:ring-violet-200"
                                    value={editItemDesc}
                                    onChange={(e) => setEditItemDesc(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Escape' && setEditingGroupItemId(null)}
                                  />
                                  <div className="flex gap-2">
                                    <input
                                      type="number"
                                      placeholder="$0"
                                      className="flex-1 bg-white rounded-xl px-3 py-2.5 text-sm font-black text-violet-600 border-none outline-none focus:ring-2 focus:ring-violet-200 min-w-0"
                                      value={editItemAmt}
                                      onChange={(e) => setEditItemAmt(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleUpdateGroupItem(item.id);
                                        if (e.key === 'Escape') setEditingGroupItemId(null);
                                      }}
                                    />
                                    <input
                                      type="date"
                                      className="flex-1 bg-white rounded-xl px-2 py-2.5 text-sm text-gray-500 border-none outline-none focus:ring-2 focus:ring-violet-200 min-w-0"
                                      value={editItemDate}
                                      onChange={(e) => setEditItemDate(e.target.value)}
                                    />
                                  </div>
                                  {editItemError && (
                                    <p className="text-xs text-red-500 font-medium px-1">{editItemError}</p>
                                  )}
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleUpdateGroupItem(item.id)}
                                      disabled={savingItem || !editItemDesc.trim() || Number(editItemAmt) <= 0}
                                      className="flex-1 bg-violet-600 text-white font-bold rounded-xl py-2.5 text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                                    >
                                      <Save className="w-3.5 h-3.5" /> {savingItem ? 'Guardando…' : 'Guardar'}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteGroupItem(item.id)}
                                      className={cn(
                                        'p-2.5 rounded-xl shrink-0 transition',
                                        deletingItemId === item.id ? 'bg-red-500 text-white' : 'bg-white text-red-400'
                                      )}
                                      aria-label={deletingItemId === item.id ? 'Confirmar eliminación' : 'Eliminar ítem'}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => { setEditingGroupItemId(null); setEditItemError(null); }}
                                      className="p-2.5 bg-white text-gray-400 hover:text-gray-600 rounded-xl shrink-0"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                  {deletingItemId === item.id && (
                                    <p className="text-[11px] text-red-500 font-bold text-center">
                                      Toca el ícono de nuevo para confirmar borrado
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div key={item.id} className="flex justify-between items-center bg-violet-50 rounded-2xl px-4 py-3">
                                  <div className="min-w-0">
                                    <span className="text-sm font-medium text-gray-700 block truncate">{item.description}</span>
                                    {item.date && (
                                      <span className="text-[10px] text-gray-400 font-bold">
                                        {new Date(item.date + 'T00:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0 ml-3">
                                    <span className="text-sm font-black text-violet-600">{formatCurrency(Number(item.amount))}</span>
                                    <button
                                      onClick={() => {
                                        setEditingGroupItemId(item.id);
                                        setEditItemDesc(item.description);
                                        setEditItemAmt(String(Math.round(Number(item.amount))));
                                        setEditItemDate(item.date || (item.created_at ? item.created_at.split('T')[0] : localDateStr()));
                                        setEditItemError(null);
                                        setAddingItemToGroupId(null);
                                      }}
                                      className="p-1.5 text-gray-300 hover:text-violet-600 transition"
                                      aria-label={`Editar ${item.description}`}
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )
                            ))}
                            <div className="flex justify-between items-center pt-2 px-1">
                              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total</span>
                              <span className="text-base font-black text-violet-600">{formatCurrency(groupTotal)}</span>
                            </div>

                            {/* Agregar gasto al grupo */}
                            <AnimatePresence mode="wait">
                              {addingItemToGroupId === group.id ? (
                                <motion.div
                                  key="form"
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="space-y-2 overflow-hidden"
                                >
                                  <input
                                    type="text"
                                    autoFocus
                                    placeholder="Descripción (ej: Gasolina día 2)"
                                    className="w-full bg-white rounded-xl px-3 py-2.5 text-sm font-bold text-gray-700 border-none outline-none focus:ring-2 focus:ring-violet-200"
                                    value={newItemDesc}
                                    onChange={(e) => setNewItemDesc(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Escape' && setAddingItemToGroupId(null)}
                                  />
                                  <div className="flex gap-2">
                                    <input
                                      type="number"
                                      placeholder="$0"
                                      className="flex-1 bg-white rounded-xl px-3 py-2.5 text-sm font-black text-violet-600 border-none outline-none focus:ring-2 focus:ring-violet-200 min-w-0"
                                      value={newItemAmt}
                                      onChange={(e) => setNewItemAmt(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleAddItemToGroup(group.id);
                                        if (e.key === 'Escape') setAddingItemToGroupId(null);
                                      }}
                                    />
                                    <input
                                      type="date"
                                      className="flex-1 bg-white rounded-xl px-2 py-2.5 text-sm text-gray-500 border-none outline-none focus:ring-2 focus:ring-violet-200 min-w-0"
                                      value={newItemDate}
                                      onChange={(e) => setNewItemDate(e.target.value)}
                                    />
                                  </div>
                                  {saveItemError && addingItemToGroupId === group.id && (
                                    <p className="text-xs text-red-500 font-medium px-1">{saveItemError}</p>
                                  )}
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleAddItemToGroup(group.id)}
                                      disabled={savingItem}
                                      className="flex-1 bg-violet-600 text-white font-bold rounded-xl py-2.5 text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                                    >
                                      <Save className="w-3.5 h-3.5" /> {savingItem ? 'Guardando…' : 'Guardar'}
                                    </button>
                                    <button
                                      onClick={() => { setAddingItemToGroupId(null); setNewItemDesc(''); setNewItemAmt(''); setNewItemDate(localDateStr()); setSaveItemError(null); }}
                                      className="p-2.5 bg-white text-gray-400 hover:text-gray-600 rounded-xl shrink-0"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </motion.div>
                              ) : (
                                <motion.button
                                  key="btn"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  onClick={() => { setAddingItemToGroupId(group.id); setNewItemDesc(''); setNewItemAmt(''); }}
                                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-violet-200 text-violet-500 font-bold rounded-2xl hover:border-violet-400 hover:bg-violet-50 transition text-sm"
                                >
                                  <Plus className="w-4 h-4" /> Agregar gasto
                                </motion.button>
                              )}
                            </AnimatePresence>

                            {renamingGroupId === group.id ? (
                              <div className="flex gap-2 mt-2">
                                <input
                                  type="text"
                                  autoFocus
                                  placeholder="Nombre del grupo"
                                  className="flex-1 min-w-0 bg-violet-50 border border-violet-200 rounded-2xl px-4 py-2.5 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-violet-200"
                                  value={renameGroupValue}
                                  onChange={(e) => setRenameGroupValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRenameGroup(group.id);
                                    if (e.key === 'Escape') setRenamingGroupId(null);
                                  }}
                                />
                                <button
                                  onClick={() => handleRenameGroup(group.id)}
                                  disabled={!renameGroupValue.trim()}
                                  className="px-3.5 bg-violet-600 text-white rounded-2xl disabled:opacity-50 active:scale-95 transition"
                                  aria-label="Guardar nombre"
                                >
                                  <Save className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setRenamingGroupId(null)}
                                  className="px-3.5 bg-gray-100 text-gray-400 rounded-2xl active:scale-95 transition"
                                  aria-label="Cancelar"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => { setRenamingGroupId(group.id); setRenameGroupValue(group.name); setDeletingGroupId(null); }}
                                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition text-gray-500 hover:bg-gray-50"
                                >
                                  <Pencil className="w-4 h-4" /> Renombrar
                                </button>
                                <button
                                  onClick={() => handleDeleteGroup(group.id)}
                                  className={cn(
                                    "flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition",
                                    isDeleting ? "bg-red-500 text-white shadow-lg" : "text-red-400 hover:bg-red-50"
                                  )}
                                >
                                  <Trash2 className={cn("w-4 h-4", isDeleting && "animate-pulse")} />
                                  {isDeleting ? '¿Confirmar?' : 'Eliminar grupo'}
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            )}
          </div>
        ) : (
          /* ── Vista Análisis ── */
          <div className="space-y-4">

            {/* Selector de período */}
            <div className="bg-white rounded-[2rem] p-4 border border-gray-100 shadow-sm">
              <div className="grid grid-cols-4 gap-1.5">
                {([
                  { v: 'month', l: 'Mes' },
                  { v: '3m', l: '3 meses' },
                  { v: 'year', l: 'Año' },
                  { v: 'all', l: 'Todo' },
                ] as { v: AnalysisPeriod; l: string }[]).map(({ v, l }) => (
                  <button
                    key={v}
                    onClick={() => { setPeriodType(v); setPeriodAnchor(new Date()); }}
                    className={cn(
                      "py-2 rounded-xl text-xs font-black transition",
                      periodType === v ? "bg-indigo-600 text-white shadow-md" : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {periodType !== 'all' && (
                <div className="flex items-center justify-between mt-3">
                  <button
                    onClick={() => shiftPeriod(-1)}
                    className="p-2 bg-gray-50 rounded-xl text-gray-400 hover:bg-gray-100 active:scale-95 transition"
                    aria-label="Período anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-black text-gray-800">{period.label}</span>
                  <button
                    onClick={() => shiftPeriod(1)}
                    className="p-2 bg-gray-50 rounded-xl text-gray-400 hover:bg-gray-100 active:scale-95 transition"
                    aria-label="Período siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Sin movimientos en el período */}
            {periodItems.length === 0 && (
              <div className="text-center py-10 bg-white rounded-[2rem] border-2 border-dashed border-gray-200">
                <BarChart2 className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                <p className="text-sm font-bold text-gray-400">Sin movimientos en este período</p>
              </div>
            )}

            {/* Comparativa vs período anterior */}
            {periodType !== 'all' && periodItems.length > 0 && (
              <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">vs Período Anterior</h4>
                <div className="space-y-3">
                  {[
                    { label: 'Ingresos', curr: comparison.curr.ingresos, prev: comparison.prev.ingresos, pct: comparison.ingresosPct, goodWhenUp: true },
                    { label: 'Gastos', curr: comparison.curr.gastos, prev: comparison.prev.gastos, pct: comparison.gastosPct, goodWhenUp: false },
                    { label: 'Neto', curr: comparison.curr.neto, prev: comparison.prev.neto, pct: comparison.netoPct, goodWhenUp: true },
                  ].map(row => {
                    const up = (row.pct ?? 0) >= 0;
                    const isGood = row.pct === null ? true : up === row.goodWhenUp;
                    return (
                      <div key={row.label} className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-bold text-gray-700 block">{row.label}</span>
                          <span className="text-[10px] text-gray-400">antes: {formatCurrency(row.prev)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-black text-gray-800 block">{formatCurrency(row.curr)}</span>
                          {row.pct !== null ? (
                            <span className={cn(
                              "text-[11px] font-black inline-flex items-center gap-0.5",
                              isGood ? "text-green-600" : "text-red-500"
                            )}>
                              {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                              {Math.abs(Math.round(row.pct))}%
                            </span>
                          ) : (
                            <span className="text-[11px] text-gray-300 font-bold">sin datos previos</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Evolución mensual — últimos 6 meses */}
            <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
              <div className="flex justify-between items-center mb-5">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Evolución Mensual</h4>
                <div className="flex items-center gap-3 text-[9px] font-bold text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Ingresos</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Gastos</span>
                </div>
              </div>
              <div className="flex items-end justify-between gap-2 h-28">
                {monthlyEvolution.map(mo => (
                  <div key={mo.label} className="flex-1 h-full flex items-end justify-center gap-1">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${mo.ingresos / maxMonthlyVal * 100}%` }}
                      transition={{ duration: 0.5 }}
                      className="w-2.5 bg-green-500 rounded-t-md"
                    />
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${mo.gastos / maxMonthlyVal * 100}%` }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                      className="w-2.5 bg-red-400 rounded-t-md"
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between gap-2 mt-2">
                {monthlyEvolution.map(mo => (
                  <div key={mo.label} className="flex-1 text-center min-w-0">
                    <span className={cn(
                      "text-[9px] font-black block",
                      mo.isRef && periodType !== 'all' ? "text-indigo-600" : "text-gray-400"
                    )}>
                      {mo.label}
                    </span>
                    <span className={cn("text-[9px] font-bold block truncate", mo.neto >= 0 ? "text-green-600" : "text-red-500")}>
                      {mo.neto === 0 ? '—' : `${mo.neto < 0 ? '-' : ''}$${Math.abs(mo.neto) >= 1000000 ? (Math.abs(mo.neto) / 1000000).toFixed(1) + 'M' : Math.round(Math.abs(mo.neto) / 1000) + 'k'}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Semana en curso — solo si el período incluye hoy */}
            {(periodType === 'all' || (localDateStr() >= period.startStr && localDateStr() <= period.endStr)) && (
            <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
              <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-5">Últimos 7 días</h4>
              <div className="space-y-3">
                {weeklyData.map((day) => {
                  const barPct = Math.abs(day.net) / maxWeeklyNet * 100;
                  const isPositive = day.net >= 0;
                  return (
                    <div key={day.date} className="flex items-center gap-3">
                      <span className={cn("text-[10px] font-black w-6 text-right shrink-0",
                        day.isToday ? "text-indigo-600" : "text-gray-400")}>
                        {day.label}
                      </span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barPct}%` }}
                          transition={{ duration: 0.5, delay: 0.05 }}
                          className={cn("h-full rounded-full", isPositive ? "bg-indigo-500" : "bg-red-400")}
                        />
                      </div>
                      <span className={cn("text-xs font-black w-24 text-right shrink-0",
                        day.net === 0 ? "text-gray-300" : isPositive ? "text-indigo-600" : "text-red-500")}>
                        {day.net === 0 ? '—' : (isPositive ? '+' : '') + formatCurrency(day.net)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 pt-4 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                <span>Total 7 días:</span>
                <span className="font-black text-indigo-600">
                  {formatCurrency(weeklyData.reduce((s, d) => s + d.net, 0))}
                </span>
              </div>
            </div>
            )}

            {/* Por plataforma / fuente */}
            {sourceData.length > 0 && (
              <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-5">Por Plataforma</h4>
                <div className="space-y-4">
                  {sourceData.map((src) => (
                    <div key={src.name}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-bold text-gray-700">{src.name}</span>
                        <span className="text-sm font-black text-green-600">{formatCurrency(src.total)}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${src.total / maxSourceTotal * 100}%` }}
                          transition={{ duration: 0.5 }}
                          className="h-full bg-green-500 rounded-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gastos por categoría */}
            {expenseCategoryData.length > 0 && (
              <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-5">
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Gastos por Categoría</h4>
                  <span className="text-xs font-black text-red-500">
                    -{formatCurrency(expenseCategoryData.reduce((s, e) => s + e.total, 0))}
                  </span>
                </div>
                <div className="space-y-4">
                  {expenseCategoryData.map((cat) => (
                    <div key={cat.name}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-bold text-gray-700 capitalize">{cat.name}</span>
                        <span className="text-sm font-black text-red-500">-{formatCurrency(cat.total)}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${cat.total / maxExpenseCategory * 100}%` }}
                          transition={{ duration: 0.5 }}
                          className="h-full bg-red-400 rounded-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Promedios y récords del período */}
            {periodItems.length > 0 && (
              <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Promedios y Récords</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 rounded-2xl p-3 border border-green-100">
                    <p className="text-[9px] font-bold text-green-600 uppercase tracking-wider mb-1">Ingreso / día trabajado</p>
                    <p className="text-base font-black text-green-700">{formatCurrency(periodInsights.avgIncomePerWorkedDay)}</p>
                    <p className="text-[9px] text-green-500 font-medium">{periodInsights.workedDays} día{periodInsights.workedDays !== 1 ? 's' : ''} con ingreso</p>
                  </div>
                  <div className="bg-red-50 rounded-2xl p-3 border border-red-100">
                    <p className="text-[9px] font-bold text-red-500 uppercase tracking-wider mb-1">Gasto / día con gasto</p>
                    <p className="text-base font-black text-red-600">{formatCurrency(periodInsights.avgExpensePerSpendDay)}</p>
                    <p className="text-[9px] text-red-400 font-medium">{periodInsights.spendDays} día{periodInsights.spendDays !== 1 ? 's' : ''} con gasto</p>
                  </div>
                  {periodInsights.bestDay && (
                    <div className="bg-indigo-50 rounded-2xl p-3 border border-indigo-100">
                      <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider mb-1">Mejor día (neto)</p>
                      <p className="text-base font-black text-indigo-700">{formatCurrency(periodInsights.bestDay.net)}</p>
                      <p className="text-[9px] text-indigo-400 font-medium capitalize">
                        {new Date(periodInsights.bestDay.date + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  )}
                  {periodInsights.topSpendDay && (
                    <div className="bg-amber-50 rounded-2xl p-3 border border-amber-100">
                      <p className="text-[9px] font-bold text-amber-500 uppercase tracking-wider mb-1">Día más caro</p>
                      <p className="text-base font-black text-amber-700">-{formatCurrency(periodInsights.topSpendDay.total)}</p>
                      <p className="text-[9px] text-amber-500 font-medium capitalize">
                        {new Date(periodInsights.topSpendDay.date + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Top gastos del período */}
            {periodInsights.topExpenses.length > 0 && (
              <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Top Gastos del Período</h4>
                <div className="space-y-2">
                  {periodInsights.topExpenses.map((exp, i) => (
                    <div key={exp.id} className="flex items-center gap-3">
                      <span className={cn(
                        "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0",
                        i === 0 ? "bg-red-500 text-white" : "bg-gray-100 text-gray-400"
                      )}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-700 capitalize truncate">
                          {exp.type === 'group_expense' ? `${exp.groupName ?? 'Grupo'}: ${exp.description}` : exp.description}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {new Date(exp.date + 'T00:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <span className="text-sm font-black text-red-500 shrink-0">-{formatCurrency(exp.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resumen del período: sueldo / apps / extras / gastos */}
            <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
              <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Resumen del Período</h4>
              <div className="space-y-3">
                {periodBreakdown.sueldo > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">💼 Sueldo</span>
                    <span className="text-sm font-black text-emerald-600">{formatCurrency(periodBreakdown.sueldo)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">🚗 Apps / Trabajo</span>
                  <span className="text-sm font-black text-green-600">{formatCurrency(periodBreakdown.apps)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">⚡ Ingresos extra</span>
                  <span className="text-sm font-black text-orange-500">{formatCurrency(periodBreakdown.extras)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">🛒 Gastos</span>
                  <span className="text-sm font-black text-red-500">-{formatCurrency(periodBreakdown.gastos)}</span>
                </div>
                <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-700">Neto del período</span>
                  <span className={cn("text-base font-black", periodBreakdown.neto >= 0 ? "text-indigo-600" : "text-red-500")}>
                    {formatCurrency(periodBreakdown.neto)}
                  </span>
                </div>
                {periodBreakdown.sueldo > 0 && periodBreakdown.apps > 0 && (
                  <p className="text-[10px] text-gray-400 pt-1">
                    🚗 Las apps aportaron el <b className="text-indigo-600">{Math.round(periodBreakdown.appsShare * 100)}%</b> de tus ingresos del período.
                  </p>
                )}
              </div>
            </div>

            {/* Exportar PDF */}
            <button
              onClick={exportPDF}
              className="w-full flex items-center justify-center gap-3 bg-indigo-600 text-white font-bold py-4 rounded-[2rem] hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200"
            >
              <Download className="w-5 h-5" /> Informe PDF · {periodType === 'all' ? 'Todo' : period.label}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
