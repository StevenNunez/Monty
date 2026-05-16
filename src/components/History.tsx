import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency, cn } from '../lib/utils';
import { X, ArrowUpRight, ArrowDownRight, Gift, ChevronLeft, ChevronRight, Trash2, Save, RefreshCw, Download, BarChart2, CalendarDays } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HistoryItem {
  id: string;
  type: 'income' | 'expense' | 'extra';
  amount: number;
  description: string;
  date: string;
}

export default function History({ userId, onClose, onRefresh }: { userId: string; onClose: () => void; onRefresh?: () => void }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeView, setActiveView] = useState<'movimientos' | 'analisis'>('movimientos');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchHistory = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    const [entries, expenses, extras] = await Promise.all([
      supabase.from('daily_entries').select('*, income_sources(name)').eq('user_id', userId),
      supabase.from('expenses').select('*').eq('user_id', userId),
      supabase.from('extra_income').select('*').eq('user_id', userId),
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
      ...(extras.data || []).map(e => ({
        id: e.id,
        type: 'extra' as const,
        amount: Number(e.amount),
        description: `Extra: ${e.type}`,
        date: e.date
      }))
    ];

    setItems(history);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchHistory(); }, [userId]);

  const handleUpdateAmount = async (item: HistoryItem) => {
    const newAmount = Number(editAmount);
    if (isNaN(newAmount)) return;

    let table = '';
    let column = 'amount';
    if (item.type === 'income') { table = 'daily_entries'; column = 'net_income'; }
    else if (item.type === 'expense') table = 'expenses';
    else if (item.type === 'extra') table = 'extra_income';

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

    const { error } = await supabase.from(table).delete().eq('id', item.id);
    if (!error) { setDeletingId(null); fetchHistory(true); onRefresh?.(); }
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
              .reduce((sum, item) => item.type === 'expense' ? sum - item.amount : sum + item.amount, 0);
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
    const ingresos = filteredItems.filter(i => i.type !== 'expense').reduce((s, i) => s + i.amount, 0);
    const gastos = filteredItems.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);
    return { ingresos, gastos, neto: ingresos - gastos };
  }, [filteredItems]);

  const weeklyData = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const dateStr = d.toISOString().split('T')[0];
      const dayItems = items.filter(item => item.date === dateStr);
      const net = dayItems.reduce((sum, item) => item.type === 'expense' ? sum - item.amount : sum + item.amount, 0);
      return {
        date: dateStr,
        net,
        label: d.toLocaleDateString('es-CL', { weekday: 'short' }).toUpperCase().slice(0, 2),
        isToday: dateStr === today.toISOString().split('T')[0],
      };
    });
  }, [items]);

  const sourceData = useMemo(() => {
    const map = new Map<string, number>();
    items.filter(item => item.type === 'income').forEach(item => {
      map.set(item.description, (map.get(item.description) || 0) + item.amount);
    });
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [items]);

  const maxWeeklyNet = useMemo(() => Math.max(...weeklyData.map(d => Math.abs(d.net)), 1), [weeklyData]);
  const maxSourceTotal = useMemo(() => Math.max(...sourceData.map(s => s.total), 1), [sourceData]);

  const expenseCategoryData = useMemo(() => {
    const map = new Map<string, number>();
    items.filter(item => item.type === 'expense').forEach(item => {
      map.set(item.description, (map.get(item.description) || 0) + item.amount);
    });
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [items]);

  const maxExpenseCategory = useMemo(() => Math.max(...expenseCategoryData.map(e => e.total), 1), [expenseCategoryData]);

  // ─── Export PDF ───────────────────────────────────────────────
  const exportPDF = () => {
    const fmt = (n: number) =>
      new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n);

    const totalIncome  = items.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0);
    const totalExtra   = items.filter(i => i.type === 'extra').reduce((s, i) => s + i.amount, 0);
    const totalExpense = items.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);
    const totalNet     = totalIncome + totalExtra - totalExpense;

    const sortedItems = [...items].sort((a, b) => b.date.localeCompare(a.date));

    const firstDate = sortedItems.length
      ? new Date(sortedItems[sortedItems.length - 1].date + 'T00:00:00')
          .toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
      : '—';
    const lastDate = sortedItems.length
      ? new Date(sortedItems[0].date + 'T00:00:00')
          .toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
      : '—';
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
      const isExpense = item.type === 'expense';
      const typeLabel = item.type === 'income' ? 'Ingreso' : item.type === 'extra' ? 'Extra' : 'Gasto';
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
  <title>Informe Monty — ${generatedAt}</title>
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
      <div class="period">Período: ${firstDate} — ${lastDate}</div>
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

  ${weeklyData.some(d => d.net !== 0) ? `
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
  <!-- Historial completo -->
  <div class="section">
    <h2>Historial Completo (${sortedItems.length} movimientos)</h2>
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
                          item.type === 'extra' ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'
                        }`}>
                          {item.type === 'income' ? <ArrowUpRight className="w-5 h-5" /> :
                           item.type === 'extra' ? <Gift className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                        </div>
                        <div>
                          <span className="font-bold text-gray-800 block text-sm">{item.description}</span>
                          <span className="text-[10px] text-gray-400 uppercase font-black tracking-tighter">
                            {item.type === 'income' ? 'Ingreso' : item.type === 'extra' ? 'Extra' : 'Gasto'}
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
                            className={`font-black text-sm ${item.type === 'expense' ? 'text-red-500' : 'text-green-600'}`}
                          >
                            {item.type === 'expense' ? '-' : '+'}{formatCurrency(item.amount)}
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
        ) : (
          /* ── Vista Análisis ── */
          <div className="space-y-4">

            {/* Semana en curso — últimos 7 días */}
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

            {/* Totales globales */}
            <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm">
              <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Resumen Total</h4>
              <div className="space-y-3">
                {[
                  { label: 'Ingresos trabajo', value: items.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0), color: 'text-green-600' },
                  { label: 'Ingresos extra', value: items.filter(i => i.type === 'extra').reduce((s, i) => s + i.amount, 0), color: 'text-orange-500' },
                  { label: 'Gastos', value: items.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0), color: 'text-red-500' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">{label}</span>
                    <span className={cn("text-sm font-black", color)}>{formatCurrency(value)}</span>
                  </div>
                ))}
                <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-700">Neto total</span>
                  <span className="text-base font-black text-indigo-600">
                    {formatCurrency(
                      items.filter(i => i.type !== 'expense').reduce((s, i) => s + i.amount, 0) -
                      items.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0)
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Exportar PDF */}
            <button
              onClick={exportPDF}
              className="w-full flex items-center justify-center gap-3 bg-indigo-600 text-white font-bold py-4 rounded-[2rem] hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200"
            >
              <Download className="w-5 h-5" /> Descargar Informe PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
