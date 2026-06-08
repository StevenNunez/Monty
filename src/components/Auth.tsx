import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import InteractiveLogo from './InteractiveLogo';

const APP_URL = 'https://monty.teolabs.app';

function BackgroundBlobs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute rounded-full bg-indigo-600/30 blur-3xl"
        style={{ width: 500, height: 500, top: '-15%', left: '-15%' }}
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute rounded-full bg-violet-600/20 blur-3xl"
        style={{ width: 420, height: 420, bottom: '0%', right: '-10%' }}
        animate={{ x: [0, -30, 0], y: [0, -40, 0] }}
        transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />
      <motion.div
        className="absolute rounded-full bg-emerald-600/15 blur-3xl"
        style={{ width: 300, height: 300, top: '55%', left: '35%' }}
        animate={{ x: [0, 20, -15, 0], y: [0, -25, 15, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
      />
    </div>
  );
}

function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6 }}
      className="relative z-10 mt-6 flex items-center gap-1.5 text-xs text-white/30"
    >
      <span>Desarrollado por</span>
      <a href="https://www.teolabs.app" target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity">
        <InteractiveLogo variant="footer-small" className="text-[13px]" />
      </a>
      <span>®</span>
    </motion.footer>
  );
}

function CheckEmailScreen({ email, onBack, title, description }: {
  email: string;
  onBack: () => void;
  title: string;
  description: string;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-4 bg-gray-950">
      <BackgroundBlobs />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="rounded-3xl bg-white/[0.07] backdrop-blur-2xl border border-white/10 p-8 text-center space-y-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="flex justify-center"
          >
            <div className="rounded-full bg-indigo-500/20 border border-indigo-400/30 p-5">
              <Mail className="h-8 w-8 text-indigo-400" />
            </div>
          </motion.div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <p className="text-white/50 text-sm">{description}</p>
            <p className="font-semibold text-indigo-400 text-sm break-all">{email}</p>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-left space-y-2">
            <p className="text-xs font-semibold text-white/30 uppercase tracking-widest">¿Qué hacer?</p>
            <ol className="text-sm text-white/60 space-y-1.5 list-decimal list-inside">
              <li>Abre tu correo electrónico</li>
              <li>Busca el correo de <span className="text-white font-medium">Monty</span></li>
              <li>Haz clic en el enlace del correo</li>
              <li>¡Listo! Serás redirigido automáticamente</li>
            </ol>
          </div>

          <p className="text-xs text-white/25">¿No lo ves? Revisa tu carpeta de spam.</p>

          <button
            onClick={onBack}
            className="flex items-center justify-center gap-2 w-full text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio de sesión
          </button>
        </div>
      </motion.div>
      <Footer />
    </div>
  );
}

type Mode = 'login' | 'signup' | 'forgot';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<Mode>('login');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [checkEmail, setCheckEmail] = useState<'verify' | 'reset' | null>(null);

  const resetForm = (nextMode: Mode) => {
    setMode(nextMode);
    setMessage(null);
    setPassword('');
    setShowPassword(false);
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
    <div className="relative flex min-h-screen flex-col items-center justify-center p-4 bg-gray-950">
      <BackgroundBlobs />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Branding */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', duration: 0.6 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30 mb-4"
          >
            <span className="text-2xl font-black text-white">M</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold text-white tracking-tight"
          >
            Monty
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-1 text-sm text-white/40"
          >
            {isForgot ? 'Restablece tu contraseña' : 'Controla tus ingresos diarios'}
          </motion.p>
        </div>

        {/* Card */}
        <motion.div
          layout
          className="rounded-3xl bg-white/[0.07] backdrop-blur-2xl border border-white/10 p-6 shadow-2xl"
        >
          {/* Tabs login/signup */}
          <AnimatePresence>
            {!isForgot && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="relative flex rounded-2xl bg-white/5 p-1 mb-6 overflow-hidden"
              >
                {(['login', 'signup'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => resetForm(m)}
                    className="relative z-10 flex-1 py-2 text-sm font-medium rounded-xl"
                  >
                    {mode === m && (
                      <motion.div
                        layoutId="tab-pill"
                        className="absolute inset-0 rounded-xl bg-white/10"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                      />
                    )}
                    <span className={cn(
                      "relative z-10 transition-colors",
                      mode === m ? "text-white" : "text-white/35 hover:text-white/60"
                    )}>
                      {m === 'login' ? 'Iniciar sesión' : 'Registrarse'}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleAuth} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/35 uppercase tracking-widest">
                Correo
              </label>
              <input
                type="email"
                required
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-white/20 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/25 transition-all"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Password */}
            <AnimatePresence>
              {!isForgot && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-1.5 overflow-hidden"
                >
                  <label className="text-xs font-semibold text-white/35 uppercase tracking-widest">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required={!isForgot}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 pr-11 text-white placeholder-white/20 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/25 transition-all"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
                    >
                      {showPassword
                        ? <EyeOff className="h-4 w-4" />
                        : <Eye className="h-4 w-4" />
                      }
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Forgot password link */}
            {mode === 'login' && (
              <div className="text-right -mt-1">
                <button
                  type="button"
                  onClick={() => resetForm('forgot')}
                  className="text-xs text-indigo-400/60 hover:text-indigo-400 transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="relative w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 hover:from-indigo-500 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-50 transition-all duration-200"
            >
              <span className={cn("flex items-center justify-center gap-2", loading && "opacity-0")}>
                {isForgot ? 'Enviar enlace' : isSignUp ? 'Crear cuenta' : 'Entrar'}
              </span>
              {loading && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </span>
              )}
            </button>
          </form>

          {/* Message */}
          <AnimatePresence>
            {message && (
              <motion.div
                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                animate={{ height: 'auto', opacity: 1, marginTop: 12 }}
                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                className={cn(
                  "rounded-xl px-4 py-3 text-sm overflow-hidden",
                  message.type === 'error'
                    ? "bg-red-500/10 border border-red-500/20 text-red-400"
                    : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                )}
              >
                {message.text}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Back from forgot */}
          <AnimatePresence>
            {isForgot && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-4"
              >
                <button
                  type="button"
                  onClick={() => resetForm('login')}
                  className="flex items-center justify-center gap-2 w-full text-sm text-white/35 hover:text-white/65 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver al inicio de sesión
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      <Footer />
    </div>
  );
}
