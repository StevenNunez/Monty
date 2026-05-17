import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { KeyRound, CheckCircle } from 'lucide-react';
import { motion } from 'motion/react';
import InteractiveLogo from './InteractiveLogo';

interface Props {
  onDone: () => void;
}

export default function SetNewPassword({ onDone }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setTimeout(onDone, 2500);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl"
      >
        {success ? (
          <div className="text-center space-y-4 py-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-green-100 p-5">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">¡Contraseña actualizada!</h2>
            <p className="text-gray-500 text-sm">Redirigiendo a tu cuenta...</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-indigo-100 p-4">
                  <KeyRound className="h-8 w-8 text-indigo-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Nueva contraseña</h2>
              <p className="mt-2 text-gray-500 text-sm">Elige una contraseña segura para tu cuenta</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
                <input
                  type="password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  className="block w-full rounded-xl border border-gray-200 bg-gray-50 p-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
                <input
                  type="password"
                  required
                  placeholder="Repite la contraseña"
                  className="block w-full rounded-xl border border-gray-200 bg-gray-50 p-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-indigo-600 py-3 px-4 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Guardando...' : 'Guardar contraseña'}
              </button>
            </form>
          </>
        )}
      </motion.div>

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-6 flex items-center gap-1.5 text-xs text-gray-400"
      >
        <span>Desarrollado por</span>
        <a
          href="https://www.teolabs.app"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:opacity-80 transition-opacity"
        >
          <InteractiveLogo variant="footer-small" className="text-[13px]" />
        </a>
        <span>®</span>
      </motion.footer>
    </div>
  );
}
