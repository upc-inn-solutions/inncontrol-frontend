import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { 
  LayoutDashboard, BedDouble, ClipboardList, 
  Package, MessageSquare, LogOut, User,
  Sun, Moon, Hotel, Settings, Users, Menu, X, Calendar
} from 'lucide-react';
import { useState, useEffect } from 'react';
import Chatbot from './Chatbot';
import { api } from '../lib/axios';

const NAV = [
  { name: 'Dashboard',    href: '/dashboard', icon: LayoutDashboard },
  { name: 'Habitaciones', href: '/rooms',      icon: BedDouble },
  { name: 'Tareas',       href: '/tasks',      icon: ClipboardList },
  { name: 'Inventario',   href: '/inventory',  icon: Package },
  { name: 'Equipo',       href: '/employees',  icon: Users,      adminOnly: true },
  { name: 'Mensajes',     href: '/messages',   icon: MessageSquare },
  { name: 'Ajustes',      href: '/settings',   icon: Settings },
];

export default function Layout({ children }) {
  const { user, logout }  = useAuthStore();
  const { dark, toggleTheme } = useThemeStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const isManager = user?.role === 'GERENTE' || user?.role === 'ROLE_GERENTE';

  // Filter navigation based on role
  const filteredNav = NAV.filter(item => !item.adminOnly || isManager);

  const [counts, setCounts] = useState({ tasks: 0, messages: 0 });

  // Actualizar el tiempo de última visita a Tareas
  useEffect(() => {
    if (user?.id) {
      if (location.pathname.startsWith('/tasks')) {
        localStorage.setItem(`lastVisitedTasks_${user.id}`, Date.now().toString());
        setCounts(prev => ({ ...prev, tasks: 0 }));
      } else if (location.pathname.startsWith('/messages')) {
        localStorage.setItem(`lastVisitedMessages_${user.id}`, Date.now().toString());
        setCounts(prev => ({ ...prev, messages: 0 }));
      }
    }
  }, [location.pathname, user?.id]);

  useEffect(() => {
    if (!user) return;
    const fetchCounts = async () => {
      if (!user) return;
      try {
        const lastVisitedTasks = parseInt(localStorage.getItem(`lastVisitedTasks_${user.id}`) || '0');
        const lastVisitedMessages = parseInt(localStorage.getItem(`lastVisitedMessages_${user.id}`) || '0');
        const res = await api.get(`/messages/unread-count?userId=${user.id}&lastVisitedTasks=${lastVisitedTasks}&lastVisitedMessages=${lastVisitedMessages}`);
        
        const { tasks: tasksCount, messages: messagesCount } = res.data;
        
        if (location.pathname.startsWith('/tasks')) {
          setCounts(prev => ({ ...prev, messages: messagesCount, tasks: 0 }));
        } else if (location.pathname.startsWith('/messages')) {
          setCounts(prev => ({ ...prev, messages: 0, tasks: tasksCount }));
        } else {
          setCounts({ tasks: tasksCount, messages: messagesCount });
        }
      } catch (e) { console.error(e); }
    };
    
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, [user, location.pathname]);

  // ── tokens
  const sidebar = dark
    ? { bg: '#0d1f14', border: 'rgba(16,185,129,0.12)', text: '#94a3b8', activeText: '#fff', activeBg: 'rgba(16,185,129,0.15)', activeBorder: '#10b981', hover: 'rgba(255,255,255,0.05)' }
    : { bg: '#fff',   border: 'rgba(0,0,0,0.07)',       text: '#64748b', activeText: '#059669', activeBg: 'rgba(16,185,129,0.08)', activeBorder: '#10b981', hover: 'rgba(0,0,0,0.04)' };

  const header = dark
    ? { bg: 'rgba(13,31,20,0.95)', border: 'rgba(16,185,129,0.1)', text: '#f1f5f9' }
    : { bg: 'rgba(255,255,255,0.95)', border: 'rgba(0,0,0,0.07)', text: '#0f172a' };

  const main = dark ? '#0a0f1a' : '#f0fdf4';

  return (
    <div className="flex min-h-screen" style={{ background: main, transition: 'background 0.3s' }}>

      {/* Overlay para móvil */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside className={`fixed flex w-64 flex-col h-screen z-[60] transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        style={{ background: sidebar.bg, borderRight: `1px solid ${sidebar.border}` }}>

        {/* Logo */}
        <div className="h-16 flex items-center px-5 gap-3"
          style={{ borderBottom: `1px solid ${sidebar.border}` }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <Hotel size={18} className="text-emerald-400" />
          </div>
          <span className="text-lg font-black tracking-tight" style={{ color: dark ? '#fff' : '#0f172a' }}>
            InnControl
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          {filteredNav.map(({ name, href, icon: Icon }) => {
            const active = location.pathname.startsWith(href);
            return (
              <Link key={href} to={href}
                onClick={() => setIsSidebarOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 group"
                style={{
                  background: active ? sidebar.activeBg : 'transparent',
                  color: active ? sidebar.activeText : sidebar.text,
                }}
              >
                <Icon size={18} style={{ color: active ? '#10b981' : sidebar.text }} />
                <span className="flex-1">{name}</span>
                {((name === 'Tareas' && counts.tasks > 0 && !active) || 
                  (name === 'Mensajes' && counts.messages > 0 && !active)) && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white shadow-lg shadow-red-500/30">
                    {name === 'Tareas' ? counts.tasks : counts.messages}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: User + Logout */}
        <div className="p-4 space-y-3" style={{ borderTop: `1px solid ${sidebar.border}` }}>

          {/* User info */}
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border overflow-hidden"
              style={{ background: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.25)' }}>
              {user?.photo ? (
                <img src={user.photo} alt="User" className="w-full h-full object-cover" />
              ) : (
                <User size={18} className="text-emerald-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: dark ? '#f1f5f9' : '#0f172a' }}>
                {user?.name || 'Usuario'}
              </p>
              <p className="text-[10px] font-black uppercase tracking-tighter" style={{ color: '#10b981' }}>
                {user?.role?.replace('ROLE_', '') || 'GERENTE'}
              </p>
            </div>
          </div>

          {/* Logout */}
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 text-red-400 hover:bg-red-500/10">
            <LogOut size={17} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* ── MAIN AREA ── */}
      <div className="flex-1 flex flex-col min-h-screen md:pl-64 relative">

        {/* Top header */}
        <header className="h-16 flex items-center justify-between px-4 md:px-8 sticky top-0 z-40"
          style={{ background: header.bg, borderBottom: `1px solid ${header.border}`,
            backdropFilter: 'blur(12px)', transition: 'background 0.3s' }}>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl text-emerald-500 hover:bg-emerald-500/10 transition-all"
            >
              <Menu size={24} />
            </button>
            <div className="hidden md:block">
            </div>
          </div>

          <button onClick={toggleTheme}
            className="w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 active:scale-95"
            style={{ 
              background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
              color: dark ? '#94a3b8' : '#64748b' 
            }}
            title={dark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}>
            {dark ? <Sun size={18} className="text-yellow-400" /> : <Moon size={18} className="text-indigo-500" />}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 lg:p-8" style={{ transition: 'background 0.3s' }}>
          <div style={{ color: dark ? '#f1f5f9' : '#0f172a' }}>
            {children}
          </div>
        </main>
      </div>

      {location.pathname !== '/messages' && <Chatbot />}
    </div>
  );
}
