import React, { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserGoal } from '../types';
import { X, Target, Save } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import FormFeedback, { FeedbackState } from './FormFeedback';

export default function GoalManager({ user, currentGoal, onClose, onRefresh }: { user: User; currentGoal: UserGoal | null; onClose: () => void; onRefresh?: () => void }) {
  const [monthly, setMonthly] = useState(currentGoal?.monthly_target?.toString() || '');
  const [workingDays, setWorkingDays] = useState<number[]>(currentGoal?.working_days || [1, 2, 3, 4, 5, 6]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const days = [
    { label: 'D', value: 0 },
    { label: 'L', value: 1 },
    { label: 'M', value: 2 },
    { label: 'M', value: 3 },
    { label: 'J', value: 4 },
    { label: 'V', value: 5 },
    { label: 'S', value: 6 },
  ];

  const toggleDay = (val: number) => {
    setWorkingDays(prev =>
      prev.includes(val) ? prev.filter(d => d !== val) : [...prev, val].sort()
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const monthlyTarget = Number(monthly);
    const yearlyTarget = monthlyTarget * 12;

    const { error } = await supabase.from('goals').upsert({
      user_id: user.id,
      monthly_target: monthlyTarget,
      yearly_target: yearlyTarget,
      working_days: workingDays
    }, { onConflict: 'user_id' });

    if (error) {
      setFeedback({ type: 'error', text: error.message });
    } else {
      setFeedback({ type: 'success', text: '¡Metas guardadas!' });
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
          <h3 className="text-2xl font-bold">Configurar Metas</h3>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="p-5 bg-indigo-50 rounded-3xl border-2 border-indigo-100 space-y-3">
            <div className="flex items-center gap-3">
              <Target className="w-8 h-8 text-indigo-600 shrink-0" />
              <div>
                <div className="text-sm font-bold text-indigo-700">Meta bruta desde plataformas</div>
                <p className="text-xs text-indigo-400">Lo que quieres generar en Uber, Didi, etc.</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-3 text-xs text-gray-600 leading-relaxed space-y-1">
              <p className="font-bold text-gray-700">¿Cómo calcular este número?</p>
              <p>Lo que quiero quedarme (neto) <span className="text-gray-400">ej. $800.000</span></p>
              <p>+ Bencina mensual estimada <span className="text-gray-400">ej. $150.000</span></p>
              <p>+ Otros gastos fijos <span className="text-gray-400">ej. $200.000</span></p>
              <div className="border-t border-gray-100 pt-1 font-bold text-indigo-600">= Meta bruta: $1.150.000</div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Meta Mensual Bruta</label>
            <input
              type="number"
              required
              placeholder="Ej. 1150000"
              className="w-full bg-gray-50 border-none rounded-2xl p-4 text-2xl font-bold text-center"
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Días Laborales</label>
            <div className="flex justify-between gap-2">
              {days.map(day => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={cn(
                    "w-10 h-10 rounded-xl font-bold transition-all",
                    workingDays.includes(day.value)
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                      : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="bg-gray-50 p-4 rounded-2xl flex justify-between items-center">
              <div>
                <span className="text-[10px] text-gray-400 uppercase block">Meta Anual</span>
                <span className="font-bold text-gray-700">${(Number(monthly) * 12).toLocaleString()}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 uppercase block">Meta Diaria Base</span>
                <span className="font-bold text-indigo-600">
                  ${workingDays.length > 0 ? (Number(monthly) / (workingDays.length * 4.33)).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
                </span>
              </div>
            </div>
          </div>

          <FormFeedback feedback={feedback} />

          <button
            disabled={loading}
            className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-indigo-700 disabled:opacity-50 flex justify-center items-center transition"
          >
            <Save className="w-5 h-5 mr-2" /> Guardar Metas
          </button>
        </form>
      </motion.div>
    </div>
  );
}
