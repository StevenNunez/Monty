import React, { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { X, Save, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { localDateStr } from '../lib/utils';
import FormFeedback, { FeedbackState } from './FormFeedback';
import CurrencyInput from './CurrencyInput';

interface LoanFormProps {
  user: User;
  onClose: () => void;
  onRefresh: () => void;
}

export default function LoanForm({ user, onClose, onRefresh }: LoanFormProps) {
  const [type, setType] = useState<'dado' | 'recibido'>('dado');
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(localDateStr());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const parsedAmount = Number(amount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!person.trim() || parsedAmount <= 0) return;
    setLoading(true);

    const { data: loanData, error: loanError } = await supabase
      .from('loans')
      .insert({
        user_id: user.id,
        type,
        person: person.trim(),
        amount: parsedAmount,
        paid_amount: 0,
        status: 'pendiente',
        date,
        notes: notes.trim() || null,
      })
      .select()
      .single();

    if (loanError) {
      setFeedback({ type: 'error', text: loanError.message });
      setLoading(false);
      return;
    }

    // Crear transacción automática según el tipo
    if (type === 'dado') {
      // Presté dinero → gasto
      await supabase.from('expenses').insert({
        user_id: user.id,
        amount: parsedAmount,
        category: `Préstamo a ${person.trim()}`,
        date,
      });
    } else {
      // Me prestaron → ingreso extra
      await supabase.from('extra_income').insert({
        user_id: user.id,
        amount: parsedAmount,
        date,
        type: 'other',
        affects_goal: false,
        description: `Préstamo de ${person.trim()}`,
      });
    }

    setFeedback({ type: 'success', text: '¡Préstamo registrado!' });
    setTimeout(() => { onRefresh(); onClose(); }, 1200);
    setLoading(false);
  };

  const isDado = type === 'dado';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl"
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-2xl font-bold text-gray-800">Registrar Préstamo</h3>
            <p className="text-sm text-gray-500">Dinero que prestaste o pediste</p>
          </div>
          <button onClick={onClose} className="p-3 bg-gray-100 rounded-full text-gray-400 hover:bg-gray-200 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toggle tipo */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => setType('dado')}
            className={`flex flex-col items-center gap-1.5 p-4 rounded-2xl border-2 font-bold transition ${
              isDado
                ? 'border-sky-500 bg-sky-50 text-sky-700'
                : 'border-gray-100 bg-gray-50 text-gray-400'
            }`}
          >
            <ArrowUpRight className="w-6 h-6" />
            <span className="text-sm">Presté dinero</span>
            <span className="text-[10px] font-normal opacity-70">Sale hoy · entra después</span>
          </button>
          <button
            type="button"
            onClick={() => setType('recibido')}
            className={`flex flex-col items-center gap-1.5 p-4 rounded-2xl border-2 font-bold transition ${
              !isDado
                ? 'border-amber-500 bg-amber-50 text-amber-700'
                : 'border-gray-100 bg-gray-50 text-gray-400'
            }`}
          >
            <ArrowDownLeft className="w-6 h-6" />
            <span className="text-sm">Me prestaron</span>
            <span className="text-[10px] font-normal opacity-70">Entra hoy · sale después</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-4">
              {isDado ? '¿A quién le prestaste?' : '¿Quién te prestó?'}
            </label>
            <input
              type="text"
              required
              placeholder={isDado ? 'Ej: Mamá, Juan, etc.' : 'Ej: Prima, Pedro, etc.'}
              className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold text-gray-700 focus:ring-4 focus:ring-sky-100 transition"
              value={person}
              onChange={e => setPerson(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-4">Monto</label>
            <CurrencyInput
              value={amount}
              onChange={setAmount}
              required
              className={`w-full bg-gray-50 border-none rounded-2xl p-6 text-4xl font-bold text-center transition focus:ring-4 ${
                isDado ? 'focus:ring-sky-100' : 'focus:ring-amber-100'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-4">Fecha</label>
            <input
              type="date"
              className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold text-gray-700 focus:ring-4 focus:ring-sky-100 transition"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-4">Notas (opcional)</label>
            <input
              type="text"
              placeholder="Para qué era, condiciones, etc."
              className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold text-gray-700 focus:ring-4 focus:ring-sky-100 transition"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Info automática */}
          {parsedAmount > 0 && (
            <div className={`rounded-2xl p-4 border ${isDado ? 'bg-sky-50 border-sky-100' : 'bg-amber-50 border-amber-100'}`}>
              <p className={`text-xs font-bold ${isDado ? 'text-sky-600' : 'text-amber-600'}`}>
                {isDado
                  ? `Se registrará un gasto de $${parsedAmount.toLocaleString('es-CL')} a nombre de "Préstamo a ${person || '...'}" hoy.`
                  : `Se registrará un ingreso de $${parsedAmount.toLocaleString('es-CL')} a nombre de "Préstamo de ${person || '...'}" hoy.`
                }
              </p>
            </div>
          )}

          <FormFeedback feedback={feedback} />

          <button
            type="submit"
            disabled={loading || !person.trim() || parsedAmount <= 0}
            className={`w-full text-white font-bold py-5 rounded-2xl shadow-xl transition active:scale-95 flex justify-center items-center text-xl disabled:opacity-50 ${
              isDado ? 'bg-sky-500 hover:bg-sky-600' : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            <Save className="w-6 h-6 mr-2" /> Guardar
          </button>
        </form>
      </motion.div>
    </div>
  );
}
