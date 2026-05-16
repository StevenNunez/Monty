/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import Dashboard from './components/Dashboard';
import Auth from './components/Auth';
import Navigation from './components/Navigation';
import InteractiveLogo from './components/InteractiveLogo';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<'home' | 'history' | 'budget' | 'settings'>('home');

  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        setSession(session);
      } catch (err: any) {
        console.error('Error initializing session:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <div className="text-xl font-medium text-gray-500">Iniciando aplicación...</div>
        </div>
      </div>
    );
  }

  const isConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!isConfigured) {
    return (
      <div className="flex h-screen items-center justify-center bg-red-50 p-6 text-center">
        <div className="max-w-md bg-white p-8 rounded-3xl shadow-xl">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Faltan credenciales</h2>
          <p className="text-gray-600 mb-6">
            Por favor, configura las variables <b>VITE_SUPABASE_URL</b> y <b>VITE_SUPABASE_ANON_KEY</b> en el panel de <b>Secrets</b>.
          </p>
          <div className="text-left bg-gray-100 p-4 rounded-xl text-xs font-mono break-all">
            URL: {import.meta.env.VITE_SUPABASE_URL || 'No configurado'}<br/>
            Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Presente' : 'No configurado'}
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans text-gray-900">
      <Dashboard
        user={session.user}
        activeTab={currentTab}
        onCloseTab={() => setCurrentTab('home')}
      />
      <footer className="flex items-center justify-center gap-1.5 py-3 pb-24 text-xs text-gray-400">
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
      </footer>
      <Navigation currentTab={currentTab} onTabChange={setCurrentTab} />
    </div>
  );
}
