import React, { Fragment, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { X, Plus, Package, ChevronDown, ChevronUp, Save, Trash2, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency, localDateStr, cn } from '../lib/utils';
import { ExpenseGroup, ExpenseGroupItem } from '../types';
import CurrencyInput from './CurrencyInput';
import FormFeedback, { FeedbackState } from './FormFeedback';

interface ExpenseGroupManagerProps {
  user: User;
  onClose: () => void;
  onRefresh: () => void;
}

// ─── Formulario inline para agregar ítem a un grupo ───────────────────────────
function AddItemForm({
  groupId,
  userId,
  onSaved,
  onCancel,
}: {
  groupId: string;
  userId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(localDateStr());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!desc.trim() || Number(amount) <= 0) return;
    setSaving(true);
    setError(null);

    const { error: err } = await supabase.from('expense_group_items').insert({
      group_id: groupId,
      user_id: userId,
      description: desc.trim(),
      amount: Number(amount),
      date,
    });

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    onSaved();
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="mt-3 bg-violet-50 rounded-2xl p-4 space-y-3 border border-violet-100">
        <input
          type="text"
          autoFocus
          placeholder="Descripción (ej: taxi, comida...)"
          className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-violet-200 outline-none transition"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
        />
        <div className="flex gap-2">
          <CurrencyInput
            value={amount}
            onChange={setAmount}
            placeholder="$0"
            className="flex-1 bg-white border-none rounded-xl px-4 py-3 text-sm font-black text-violet-600 text-center focus:ring-2 focus:ring-violet-200 outline-none transition"
          />
          <input
            type="date"
            className="flex-1 bg-white border-none rounded-xl px-3 py-3 text-sm text-gray-500 focus:ring-2 focus:ring-violet-200 outline-none transition"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>
        {error && <p className="text-xs text-red-500 font-bold">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !desc.trim() || Number(amount) <= 0}
            className="flex-1 bg-violet-600 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95 transition"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button
            onClick={onCancel}
            className="px-4 bg-white text-gray-400 font-bold py-3 rounded-xl text-sm border border-gray-100 active:scale-95 transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Formulario inline para editar un ítem existente ──────────────────────────
function EditItemForm({
  item,
  onSaved,
  onCancel,
}: {
  item: ExpenseGroupItem;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [desc, setDesc] = useState(item.description);
  const [amount, setAmount] = useState(String(Math.round(Number(item.amount))));
  const [date, setDate] = useState(item.date || (item.created_at ? item.created_at.split('T')[0] : localDateStr()));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!desc.trim() || Number(amount) <= 0) return;
    setSaving(true);
    setError(null);

    const { error: err } = await supabase
      .from('expense_group_items')
      .update({ description: desc.trim(), amount: Number(amount), date })
      .eq('id', item.id);

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    onSaved();
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setSaving(true);
    const { error: err } = await supabase.from('expense_group_items').delete().eq('id', item.id);
    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }
    onSaved();
  };

  return (
    <div className="bg-violet-50 rounded-2xl p-4 space-y-3 border border-violet-200">
      <input
        type="text"
        autoFocus
        placeholder="Descripción"
        className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-violet-200 outline-none transition"
        value={desc}
        onChange={e => setDesc(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <div className="flex gap-2">
        <CurrencyInput
          value={amount}
          onChange={setAmount}
          placeholder="$0"
          className="flex-1 bg-white border-none rounded-xl px-4 py-3 text-sm font-black text-violet-600 text-center focus:ring-2 focus:ring-violet-200 outline-none transition min-w-0"
        />
        <input
          type="date"
          className="flex-1 bg-white border-none rounded-xl px-3 py-3 text-sm text-gray-500 focus:ring-2 focus:ring-violet-200 outline-none transition min-w-0"
          value={date}
          onChange={e => setDate(e.target.value)}
        />
      </div>
      {error && <p className="text-xs text-red-500 font-bold">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !desc.trim() || Number(amount) <= 0}
          className="flex-1 bg-violet-600 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95 transition"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          onClick={handleDelete}
          disabled={saving}
          className={cn(
            'px-4 py-3 rounded-xl text-sm font-bold transition active:scale-95',
            confirmDelete ? 'bg-red-500 text-white' : 'bg-white text-red-400 border border-red-100'
          )}
          aria-label={confirmDelete ? 'Confirmar eliminación' : 'Eliminar ítem'}
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          onClick={onCancel}
          className="px-4 bg-white text-gray-400 font-bold py-3 rounded-xl text-sm border border-gray-100 active:scale-95 transition"
        >
          Cancelar
        </button>
      </div>
      {confirmDelete && (
        <p className="text-[11px] text-red-500 font-bold text-center">
          Toca el ícono de nuevo para confirmar borrado
        </p>
      )}
    </div>
  );
}

// ─── Tarjeta de un grupo existente ────────────────────────────────────────────
function GroupCard({
  group,
  userId,
  onRefresh,
}: {
  group: ExpenseGroup;
  userId: string;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameValue, setNameValue] = useState(group.name);
  const [renameError, setRenameError] = useState<string | null>(null);

  const items = group.expense_group_items || [];
  const total = items.reduce((s, i) => s + Number(i.amount), 0);

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await supabase.from('expense_groups').delete().eq('id', group.id);
    onRefresh();
  };

  const handleRename = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed) return;
    const { error } = await supabase.from('expense_groups').update({ name: trimmed }).eq('id', group.id);
    if (error) { setRenameError(error.message); return; }
    setRenameError(null);
    setRenaming(false);
    onRefresh();
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Cabecera del grupo */}
      <button
        onClick={() => { setExpanded(v => !v); setAddingItem(false); setEditingItemId(null); setRenaming(false); setConfirmDelete(false); }}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
            <Package className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <p className="font-black text-gray-800 text-sm leading-tight">{group.name}</p>
            <p className="text-[11px] text-gray-400 font-medium">
              {items.length} ítem{items.length !== 1 ? 's' : ''}
              {items.length > 0 && ` · ${formatCurrency(total)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <span className="text-sm font-black text-violet-600">{formatCurrency(total)}</span>
          )}
          {expanded
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />
          }
        </div>
      </button>

      {/* Contenido expandible */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-1 border-t border-gray-50 pt-3">
              {/* Lista de ítems */}
              {items.length > 0 ? (
                <div className="space-y-1.5 mb-3">
                  {items.map(item => (
                    editingItemId === item.id ? (
                      <Fragment key={item.id}>
                        <EditItemForm
                          item={item}
                          onSaved={() => { setEditingItemId(null); onRefresh(); }}
                          onCancel={() => setEditingItemId(null)}
                        />
                      </Fragment>
                    ) : (
                      <div key={item.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-xl">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-700 truncate">{item.description}</p>
                          {item.date && (
                            <p className="text-[10px] text-gray-400">{item.date}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <span className="text-sm font-black text-violet-600">{formatCurrency(Number(item.amount))}</span>
                          <button
                            onClick={() => { setEditingItemId(item.id); setAddingItem(false); setRenaming(false); }}
                            className="p-2 text-gray-300 hover:text-violet-600 active:scale-95 transition"
                            aria-label={`Editar ${item.description}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-2 mb-2">Sin ítems aún</p>
              )}

              {/* Formulario inline para agregar ítem */}
              <AnimatePresence>
                {addingItem && (
                  <AddItemForm
                    groupId={group.id}
                    userId={userId}
                    onSaved={() => { setAddingItem(false); onRefresh(); }}
                    onCancel={() => setAddingItem(false)}
                  />
                )}
              </AnimatePresence>

              {/* Renombrar grupo */}
              {renaming && (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Nombre del grupo"
                      className="flex-1 min-w-0 bg-violet-50 border border-violet-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-violet-200 outline-none transition"
                      value={nameValue}
                      onChange={e => setNameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename();
                        if (e.key === 'Escape') { setRenaming(false); setNameValue(group.name); }
                      }}
                    />
                    <button
                      onClick={handleRename}
                      disabled={!nameValue.trim()}
                      className="px-3 py-2.5 bg-violet-600 text-white rounded-xl active:scale-95 transition disabled:opacity-50"
                      aria-label="Guardar nombre"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setRenaming(false); setNameValue(group.name); setRenameError(null); }}
                      className="px-3 py-2.5 bg-gray-100 text-gray-400 rounded-xl active:scale-95 transition"
                      aria-label="Cancelar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {renameError && <p className="text-xs text-red-500 font-bold">{renameError}</p>}
                </div>
              )}

              {/* Botones de acción */}
              {!addingItem && !renaming && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { setAddingItem(true); setEditingItemId(null); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-violet-50 text-violet-600 font-bold rounded-xl text-sm hover:bg-violet-100 active:scale-95 transition border border-violet-100"
                  >
                    <Plus className="w-4 h-4" /> Agregar gasto
                  </button>
                  <button
                    onClick={() => { setRenaming(true); setNameValue(group.name); setEditingItemId(null); setConfirmDelete(false); }}
                    className="px-3 py-2.5 rounded-xl text-sm font-bold bg-gray-100 text-gray-400 hover:bg-gray-200 transition active:scale-95"
                    aria-label="Renombrar grupo"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleDelete}
                    className={cn(
                      'px-3 py-2.5 rounded-xl text-sm font-bold transition active:scale-95',
                      confirmDelete
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    )}
                    aria-label="Eliminar grupo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
              {confirmDelete && !addingItem && !renaming && (
                <p className="text-[11px] text-red-500 font-bold text-center">
                  Toca el ícono de nuevo para confirmar borrado
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Formulario para crear grupo nuevo ────────────────────────────────────────
function NewGroupForm({
  user,
  onSaved,
  onCancel,
}: {
  user: User;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    const { error } = await supabase
      .from('expense_groups')
      .insert({ user_id: user.id, name: name.trim() });

    if (error) {
      setFeedback({ type: 'error', text: error.message });
      setLoading(false);
      return;
    }
    setFeedback({ type: 'success', text: '¡Grupo creado!' });
    setTimeout(() => onSaved(), 1000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-violet-50 rounded-2xl p-5 border-2 border-dashed border-violet-200 space-y-4"
    >
      <p className="text-xs font-bold text-violet-500 uppercase tracking-widest">Nuevo grupo</p>
      <input
        type="text"
        autoFocus
        placeholder="Ej: Viaje a Monterrey, Navidad..."
        className="w-full bg-white border-none rounded-2xl p-4 font-bold text-gray-700 focus:ring-4 focus:ring-violet-100 outline-none transition text-base"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleCreate()}
      />
      <FormFeedback feedback={feedback} />
      <div className="flex gap-2">
        <button
          onClick={handleCreate}
          disabled={loading || !name.trim()}
          className="flex-1 bg-violet-600 text-white font-bold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95 transition shadow-lg"
        >
          <Save className="w-4 h-4" /> Crear grupo
        </button>
        <button
          onClick={onCancel}
          className="px-5 bg-white text-gray-400 font-bold py-3.5 rounded-2xl text-sm border border-gray-100 active:scale-95 transition"
        >
          Cancelar
        </button>
      </div>
    </motion.div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────
export default function ExpenseGroupManager({ user, onClose, onRefresh }: ExpenseGroupManagerProps) {
  const [groups, setGroups] = useState<ExpenseGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);

  const fetchGroups = async () => {
    const { data } = await supabase
      .from('expense_groups')
      .select('*, expense_group_items(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setGroups(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchGroups(); }, [user.id]);

  const handleRefresh = () => {
    fetchGroups();
    onRefresh();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-8 pb-5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-100 rounded-2xl flex items-center justify-center">
              <Package className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-800">Grupos</h3>
              <p className="text-sm text-gray-400">
                {groups.length === 0 ? 'Sin grupos' : `${groups.length} grupo${groups.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!showNewForm && (
              <button
                onClick={() => setShowNewForm(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-violet-600 text-white font-bold rounded-2xl text-sm active:scale-95 transition shadow-lg shadow-violet-200"
              >
                <Plus className="w-4 h-4" /> Nuevo
              </button>
            )}
            <button onClick={onClose} className="p-3 bg-gray-100 rounded-full text-gray-400 hover:bg-gray-200 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenido scrolleable */}
        <div className="overflow-y-auto flex-1 px-8 pb-8 space-y-3">

          {/* Formulario nuevo grupo */}
          <AnimatePresence>
            {showNewForm && (
              <NewGroupForm
                user={user}
                onSaved={() => { setShowNewForm(false); handleRefresh(); }}
                onCancel={() => setShowNewForm(false)}
              />
            )}
          </AnimatePresence>

          {/* Estado de carga */}
          {loading && (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
            </div>
          )}

          {/* Estado vacío */}
          {!loading && groups.length === 0 && !showNewForm && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-10"
            >
              <div className="w-16 h-16 bg-violet-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-violet-300" />
              </div>
              <p className="font-bold text-gray-500 mb-1">Sin grupos aún</p>
              <p className="text-sm text-gray-400 mb-5">Agrupa gastos de un viaje, evento, o proyecto</p>
              <button
                onClick={() => setShowNewForm(true)}
                className="bg-violet-600 text-white font-bold py-3 px-6 rounded-2xl text-sm active:scale-95 transition"
              >
                Crear primer grupo
              </button>
            </motion.div>
          )}

          {/* Lista de grupos */}
          {!loading && groups.map(group => (
            <Fragment key={group.id}>
              <GroupCard
                group={group}
                userId={user.id}
                onRefresh={handleRefresh}
              />
            </Fragment>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
