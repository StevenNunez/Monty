import React, { Fragment, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { X, ArrowUpRight, ArrowDownLeft, CheckCircle, Plus, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency, localDateStr } from '../lib/utils';
import { Loan } from '../types';
import FormFeedback, { FeedbackState } from './FormFeedback';
import CurrencyInput from './CurrencyInput';
import LoanForm from './LoanForm';

interface LoanManagerProps {
  user: User;
  loans: Loan[];
  onClose: () => void;
  onRefresh: () => void;
}

function PaymentModal({
  loan,
  user,
  onClose,
  onDone,
}: {
  loan: Loan;
  user: User;
  onClose: () => void;
  onDone: () => void;
}) {
  const remaining = loan.amount - loan.paid_amount;
  const [payAmount, setPayAmount] = useState(String(remaining));
  const [date, setDate] = useState(localDateStr());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const parsed = Number(payAmount) || 0;
  const isFullPayment = parsed >= remaining;

  const handlePay = async () => {
    if (parsed <= 0 || parsed > remaining) return;
    setLoading(true);

    const newPaid = loan.paid_amount + parsed;
    const newStatus = newPaid >= loan.amount ? 'saldado' : 'parcial';

    const { error: payError } = await supabase.from('loan_payments').insert({
      loan_id: loan.id,
      user_id: user.id,
      amount: parsed,
      date,
      notes: notes.trim() || null,
    });

    if (payError) {
      setFeedback({ type: 'error', text: payError.message });
      setLoading(false);
      return;
    }

    await supabase.from('loans').update({ paid_amount: newPaid, status: newStatus }).eq('id', loan.id);

    // Crear transacción inversa
    if (loan.type === 'dado') {
      // Me están pagando → ingreso
      await supabase.from('extra_income').insert({
        user_id: user.id,
        amount: parsed,
        date,
        type: 'other',
        affects_goal: false,
        description: `Cobro préstamo de ${loan.person}`,
      });
    } else {
      // Estoy pagando → gasto
      await supabase.from('expenses').insert({
        user_id: user.id,
        amount: parsed,
        category: `Pago préstamo a ${loan.person}`,
        date,
      });
    }

    setFeedback({ type: 'success', text: isFullPayment ? '¡Préstamo saldado!' : '¡Abono registrado!' });
    setTimeout(() => { onDone(); onClose(); }, 1200);
    setLoading(false);
  };

  const isDado = loan.type === 'dado';

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-800">
              {isDado ? 'Registrar cobro' : 'Registrar pago'}
            </h3>
            <p className="text-sm text-gray-500">{loan.person} · Pendiente: {formatCurrency(remaining)}</p>
          </div>
          <button onClick={onClose} className="p-3 bg-gray-100 rounded-full text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-4">Monto</label>
            <CurrencyInput
              value={payAmount}
              onChange={setPayAmount}
              className={`w-full bg-gray-50 border-none rounded-2xl p-5 text-3xl font-bold text-center transition focus:ring-4 ${
                isDado ? 'focus:ring-sky-100' : 'focus:ring-amber-100'
              }`}
            />
            {parsed > remaining && (
              <p className="text-xs text-red-500 font-bold ml-4 mt-1">Máximo: {formatCurrency(remaining)}</p>
            )}
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
              placeholder="Descripción del pago..."
              className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold text-gray-700 focus:ring-4 focus:ring-sky-100 transition"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <FormFeedback feedback={feedback} />

          <button
            onClick={handlePay}
            disabled={loading || parsed <= 0 || parsed > remaining}
            className={`w-full text-white font-bold py-5 rounded-2xl shadow-xl transition active:scale-95 flex justify-center items-center text-xl disabled:opacity-50 ${
              isDado ? 'bg-sky-500 hover:bg-sky-600' : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            <CheckCircle className="w-6 h-6 mr-2" />
            {isFullPayment ? 'Saldar completo' : 'Registrar abono'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function LoanCard({
  loan,
  user,
  onRefresh,
}: {
  loan: Loan;
  user: User;
  onRefresh: () => void;
}) {
  const [showPayment, setShowPayment] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isDado = loan.type === 'dado';
  const remaining = loan.amount - loan.paid_amount;
  const progress = loan.paid_amount / loan.amount;

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await supabase.from('loans').delete().eq('id', loan.id);
    onRefresh();
  };

  return (
    <>
      <div className={`bg-white rounded-2xl border-2 p-5 ${isDado ? 'border-sky-100' : 'border-amber-100'}`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${isDado ? 'bg-sky-100' : 'bg-amber-100'}`}>
              {isDado
                ? <ArrowUpRight className="w-4 h-4 text-sky-600" />
                : <ArrowDownLeft className="w-4 h-4 text-amber-600" />
              }
            </div>
            <div>
              <p className="font-black text-gray-800">{loan.person}</p>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${isDado ? 'text-sky-500' : 'text-amber-500'}`}>
                {isDado ? 'Te deben' : 'Debes'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-black text-gray-800">{formatCurrency(remaining)}</p>
            <p className="text-[10px] text-gray-400">de {formatCurrency(loan.amount)}</p>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all ${isDado ? 'bg-sky-400' : 'bg-amber-400'}`}
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>

        {loan.notes && (
          <p className="text-xs text-gray-400 mb-3 italic">"{loan.notes}"</p>
        )}

        <div className="flex gap-2">
          {loan.status !== 'saldado' && (
            <button
              onClick={() => setShowPayment(true)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition active:scale-95 flex items-center justify-center gap-1.5 ${
                isDado
                  ? 'bg-sky-50 text-sky-600 hover:bg-sky-100'
                  : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
              }`}
            >
              <Plus className="w-4 h-4" />
              {isDado ? 'Registrar cobro' : 'Registrar pago'}
            </button>
          )}
          <button
            onClick={handleDelete}
            className={`py-2.5 px-3 rounded-xl text-sm font-bold transition active:scale-95 ${
              confirmDelete ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
            }`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        {confirmDelete && (
          <p className="text-xs text-red-500 font-bold text-center mt-2">Toca el icono otra vez para confirmar borrado</p>
        )}
      </div>

      {showPayment && (
        <PaymentModal
          loan={loan}
          user={user}
          onClose={() => setShowPayment(false)}
          onDone={onRefresh}
        />
      )}
    </>
  );
}

export default function LoanManager({ user, loans, onClose, onRefresh }: LoanManagerProps) {
  const [showSaldados, setShowSaldados] = useState(false);
  const [showNewLoanForm, setShowNewLoanForm] = useState(false);

  const activos = loans.filter(l => l.status !== 'saldado');
  const saldados = loans.filter(l => l.status === 'saldado');

  const totalMeDeben = activos.filter(l => l.type === 'dado').reduce((s, l) => s + (l.amount - l.paid_amount), 0);
  const totalDebo = activos.filter(l => l.type === 'recibido').reduce((s, l) => s + (l.amount - l.paid_amount), 0);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header fijo */}
          <div className="p-8 pb-4 flex-shrink-0">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-2xl font-bold text-gray-800">Préstamos</h3>
                <p className="text-sm text-gray-500">Dinero que debes y te deben</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowNewLoanForm(true)}
                  className="flex items-center gap-1.5 bg-sky-50 text-sky-600 hover:bg-sky-100 transition px-3 py-2 rounded-xl text-sm font-bold active:scale-95"
                >
                  <Plus className="w-4 h-4" /> Nuevo
                </button>
                <button onClick={onClose} className="p-3 bg-gray-100 rounded-full text-gray-400 hover:bg-gray-200 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Resumen */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-sky-50 rounded-2xl p-4 border border-sky-100">
                <p className="text-[10px] font-bold text-sky-500 uppercase tracking-wider mb-1">Te deben</p>
                <p className="text-xl font-black text-sky-700">{formatCurrency(totalMeDeben)}</p>
              </div>
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1">Debes</p>
                <p className="text-xl font-black text-amber-700">{formatCurrency(totalDebo)}</p>
              </div>
            </div>
          </div>

          {/* Lista scrolleable */}
          <div className="overflow-y-auto flex-1 px-8 pb-8 space-y-3">
            {activos.length === 0 && (
              <div className="text-center py-10">
                <p className="text-gray-300 text-4xl mb-3">🤝</p>
                <p className="text-gray-400 text-sm font-medium">Sin préstamos activos</p>
                <button
                  onClick={() => setShowNewLoanForm(true)}
                  className="mt-4 text-sm font-bold text-sky-500 hover:text-sky-700 transition"
                >
                  + Registrar primer préstamo
                </button>
              </div>
            )}

            {activos.map(loan => (
              <Fragment key={loan.id}>
                <LoanCard loan={loan} user={user} onRefresh={onRefresh} />
              </Fragment>
            ))}

            {/* Saldados */}
            {saldados.length > 0 && (
              <div>
                <button
                  onClick={() => setShowSaldados(v => !v)}
                  className="w-full flex items-center justify-between py-3 text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-gray-500 transition"
                >
                  <span>Saldados ({saldados.length})</span>
                  {showSaldados ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <AnimatePresence>
                  {showSaldados && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 overflow-hidden"
                    >
                      {saldados.map(loan => (
                        <Fragment key={loan.id}>
                          <LoanCard loan={loan} user={user} onRefresh={onRefresh} />
                        </Fragment>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Modal nuevo préstamo encima del manager */}
      {showNewLoanForm && (
        <LoanForm
          user={user}
          onClose={() => setShowNewLoanForm(false)}
          onRefresh={() => { onRefresh(); setShowNewLoanForm(false); }}
        />
      )}
    </>
  );
}
