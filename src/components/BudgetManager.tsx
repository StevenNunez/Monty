import React, { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Budget } from '../types';
import { X, Trash2, Plus, Wallet, CalendarDays } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import FormFeedback, { FeedbackState } from './FormFeedback';

export default function BudgetManager({ user, budgets, onClose, onRefresh }: { user: User; budgets: Budget[]; onClose: () => void; onRefresh?: () => void }) {
  const [newCategory, setNewCategory] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDueDay, setNewDueDay] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const cancelEdit = () => {
    setEditingId(null);
    setNewCategory('');
    setNewAmount('');
    setNewDueDay('');
  };

  const handleClose = () => {
    cancelEdit();
    onClose();
  };

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCategory = newCategory.trim().toLowerCase();
    if (!trimmedCategory || !newAmount) return;
    setLoading(true);

    const due_day = newDueDay ? Number(newDueDay) : null;

    if (editingId) {
      const { error } = await supabase
        .from('budgets')
        .update({
          category: trimmedCategory,
          amount: Number(newAmount),
          due_day,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingId);

      if (error) {
        setFeedback({ type: 'error', text: error.message });
      } else {
        setFeedback({ type: 'success', text: '¡Presupuesto actualizado!' });
        cancelEdit();
        onRefresh?.();
        setTimeout(() => setFeedback(null), 2000);
      }
    } else {
      const { error } = await supabase.from('budgets').upsert(
        {
          user_id: user.id,
          category: trimmedCategory,
          amount: Number(newAmount),
          due_day,
        },
        { onConflict: 'user_id,category' }
      );

      if (error) {
        setFeedback({ type: 'error', text: error.message });
      } else {
        setFeedback({ type: 'success', text: '¡Presupuesto agregado!' });
        setNewCategory('');
        setNewAmount('');
        setNewDueDay('');
        onRefresh?.();
        setTimeout(() => setFeedback(null), 2000);
      }
    }
    setLoading(false);
  };

  const handleEdit = (b: Budget) => {
    setFeedback(null);
    setEditingId(b.id);
    setNewCategory(b.category);
    setNewAmount(b.amount.toString());
    setNewDueDay(b.due_day?.toString() || '');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este gasto planificado?')) return;
    const { error } = await supabase.from('budgets').delete().eq('id', id);
    if (error) {
      setFeedback({ type: 'error', text: error.message });
    } else {
      onRefresh?.();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-2xl font-bold text-gray-800">Presupuestos</h3>
            <p className="text-sm text-gray-500">{editingId ? 'Editando categoría' : 'Define cuánto gastarás al mes'}</p>
          </div>
          <button onClick={handleClose} className="p-3 bg-gray-100 rounded-full text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleAddBudget} className="mb-4 p-4 bg-indigo-50 rounded-3xl space-y-4 border border-indigo-100">
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Categoría"
              className="bg-white rounded-2xl px-4 py-3 text-sm font-medium border-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <input
              type="number"
              placeholder="Monto"
              className="bg-white rounded-2xl px-4 py-3 text-sm font-medium border-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
            />
          </div>

          {/* Día de pago opcional */}
          <div className="flex items-center gap-3 bg-white rounded-2xl px-4 py-2.5 shadow-sm">
            <CalendarDays className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <input
              type="number"
              min="1"
              max="31"
              placeholder="Día de pago (opcional, ej: 5)"
              className="flex-1 text-sm font-medium border-none outline-none bg-transparent text-gray-700 placeholder-gray-400"
              value={newDueDay}
              onChange={(e) => setNewDueDay(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <button
              disabled={loading}
              className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-2xl shadow-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center transition"
            >
              <Plus className="w-4 h-4 mr-2" /> {editingId ? 'Actualizar' : 'Agregar'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 bg-gray-200 text-gray-600 font-bold rounded-2xl hover:bg-gray-300 transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <FormFeedback feedback={feedback} />
        </form>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
          <AnimatePresence>
            {budgets.map(b => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group"
              >
                <div onClick={() => handleEdit(b)} className="cursor-pointer flex-1 min-w-0">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block">{b.category}</span>
                  <span className="text-lg font-bold text-gray-700">${Number(b.amount).toLocaleString()}</span>
                  {b.due_day && (
                    <span className="text-[10px] font-semibold text-indigo-500 flex items-center gap-1 mt-0.5">
                      <CalendarDays className="w-3 h-3" /> Día {b.due_day} de cada mes
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(b)}
                    className="p-2 text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition"
                  >
                    <Plus className="w-4 h-4 rotate-45" />
                  </button>
                  <button
                    onClick={() => handleDelete(b.id)}
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {budgets.length === 0 && (
            <div className="text-center py-10">
              <Wallet className="w-12 h-12 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Sin presupuestos definidos</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
