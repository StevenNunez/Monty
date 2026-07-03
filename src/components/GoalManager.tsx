import React, { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserGoal, IncomeMode } from '../types';
import { X, Target, Save, Car, Briefcase, PiggyBank } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import FormFeedback, { FeedbackState } from './FormFeedback';

export default function GoalManager({ user, currentGoal, onClose, onRefresh }: { user: User; currentGoal: UserGoal | null; onClose: () => void; onRefresh?: () => void }) {
  const [mode, setMode] = useState<IncomeMode>(currentGoal?.income_mode || 'driver');
  const [monthly, setMonthly] = useState(currentGoal?.monthly_target?.toString() || '');
  const [salaryAmount, setSalaryAmount] = useState(
    currentGoal?.salary_amount ? String(Math.round(Number(currentGoal.salary_amount))) : ''
  );
  const [salaryPayDay, setSalaryPayDay] = useState(currentGoal?.salary_pay_day?.toString() || '');
  const [workingDays, setWorkingDays] = useState<number[]>(currentGoal?.working_days || [1, 2, 3, 4, 5, 6]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const modes: { value: IncomeMode; label: string; desc: string; icon: React.ReactNode }[] = [
    { value: 'driver', label: 'Conductor', desc: 'Vivo de las apps', icon: <Car className="w-5 h-5" /> },
    { value: 'salary', label: 'Sueldo', desc: 'Sueldo fijo mensual', icon: <Briefcase className="w-5 h-5" /> },
    { value: 'mixed', label: 'Mixto', desc: 'Sueldo + apps', icon: <PiggyBank className="w-5 h-5" /> },
  ];

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

    const monthlyTarget = Number(monthly) || 0;
    const yearlyTarget = monthlyTarget * 12;

    const { error } = await supabase.from('goals').upsert({
      user_id: user.id,
      monthly_target: monthlyTarget,
      yearly_target: yearlyTarget,
      working_days: workingDays,
      income_mode: mode,
      salary_amount: Number(salaryAmount) || 0,
      salary_pay_day: salaryPayDay ? Number(salaryPayDay) : null
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
          {/* Selector de modo de ingreso */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">¿Cómo generas tus ingresos?</label>
            <div className="grid grid-cols-3 gap-2">
              {modes.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-all",
                    mode === m.value
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200"
                  )}
                >
                  {m.icon}
                  <span className="text-xs font-black">{m.label}</span>
                  <span className="text-[9px] font-medium leading-tight text-center">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Modo conductor: explicación de meta bruta */}
          {mode === 'driver' && (
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
          )}

          {/* Modos sueldo/mixto: explicación de meta de ahorro */}
          {mode !== 'driver' && (
            <div className="p-5 bg-emerald-50 rounded-3xl border-2 border-emerald-100 space-y-3">
              <div className="flex items-center gap-3">
                <PiggyBank className="w-8 h-8 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-emerald-700">Tu sueldo cubre el mes</div>
                  <p className="text-xs text-emerald-500">
                    {mode === 'mixed'
                      ? 'Y lo que generes en apps acelera tu meta de ahorro.'
                      : 'Monty te dirá cuánto puedes gastar cada día.'}
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-3 text-xs text-gray-600 leading-relaxed">
                La <b>meta de ahorro</b> es lo que quieres que te sobre a fin de mes, después de presupuestos y gastos.
                {mode === 'mixed' && ' Los ingresos de Uber/Didi suman directo a ese ahorro.'}
              </div>
            </div>
          )}

          {/* Sueldo mensual + día de pago */}
          {mode !== 'driver' && (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-500 mb-1">Sueldo Mensual</label>
                <input
                  type="number"
                  required
                  placeholder="Ej. 700000"
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 text-xl font-bold text-center"
                  value={salaryAmount}
                  onChange={(e) => setSalaryAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Día de pago</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  placeholder="30"
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 text-xl font-bold text-center"
                  value={salaryPayDay}
                  onChange={(e) => setSalaryPayDay(e.target.value)}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">
              {mode === 'driver' ? 'Meta Mensual Bruta' : 'Meta de Ahorro Mensual'}
            </label>
            <input
              type="number"
              required
              placeholder={mode === 'driver' ? 'Ej. 1150000' : 'Ej. 200000'}
              className="w-full bg-gray-50 border-none rounded-2xl p-4 text-2xl font-bold text-center"
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
            />
          </div>

          {/* Días laborales (conductor) / días que manejas (mixto) */}
          {mode !== 'salary' && (
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                {mode === 'driver' ? 'Días Laborales' : 'Días que sales a manejar'}
              </label>
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
          )}

          {mode === 'driver' && (
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
          )}

          {mode !== 'driver' && Number(salaryAmount) > 0 && (
            <div className="bg-gray-50 p-4 rounded-2xl flex justify-between items-center">
              <div>
                <span className="text-[10px] text-gray-400 uppercase block">Ahorro anual proyectado</span>
                <span className="font-bold text-emerald-600">${(Number(monthly) * 12).toLocaleString()}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 uppercase block">Sueldo − Ahorro</span>
                <span className="font-bold text-gray-700">
                  ${Math.max(0, Number(salaryAmount) - Number(monthly)).toLocaleString()} <span className="text-[10px] text-gray-400 font-medium">para vivir</span>
                </span>
              </div>
            </div>
          )}

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
