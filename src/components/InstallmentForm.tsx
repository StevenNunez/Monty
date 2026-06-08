import React, { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { X, Save } from 'lucide-react';
import { motion } from 'motion/react';
import { formatCurrency } from '../lib/utils';
import FormFeedback, { FeedbackState } from './FormFeedback';
import CurrencyInput from './CurrencyInput';

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const INSTALLMENT_OPTIONS = [1, 2, 3, 6, 9, 12, 18, 24];

interface InstallmentFormProps {
  user: User;
  onClose: () => void;
  onRefresh: () => void;
}

export default function InstallmentForm({ user, onClose, onRefresh }: InstallmentFormProps) {
  const today = new Date();
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [totalInstallments, setTotalInstallments] = useState(3);
  const [startMonth, setStartMonth] = useState(today.getMonth() + 1);
  const [startYear, setStartYear] = useState(today.getFullYear());
  const [dueDay, setDueDay] = useState<number | ''>(today.getDate());
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const parsedTotal = Number(totalAmount) || 0;
  const installmentAmount = totalInstallments > 0 && parsedTotal > 0
    ? Math.ceil(parsedTotal / totalInstallments)
    : 0;

  const getEndLabel = () => {
    const endDate = new Date(startYear, startMonth - 1 + totalInstallments - 1);
    return `${MONTHS_ES[endDate.getMonth()]} ${endDate.getFullYear()}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || parsedTotal <= 0) return;
    setLoading(true);

    const basePayload = {
      user_id: user.id,
      description: description.trim(),
      total_amount: parsedTotal,
      installment_amount: installmentAmount,
      total_installments: totalInstallments,
      start_year: startYear,
      start_month: startMonth,
    };

    let { error } = await supabase.from('credit_installments').insert({
      ...basePayload,
      due_day: dueDay || null,
    });

    // Si la columna due_day no existe aún (migración pendiente), reintentar sin ella
    if (error && (error.message?.includes('due_day') || error.code === '42703' || error.code === 'PGRST204')) {
      ({ error } = await supabase.from('credit_installments').insert(basePayload));
    }

    if (error) {
      setFeedback({ type: 'error', text: error.message });
    } else {
      setFeedback({ type: 'success', text: '¡Cuota registrada!' });
      setTimeout(() => { onRefresh(); onClose(); }, 1200);
    }
    setLoading(false);
  };

  const yearOptions = [today.getFullYear(), today.getFullYear() + 1];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl"
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-2xl font-bold text-gray-800">Nueva Cuota</h3>
            <p className="text-sm text-gray-500">Registra una compra en cuotas</p>
          </div>
          <button onClick={onClose} className="p-3 bg-gray-100 rounded-full text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-4">Descripción</label>
            <input
              type="text"
              required
              placeholder="Ej: Samsung Galaxy S24 - Ripley"
              className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold text-gray-700 focus:ring-4 focus:ring-purple-100 transition"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-4">Monto Total</label>
            <CurrencyInput
              value={totalAmount}
              onChange={setTotalAmount}
              required
              className="w-full bg-gray-50 border-none rounded-2xl p-6 text-4xl font-bold text-center focus:ring-4 focus:ring-purple-100 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-4">Número de cuotas</label>
            <div className="flex flex-wrap gap-2">
              {INSTALLMENT_OPTIONS.map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setTotalInstallments(n)}
                  className={`px-4 py-2 rounded-2xl text-sm font-bold transition ${
                    totalInstallments === n
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {n === 1 ? '1 (contado)' : `${n}x`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-4">Primera cuota en</label>
            <div className="flex gap-3">
              <select
                className="flex-1 bg-gray-50 border-none rounded-2xl p-4 font-bold text-gray-700 focus:ring-4 focus:ring-purple-100"
                value={startMonth}
                onChange={e => setStartMonth(Number(e.target.value))}
              >
                {MONTHS_ES.map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
              <select
                className="bg-gray-50 border-none rounded-2xl p-4 font-bold text-gray-700 focus:ring-4 focus:ring-purple-100"
                value={startYear}
                onChange={e => setStartYear(Number(e.target.value))}
              >
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-4">Día de cobro mensual</label>
            <select
              className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold text-gray-700 focus:ring-4 focus:ring-purple-100"
              value={dueDay}
              onChange={e => setDueDay(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Sin alerta de pago</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                <option key={d} value={d}>Día {d} de cada mes</option>
              ))}
            </select>
          </div>

          {parsedTotal > 0 && (
            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Por cuota</span>
                  <div className="text-2xl font-black text-purple-800">{formatCurrency(installmentAmount)}</div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Duración</span>
                  <div className="text-sm font-bold text-purple-600">{totalInstallments} {totalInstallments === 1 ? 'mes' : 'meses'}</div>
                </div>
              </div>
              <div className="mt-2 text-[10px] text-purple-400 font-bold uppercase tracking-wide">
                {MONTHS_ES[startMonth - 1]} {startYear} → {getEndLabel()}
              </div>
            </div>
          )}

          <FormFeedback feedback={feedback} />

          <button
            type="submit"
            disabled={loading || !description.trim() || parsedTotal <= 0}
            className="w-full bg-purple-600 text-white font-bold py-5 rounded-2xl shadow-xl hover:bg-purple-700 transition active:scale-95 flex justify-center items-center text-xl disabled:opacity-50"
          >
            <Save className="w-6 h-6 mr-2" /> Guardar
          </button>
        </form>
      </motion.div>
    </div>
  );
}
