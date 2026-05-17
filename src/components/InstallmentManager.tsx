import React, { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { CreditInstallment } from '../types';
import { supabase } from '../lib/supabase';
import { X, Plus, Trash2, CreditCard, Calendar } from 'lucide-react';
import { motion } from 'motion/react';
import { formatCurrency } from '../lib/utils';
import InstallmentForm from './InstallmentForm';

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function getEndLabel(inst: CreditInstallment): string {
  const endDate = new Date(inst.start_year, inst.start_month - 1 + inst.total_installments - 1);
  return `${MONTHS_ES[endDate.getMonth()]} ${endDate.getFullYear()}`;
}

function getCurrentInstallmentNumber(inst: CreditInstallment): number {
  const today = new Date();
  const diff = (today.getFullYear() - inst.start_year) * 12 + (today.getMonth() + 1 - inst.start_month);
  return Math.max(1, Math.min(diff + 1, inst.total_installments));
}

function isStillActive(inst: CreditInstallment): boolean {
  const today = new Date();
  const diff = (today.getFullYear() - inst.start_year) * 12 + (today.getMonth() + 1 - inst.start_month);
  return diff < inst.total_installments;
}

interface InstallmentManagerProps {
  user: User;
  installments: CreditInstallment[];
  onClose: () => void;
  onRefresh: () => void;
}

export default function InstallmentManager({ user, installments, onClose, onRefresh }: InstallmentManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await supabase.from('credit_installments').delete().eq('id', id).eq('user_id', user.id);
    onRefresh();
    setDeletingId(null);
  };

  const active = installments.filter(isStillActive);
  const finished = installments.filter(i => !isStillActive(i));

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl max-h-[85vh] flex flex-col"
        >
          <div className="flex justify-between items-center p-8 pb-4">
            <div>
              <h3 className="text-2xl font-bold text-gray-800">Cuotas Tarjeta</h3>
              <p className="text-sm text-gray-500">{active.length} activas</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(true)}
                className="p-3 bg-purple-50 text-purple-600 rounded-full hover:bg-purple-100 transition"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button onClick={onClose} className="p-3 bg-gray-100 rounded-full text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 px-8 pb-8 space-y-3">
            {installments.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
                <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Sin cuotas registradas.</p>
                <button onClick={() => setShowForm(true)} className="mt-4 font-bold text-purple-600 text-sm">
                  + Agregar cuota
                </button>
              </div>
            ) : (
              <>
                {active.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Activas</p>
                    {active.map(inst => {
                      const current = getCurrentInstallmentNumber(inst);
                      return (
                        <motion.div
                          key={inst.id}
                          layout
                          className="bg-purple-50 border border-purple-100 rounded-2xl p-4 flex items-start gap-3"
                        >
                          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <CreditCard className="w-5 h-5 text-purple-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-gray-800 block capitalize leading-tight">{inst.description}</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3 text-purple-400" />
                              <span className="text-xs text-purple-500 font-semibold">
                                Cuota {current}/{inst.total_installments} · hasta {getEndLabel(inst)}
                              </span>
                            </div>
                            <div className="mt-1 text-[10px] text-gray-400">
                              Total {formatCurrency(inst.total_amount)} · {formatCurrency(inst.installment_amount)}/mes
                            </div>
                          </div>
                          <button
                            onClick={() => handleDelete(inst.id)}
                            disabled={deletingId === inst.id}
                            className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {finished.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-black text-gray-300 uppercase tracking-widest px-1 pt-2">Completadas</p>
                    {finished.map(inst => (
                      <div key={inst.id} className="bg-gray-50 border border-gray-100 rounded-2xl p-3 flex items-center gap-3 opacity-60">
                        <div className="flex-1 min-w-0">
                          <span className="font-bold text-gray-500 text-sm capitalize">{inst.description}</span>
                          <div className="text-[10px] text-gray-400">{inst.total_installments} cuotas · {formatCurrency(inst.total_amount)} total</div>
                        </div>
                        <button
                          onClick={() => handleDelete(inst.id)}
                          disabled={deletingId === inst.id}
                          className="p-2 text-red-300 hover:bg-red-50 rounded-xl transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>

      {showForm && (
        <InstallmentForm
          user={user}
          onClose={() => setShowForm(false)}
          onRefresh={() => { onRefresh(); setShowForm(false); }}
        />
      )}
    </>
  );
}
