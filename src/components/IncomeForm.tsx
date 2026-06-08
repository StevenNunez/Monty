import React, { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { IncomeSource } from '../types';
import { X, Save } from 'lucide-react';
import { motion } from 'motion/react';
import FormFeedback, { FeedbackState } from './FormFeedback';
import { localDateStr } from '../lib/utils';
import CurrencyInput from './CurrencyInput';

interface IncomeFormProps {
  user: User;
  onClose: () => void;
  onRefresh?: () => void;
  onSaved?: (date: string) => void;
}

export default function IncomeForm({ user, onClose, onRefresh, onSaved }: IncomeFormProps) {
  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [gross, setGross] = useState('');
  const [date, setDate] = useState(localDateStr());
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');

  useEffect(() => {
    supabase.from('income_sources').select('*').eq('user_id', user.id).then(({ data }) => {
      if (data) setSources(data);
    });
  }, [user.id]);

  const handleAddSource = async () => {
    const trimmedName = newSourceName.trim();
    if (!trimmedName) return;
    const { data } = await supabase.from('income_sources').insert({
      user_id: user.id,
      name: trimmedName
    }).select().single();
    if (data) {
      setSources([...sources, data]);
      setSourceId(data.id);
      setShowAddSource(false);
      setNewSourceName('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(gross);
    if (!amount) return;

    setLoading(true);
    const { error } = await supabase.from('daily_entries').insert({
      user_id: user.id,
      source_id: sourceId || null,
      gross_income: amount,
      operational_costs: 0,
      net_income: amount,
      date: date
    });

    if (error) {
      setFeedback({ type: 'error', text: error.message });
    } else {
      setFeedback({ type: 'success', text: '¡Ingreso guardado!' });
      onSaved?.(date);
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
          <div>
            <h3 className="text-2xl font-black tracking-tight">Registrar Ingreso</h3>
            <p className="text-xs text-gray-400 font-medium mt-0.5">Monto bruto desde la plataforma</p>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Fecha</label>
            <input
              type="date"
              required
              className="w-full bg-gray-50 border-none rounded-2xl p-4 text-lg font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-500"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Plataforma / Fuente</label>
            <div className="flex gap-2">
              <select
                className="flex-1 bg-gray-50 border-none rounded-2xl p-4"
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
              >
                <option value="">Sin fuente específica</option>
                {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button
                type="button"
                onClick={() => setShowAddSource(!showAddSource)}
                className="bg-gray-100 p-4 rounded-2xl text-indigo-600 font-bold"
              >
                +
              </button>
            </div>
            {showAddSource && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="mt-2 flex gap-2"
              >
                <input
                  className="flex-1 bg-gray-100 border-none rounded-xl px-4 text-sm"
                  placeholder="Ej: Uber, Didi, Pirata..."
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSource())}
                />
                <button
                  type="button"
                  onClick={handleAddSource}
                  className="bg-indigo-100 text-indigo-700 px-4 rounded-xl text-xs font-bold"
                >
                  OK
                </button>
              </motion.div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">
              Lo que generaste hoy (bruto)
            </label>
            <CurrencyInput
              value={gross}
              onChange={setGross}
              required
              autoFocus
              className="w-full bg-gray-50 border-none rounded-2xl p-5 text-3xl font-black text-indigo-600 text-center focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[10px] text-gray-400 text-center mt-1 font-medium">
              Lo que muestra la app — sin descontar bencina
            </p>
          </div>

          <FormFeedback feedback={feedback} />

          <button
            disabled={loading}
            className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-indigo-700 disabled:opacity-50 flex justify-center items-center"
          >
            <Save className="w-5 h-5 mr-2" /> Registrar
          </button>
        </form>
      </motion.div>
    </div>
  );
}
