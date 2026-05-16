import React, { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { X, Save } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import FormFeedback, { FeedbackState } from './FormFeedback';
import CurrencyInput from './CurrencyInput';

interface ExpenseFormProps {
  user: User;
  categories: string[];
  onClose: () => void;
  onRefresh?: () => void;
  defaultCategory?: string;
  defaultDate?: string;
  defaultIsUnplanned?: boolean;
}

export default function ExpenseForm({
  user,
  categories,
  onClose,
  onRefresh,
  defaultCategory,
  defaultDate,
  defaultIsUnplanned,
}: ExpenseFormProps) {
  const resolvedIsUnplanned = defaultIsUnplanned ?? categories.length === 0;

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(defaultCategory && categories.includes(defaultCategory) ? defaultCategory : (categories[0] || ''));
  const [isUnplanned, setIsUnplanned] = useState(resolvedIsUnplanned);
  const [customCategory, setCustomCategory] = useState(resolvedIsUnplanned && defaultCategory ? defaultCategory : '');
  const [date, setDate] = useState(defaultDate || new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = isUnplanned ? customCategory.trim() : category;
    if (!amount || !finalCategory) return;
    setLoading(true);

    const { error } = await supabase.from('expenses').insert({
      user_id: user.id,
      amount: Number(amount),
      category: finalCategory.toLowerCase(),
      date: date
    });

    if (error) {
      setFeedback({ type: 'error', text: error.message });
    } else {
      setFeedback({ type: 'success', text: '¡Gasto registrado!' });
      setTimeout(() => { onRefresh?.(); onClose(); }, 1200);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl"
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-2xl font-bold text-gray-800">Registrar Gasto</h3>
            <p className="text-sm text-gray-500">¿Es un gasto planeado o un imprevisto?</p>
          </div>
          <button onClick={onClose} className="p-3 bg-gray-100 rounded-full text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex bg-gray-100 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setIsUnplanned(false)}
              className={cn("flex-1 py-3 rounded-xl text-sm font-bold transition",
                !isUnplanned ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500")}
            >
              Planificado
            </button>
            <button
              type="button"
              onClick={() => setIsUnplanned(true)}
              className={cn("flex-1 py-3 rounded-xl text-sm font-bold transition",
                isUnplanned ? "bg-white text-orange-600 shadow-sm" : "text-gray-500")}
            >
              Imprevisto
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-4">Fecha</label>
            <input
              type="date"
              required
              className="w-full bg-gray-50 border-none rounded-2xl p-4 text-center font-bold text-indigo-600 focus:ring-4 focus:ring-red-100 transition"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-4">Monto</label>
              <CurrencyInput
                value={amount}
                onChange={setAmount}
                required
                autoFocus
                className="w-full bg-gray-50 border-none rounded-2xl p-6 text-4xl font-bold text-center focus:ring-4 focus:ring-red-100 transition"
              />
            </div>

            {isUnplanned ? (
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-4">¿En qué gastaste?</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Bencina, Galletas..."
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 text-lg font-bold text-gray-700 focus:ring-4 focus:ring-orange-100 transition"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-4">Categoría</label>
                <select
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 text-lg font-bold text-gray-700 focus:ring-4 focus:ring-indigo-100 transition appearance-none"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {categories.length === 0 && <option value="">Sin categorías planificadas</option>}
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <FormFeedback feedback={feedback} />

          <button
            disabled={loading || (!isUnplanned && categories.length === 0)}
            className={cn(
              "w-full text-white font-bold py-5 rounded-2xl shadow-xl transition active:scale-95 flex justify-center items-center text-xl",
              isUnplanned ? "bg-orange-600 hover:bg-orange-700" : "bg-gray-900 hover:bg-black"
            )}
          >
            <Save className="w-6 h-6 mr-2" /> Guardar Gasto
          </button>
        </form>
      </motion.div>
    </div>
  );
}
