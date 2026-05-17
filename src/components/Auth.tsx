import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import InteractiveLogo from './InteractiveLogo';

const APP_URL = 'https://monty.teolabs.app';

function CheckEmailScreen({ email, onBack, title, description }: {
  email: string;
  onBack: () => void;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-6 rounded-3xl bg-white p-8 shadow-xl text-center"
      >
        <div className="flex justify-center">
          <div className="rounded-full bg-indigo-100 p-5">
            <Mail className="h-10 w-10 text-indigo-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
          <p className="font-semibold text-indigo-600 text-sm break-all">{email}</p>
        </div>

        <div className="rounded-2xl bg-indigo-50 p-4 text-left space-y-2">
          <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">¿Qué hacer?</p>
          <ol className="text-sm text-indigo-900 space-y-1 list-decimal list-inside">
            <li>Abre tu correo electrónico</li>
            <li>Busca el correo de <span className="font-medium">Monty</span></li>
            <li>Haz clic en el botón del correo</li>
            <li>¡Listo! Serás redirigido automáticamente</li>
          </ol>
        </div>

        <p className="text-xs text-gray-400">
          ¿No lo ves? Revisa tu carpeta de spam o correo no deseado.
        </p>

        <button
          onClick={onBack}
          className="flex items-center justify-center gap-2 w-full text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio de sesión
        </button>
      </motion.div>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
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
  );
}

type Mode = 'login' | 'signup' | 'forgot';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<Mode>('login');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [checkEmail, setCheckEmail] = useState<'verify' | 'reset' | null>(null);

  const resetForm = (nextMode: Mode) => {
    setMode(nextMode);
    setMessage(null);
    setPassword('');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: APP_URL }
      });
      if (error) setMessage({ type: 'error', text: error.message });
      else setCheckEmail('verify');

    } else if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${APP_URL}?reset=true`
      });
      if (error) setMessage({ type: 'error', text: error.message });
      else setCheckEmail('reset');

    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage({ type: 'error', text: error.message });
    }

    setLoading(false);
  };

  if (checkEmail === 'verify') {
    return (
      <CheckEmailScreen
        email={email}
        title="Revisa tu correo"
        description="Te enviamos un enlace de verificación a:"
        onBack={() => { setCheckEmail(null); resetForm('login'); }}
      />
    );
  }

  if (checkEmail === 'reset') {
    return (
      <CheckEmailScreen
        email={email}
        title="Correo enviado"
        description="Te enviamos el enlace para restablecer tu contraseña a:"
        onBack={() => { setCheckEmail(null); resetForm('login'); }}
      />
    );
  }

  const isForgot = mode === 'forgot';
  const isSignUp = mode === 'signup';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8 rounded-3xl bg-white p-8 shadow-xl"
      >
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">Monty</h1>
          <p className="mt-2 text-gray-500">
            {isForgot ? 'Restablece tu contraseña' : 'Controla tus ingresos diarios'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="mt-8 space-y-6">
          <div className="rounded-2xl space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                required
                className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 p-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {!isForgot && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Contraseña</label>
                <input
                  type="password"
                  required
                  className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50 p-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
          </div>

          {mode === 'login' && (
            <div className="text-right -mt-2">
              <button
                type="button"
                onClick={() => resetForm('forgot')}
                className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group relative flex w-full justify-center rounded-xl bg-indigo-600 py-3 px-4 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading
              ? 'Procesando...'
              : isForgot
                ? 'Enviar enlace'
                : isSignUp
                  ? 'Registrarse'
                  : 'Iniciar Sesión'}
          </button>
        </form>

        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={cn(
                "p-3 rounded-xl text-sm",
                message.type === 'error' ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
              )}
            >
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center space-y-2">
          {isForgot ? (
            <button
              onClick={() => resetForm('login')}
              className="flex items-center justify-center gap-2 w-full text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al inicio de sesión
            </button>
          ) : (
            <button
              onClick={() => resetForm(isSignUp ? 'login' : 'signup')}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
            </button>
          )}
        </div>
      </motion.div>

      <Footer />
    </div>
  );
}
