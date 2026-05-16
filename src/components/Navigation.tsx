import { Home, List, Settings, LogOut, Wallet } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Navigation({
  currentTab,
  onTabChange
}: {
  currentTab: 'home' | 'history' | 'budget' | 'settings';
  onTabChange: (tab: 'home' | 'history' | 'budget' | 'settings') => void
}) {
  const handleLogout = () => supabase.auth.signOut();

  const tabs = [
    { id: 'home' as const,    icon: Home,     label: 'Inicio'    },
    { id: 'history' as const, icon: List,     label: 'Historial' },
    { id: 'budget' as const,  icon: Wallet,   label: 'Gastos'    },
    { id: 'settings' as const,icon: Settings, label: 'Metas'     },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center z-50 rounded-t-3xl shadow-2xl">
      {tabs.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={`flex flex-col items-center gap-0.5 transition-colors ${currentTab === id ? 'text-indigo-600' : 'text-gray-400'}`}
        >
          <Icon className="w-6 h-6" />
          <span className={`text-[10px] font-bold uppercase tracking-wider ${currentTab === id ? 'text-indigo-600' : 'text-gray-400'}`}>
            {label}
          </span>
        </button>
      ))}
      <button onClick={handleLogout} className="flex flex-col items-center gap-0.5 text-gray-400">
        <LogOut className="w-6 h-6" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Salir</span>
      </button>
    </nav>
  );
}
