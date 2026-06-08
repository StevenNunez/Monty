import React, { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { X, Gift } from 'lucide-react';
import { motion } from 'motion/react';
import { cn, localDateStr } from '../lib/utils';
import FormFeedback, { FeedbackState } from './FormFeedback';
import CurrencyInput from './CurrencyInput';

export default function ExtraIncomeForm({ user, onClose, onRefresh }: { user: User; onClose: () => void; onRefresh?: () => void }) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'bonus' | 'tax_return' | 'sale' | 'other'>('bonus');
  const [affectsGoal, setAffectsGoal] = useState(true);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from('extra_income').insert({
      user_id: user.id,
      amount: Number(amount),
      type,
      affects_goal: affectsGoal,
      date: localDateStr()
    });

    if (error) {
      setFeedback({ type: 'error', text: error.message });
    } else {
      setFeedback({ type: 'success', text: '¡Ingreso extra guardado!' });
      setTimeout(() => { onRefresh?.(); onClose(); }, 1200);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold">Ingreso Extra</h3>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-orange-50 p-4 rounded-2xl flex items-start gap-3 border border-orange-100">
            <Gift className="w-5 h-5 text-orange-500 mt-1 shrink-0" />
            <p className="text-xs text-orange-700 leading-relaxed">
              Los ingresos que "afectan la meta" reducirán tu objetivo mensual restante, bajando tu meta diaria automáticamente.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Monto</label>
            <CurrencyInput
              value={amount}
              onChange={setAmount}
              required
              className="w-full bg-gray-50 border-none rounded-2xl p-4 text-2xl font-bold"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Tipo</label>
            <select
              className="w-full bg-gray-50 border-none rounded-2xl p-4"
              value={type}
              onChange={(e) => setType(e.target.value as 'bonus' | 'tax_return' | 'sale' | 'other')}
            >
              <option value="bonus">Bono / Gratificación</option>
              <option value="tax_return">Devolución Impuestos</option>
              <option value="sale">Venta de artículo</option>
              <option value="other">Otro</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
            <span className="text-sm font-medium text-gray-700">¿Afecta la meta mensual?</span>
            <button
              type="button"
              onClick={() => setAffectsGoal(!affectsGoal)}
              className={cn("w-12 h-6 rounded-full p-1 transition-colors duration-200",
                affectsGoal ? "bg-indigo-600" : "bg-gray-300")}
            >
              <div className={cn("w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200",
                affectsGoal ? "translate-x-6" : "translate-x-0")} />
            </button>
          </div>

          <FormFeedback feedback={feedback} />

          <button
            disabled={loading}
            className="w-full bg-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-orange-700 disabled:opacity-50"
          >
            Añadir Extra
          </button>
        </form>
      </motion.div>
    </div>
  );
}
