import React, { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { X, Save, Plus, Trash2, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency, localDateStr } from '../lib/utils';
import FormFeedback, { FeedbackState } from './FormFeedback';
import CurrencyInput from './CurrencyInput';

interface Item {
  description: string;
  amount: string;
  date: string;
}

interface ExpenseGroupFormProps {
  user: User;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function ExpenseGroupForm({ user, onClose, onRefresh }: ExpenseGroupFormProps) {
  const [name, setName] = useState('');
  const [items, setItems] = useState<Item[]>([{ description: '', amount: '', date: localDateStr() }]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const addItem = () => setItems(prev => [...prev, { description: '', amount: '', date: localDateStr() }]);

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: 'description' | 'amount' | 'date', value: string) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter(item => item.description.trim() && Number(item.amount) > 0);
    if (!name.trim()) return;
    setLoading(true);

    const { data: group, error: groupError } = await supabase
      .from('expense_groups')
      .insert({ user_id: user.id, name: name.trim() })
      .select()
      .single();

    if (groupError || !group) {
      setFeedback({ type: 'error', text: groupError?.message || 'Error al crear el grupo' });
      setLoading(false);
      return;
    }

    if (validItems.length > 0) {
      const { error: itemsError } = await supabase.from('expense_group_items').insert(
        validItems.map(item => ({
          group_id: group.id,
          user_id: user.id,
          description: item.description.trim(),
          amount: Number(item.amount),
          date: item.date || localDateStr(),
        }))
      );
      if (itemsError) {
        setFeedback({ type: 'error', text: itemsError.message });
        setLoading(false);
        return;
      }
    }

    setFeedback({ type: 'success', text: '¡Grupo creado!' });
    setTimeout(() => { onRefresh?.(); onClose(); }, 1200);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-8 pb-4 shrink-0">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 bg-violet-100 rounded-2xl flex items-center justify-center">
                <Package className="w-4 h-4 text-violet-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800">Grupo de Gastos</h3>
            </div>
            <p className="text-sm text-gray-500 ml-12">Agrupa varios gastos bajo un mismo concepto</p>
          </div>
          <button onClick={onClose} className="p-3 bg-gray-100 rounded-full text-gray-400 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto flex-1 px-8 py-4 space-y-5">
            {/* Nombre del grupo */}
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-4">
                Nombre del grupo
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Viaje a Monterrey, Navidad..."
                className="w-full bg-gray-50 border-none rounded-2xl p-4 text-lg font-bold text-gray-700 focus:ring-4 focus:ring-violet-100 outline-none transition"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            {/* Ítems */}
            <div>
              <div className="flex justify-between items-center mb-3 ml-4">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Ítems iniciales (opcional)</label>
                <span className="text-xs font-black text-violet-600">
                  {items.length} ítem{items.length !== 1 ? 's' : ''}
                </span>
              </div>

              <AnimatePresence initial={false}>
                {items.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex gap-2 items-start bg-gray-50 rounded-2xl p-3">
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          required
                          placeholder="Descripción (Ej: Pasaje micro)"
                          className="w-full bg-white border-none rounded-xl px-3 py-2.5 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-violet-200 outline-none transition"
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                        />
                        <div className="flex gap-2">
                          <CurrencyInput
                            value={item.amount}
                            onChange={(val) => updateItem(index, 'amount', val)}
                            required
                            placeholder="$0"
                            className="flex-1 bg-white border-none rounded-xl px-3 py-2.5 text-sm font-black text-violet-600 text-center focus:ring-2 focus:ring-violet-200 outline-none transition"
                          />
                          <input
                            type="date"
                            className="flex-1 bg-white border-none rounded-xl px-3 py-2.5 text-sm text-gray-500 focus:ring-2 focus:ring-violet-200 outline-none transition"
                            value={item.date}
                            onChange={(e) => updateItem(index, 'date', e.target.value)}
                          />
                        </div>
                      </div>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition mt-1 shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              <button
                type="button"
                onClick={addItem}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-violet-200 text-violet-500 font-bold rounded-2xl hover:border-violet-400 hover:bg-violet-50 transition text-sm"
              >
                <Plus className="w-4 h-4" /> Agregar ítem
              </button>
            </div>
          </div>

          {/* Footer: total + save */}
          <div className="px-8 pb-8 pt-4 border-t border-gray-100 space-y-4 shrink-0">
            {total > 0 && (
              <div className="flex justify-between items-center bg-violet-50 rounded-2xl p-4">
                <span className="text-sm font-bold text-violet-700">Total del grupo</span>
                <span className="text-xl font-black text-violet-600">{formatCurrency(total)}</span>
              </div>
            )}

            <FormFeedback feedback={feedback} />

            <button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-5 rounded-2xl shadow-xl transition active:scale-95 flex justify-center items-center text-xl",
                loading && "opacity-70 cursor-not-allowed"
              )}
            >
              <Save className="w-6 h-6 mr-2" /> Guardar Grupo
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
