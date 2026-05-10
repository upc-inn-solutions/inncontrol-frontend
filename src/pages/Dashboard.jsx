import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { api } from '../lib/axios';
import { 
  BedDouble, ClipboardList, AlertTriangle, 
  TrendingUp, Users, Clock, CheckCircle2, Package
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user } = useAuthStore();
  const { dark } = useThemeStore();
  const isManager = user?.role === 'GERENTE' || user?.role === 'ROLE_GERENTE';
  
  const [stats, setStats] = useState({ 
    freeRooms: 0, occupiedRooms: 0, pendingTasks: 0, 
    inProgressTasks: 0, lowStock: 0, totalRooms: 0, 
    totalTasks: 0, totalItems: 0 
  });
  const [recentTasks, setRecentTasks] = useState([]);
  const [criticalItems, setCriticalItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [roomsRes, tasksRes, invRes] = await Promise.allSettled([
          api.get('/rooms'),
          api.get('/tasks'),
          api.get('/inventory'),
        ]);
        
        const rooms = roomsRes.status === 'fulfilled' ? roomsRes.value.data : [];
        const tasks = tasksRes.status === 'fulfilled' ? tasksRes.value.data : [];
        const inv   = invRes.status === 'fulfilled'   ? invRes.value.data   : [];

        const pending = tasks.filter(t => t.status === 'PENDIENTE');
        const low = inv.filter(i => i.currentQuantity <= i.minQuantity);
        const myTasks = tasks.filter(t => t.assignedTo?.id === user?.id);
        const myPending = myTasks.filter(t => t.status === 'PENDIENTE');
        const myInProgress = myTasks.filter(t => t.status === 'EN_PROGRESO');
        const myCompleted = myTasks.filter(t => t.status === 'COMPLETADA');

        setStats({
          freeRooms:    rooms.filter(r => r.status === 'LIBRE').length,
          occupiedRooms:rooms.filter(r => r.status === 'OCUPADA').length,
          pendingTasks: pending.length,
          inProgressTasks: tasks.filter(t => t.status === 'EN_PROGRESO').length,
          lowStock:     low.length,
          totalRooms:   rooms.length,
          totalTasks:   tasks.length,
          totalItems:   inv.length,
          myPendingCount: myPending.length,
          myInProgressCount: myInProgress.length,
          myCompletedCount: myCompleted.length
        });

        // Set recent activity data
        const priorityWeight = { 'URGENTE': 4, 'ALTA': 3, 'MEDIA': 2, 'BAJA': 1 };
        let sortedPending = isManager ? [...pending] : [...myPending];
        sortedPending.sort((a, b) => (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0));

        setRecentTasks(sortedPending.slice(0, 4));
        setCriticalItems(low.slice(0, 3));

      } catch(e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const firstName = user?.name?.split(' ')[0] || 'Usuario';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  
  // Date formatting
  const today = new Date();
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const formattedDate = today.toLocaleDateString('es-ES', dateOptions);
  
  const cardStyle = dark
    ? { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.06)', text: '#f8fafc', sub: '#94a3b8' }
    : { bg: '#ffffff', border: '#e2e8f0', text: '#0f172a', sub: '#64748b' };

  const occupancyRate = stats.totalRooms > 0 ? Math.round((stats.occupiedRooms / stats.totalRooms) * 100) : 0;

  return (
    <div className="max-w-[1600px] mx-auto px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 1. PREMIUM WELCOME BANNER */}
      <div className={`relative overflow-hidden rounded-[2rem] p-5 md:p-6 mb-6 transition-all ${dark ? 'bg-gradient-to-br from-emerald-900/40 via-slate-900 to-slate-900 border border-emerald-500/20 shadow-[0_0_40px_-15px_rgba(16,185,129,0.3)]' : 'bg-gradient-to-br from-emerald-500 to-teal-700 shadow-xl shadow-emerald-500/20'}`}>
        
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-96 h-96 bg-white/10 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-10 translate-y-1/2 w-64 h-64 bg-emerald-400/20 blur-3xl rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-3 backdrop-blur-md ${dark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/20 text-white border border-white/30'}`}>
              <TrendingUp size={12} />
              Resumen del Día
            </div>
            <h1 className={`text-2xl font-black tracking-tight mb-1 ${dark ? 'text-white' : 'text-white'}`}>
              {greeting}, {firstName}.
            </h1>
            <p className={`text-sm font-medium opacity-90 ${dark ? 'text-slate-300' : 'text-emerald-50'}`}>
              Resumen de operaciones del {formattedDate}.
            </p>
          </div>

          {isManager && (
            <div className={`flex flex-col items-center justify-center p-4 rounded-2xl backdrop-blur-md border ${dark ? 'bg-white/5 border-white/10 shadow-2xl' : 'bg-white/10 border-white/20 text-white shadow-xl'}`}>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Ocupación Actual</span>
              <div className="flex items-baseline gap-1">
                <span className={`text-3xl font-black tracking-tighter ${dark ? 'text-emerald-400' : 'text-white'}`}>{occupancyRate}</span>
                <span className="text-base font-bold opacity-70">%</span>
              </div>
              <div className="w-full h-1 rounded-full mt-2 overflow-hidden" style={{ background: dark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)' }}>
                <div className={`h-full rounded-full transition-all duration-1000 ${dark ? 'bg-emerald-400' : 'bg-white'}`} style={{ width: `${occupancyRate}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. HIGH-DENSITY STAT CARDS */}
      {isManager ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          
          {/* Card 1: Habitaciones Libres */}
          <div className="group relative p-4 rounded-[1.5rem] border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-emerald-500/30 overflow-hidden" style={{ background: cardStyle.bg, borderColor: cardStyle.border, boxShadow: !dark && '0 4px 20px -2px rgba(0,0,0,0.05)' }}>
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <BedDouble size={48} className="text-emerald-500 transform rotate-12" />
            </div>
            <div className="relative z-10">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3 border shadow-sm transition-transform group-hover:scale-110" style={{ background: dark ? 'rgba(16,185,129,0.1)' : '#ecfdf5', borderColor: dark ? 'rgba(16,185,129,0.2)' : '#d1fae5', color: '#10b981' }}>
                <BedDouble size={16} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: cardStyle.sub }}>Habitaciones Libres</p>
              <div className="flex items-end gap-1.5 mb-2.5">
                {loading ? <div className="h-6 w-10 rounded-lg animate-pulse bg-slate-200/50 dark:bg-white/10" /> : <span className="text-2xl font-black tracking-tight leading-none" style={{ color: cardStyle.text }}>{stats.freeRooms}</span>}
                <span className="text-[10px] font-bold mb-0.5" style={{ color: cardStyle.sub }}>/ {stats.totalRooms}</span>
              </div>
              <div className="w-full h-1 rounded-full overflow-hidden bg-slate-100 dark:bg-white/5">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${stats.totalRooms ? (stats.freeRooms/stats.totalRooms)*100 : 0}%` }} />
              </div>
            </div>
          </div>

          {/* Card 2: Habitaciones Ocupadas */}
          <div className="group relative p-4 rounded-[1.5rem] border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-blue-500/30 overflow-hidden" style={{ background: cardStyle.bg, borderColor: cardStyle.border, boxShadow: !dark && '0 4px 20px -2px rgba(0,0,0,0.05)' }}>
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Users size={48} className="text-blue-500 transform -rotate-12" />
            </div>
            <div className="relative z-10">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3 border shadow-sm transition-transform group-hover:scale-110" style={{ background: dark ? 'rgba(59,130,246,0.1)' : '#eff6ff', borderColor: dark ? 'rgba(59,130,246,0.2)' : '#dbeafe', color: '#3b82f6' }}>
                <Users size={16} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: cardStyle.sub }}>Habs. Ocupadas</p>
              <div className="flex items-end gap-1.5 mb-2.5">
                {loading ? <div className="h-6 w-10 rounded-lg animate-pulse bg-slate-200/50 dark:bg-white/10" /> : <span className="text-2xl font-black tracking-tight leading-none" style={{ color: cardStyle.text }}>{stats.occupiedRooms}</span>}
                <span className="text-[10px] font-bold mb-0.5" style={{ color: cardStyle.sub }}>/ {stats.totalRooms}</span>
              </div>
              <div className="w-full h-1 rounded-full overflow-hidden bg-slate-100 dark:bg-white/5">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${occupancyRate}%` }} />
              </div>
            </div>
          </div>

          {/* Card 3: Tareas Pendientes */}
          <div className="group relative p-4 rounded-[1.5rem] border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-amber-500/30 overflow-hidden" style={{ background: cardStyle.bg, borderColor: cardStyle.border, boxShadow: !dark && '0 4px 20px -2px rgba(0,0,0,0.05)' }}>
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <ClipboardList size={48} className="text-amber-500 transform rotate-6" />
            </div>
            <div className="relative z-10">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3 border shadow-sm transition-transform group-hover:scale-110" style={{ background: dark ? 'rgba(245,158,11,0.1)' : '#fffbeb', borderColor: dark ? 'rgba(245,158,11,0.2)' : '#fef3c7', color: '#f59e0b' }}>
                <ClipboardList size={16} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: cardStyle.sub }}>Tareas Pendientes</p>
              <div className="flex items-end gap-1.5 mb-2.5">
                {loading ? <div className="h-6 w-10 rounded-lg animate-pulse bg-slate-200/50 dark:bg-white/10" /> : <span className="text-2xl font-black tracking-tight leading-none" style={{ color: cardStyle.text }}>{stats.pendingTasks}</span>}
                <span className="text-[10px] font-bold mb-0.5" style={{ color: cardStyle.sub }}>atención</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/10">
                  <Clock size={8} /> {stats.inProgressTasks} progreso
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Alertas de Stock */}
          <div className="group relative p-4 rounded-[1.5rem] border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-red-500/30 overflow-hidden" style={{ background: cardStyle.bg, borderColor: cardStyle.border, boxShadow: !dark && '0 4px 20px -2px rgba(0,0,0,0.05)' }}>
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <AlertTriangle size={48} className="text-red-500 transform -rotate-6" />
            </div>
            <div className="relative z-10">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3 border shadow-sm transition-transform group-hover:scale-110" style={{ background: dark ? 'rgba(239,68,68,0.1)' : '#fef2f2', borderColor: dark ? 'rgba(239,68,68,0.2)' : '#fee2e2', color: '#ef4444' }}>
                {stats.lowStock > 0 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} className="text-emerald-500" />}
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: cardStyle.sub }}>Alertas de Stock</p>
              <div className="flex items-end gap-1.5 mb-2.5">
                {loading ? <div className="h-6 w-10 rounded-lg animate-pulse bg-slate-200/50 dark:bg-white/10" /> : <span className="text-2xl font-black tracking-tight leading-none" style={{ color: cardStyle.text }}>{stats.lowStock}</span>}
                <span className="text-[10px] font-bold mb-0.5" style={{ color: cardStyle.sub }}>críticos</span>
              </div>
              {stats.lowStock === 0 && !loading && (
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1">
                  <CheckCircle2 size={10} /> Óptimo
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Employee Stat 1: Tareas de Hoy */}
          <div className="group relative p-5 rounded-[1.5rem] border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl overflow-hidden" style={{ background: cardStyle.bg, borderColor: cardStyle.border }}>
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shadow-inner">
                  <ClipboardList size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-0.5">Mis Pendientes</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black tracking-tighter" style={{ color: cardStyle.text }}>{stats.myPendingCount}</span>
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Tareas</span>
                  </div>
                </div>
             </div>
          </div>

          {/* Employee Stat 2: En Progreso */}
          <div className="group relative p-5 rounded-[1.5rem] border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl overflow-hidden" style={{ background: cardStyle.bg, borderColor: cardStyle.border }}>
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shadow-inner">
                  <Clock size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-0.5">En Curso</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black tracking-tighter" style={{ color: cardStyle.text }}>{stats.myInProgressCount}</span>
                    <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Activas</span>
                  </div>
                </div>
             </div>
          </div>

          {/* Employee Stat 3: Motivación/Insumos */}
          <div className="group relative p-5 rounded-[1.5rem] border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl overflow-hidden" style={{ background: cardStyle.bg, borderColor: cardStyle.border }}>
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-inner">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-0.5">Completadas</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black tracking-tighter" style={{ color: cardStyle.text }}>{stats.myCompletedCount}</span>
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Hoy</span>
                  </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* 3. RECENT ACTIVITY / LISTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Tareas Recientes */}
        <div className="rounded-[1.5rem] border p-5 flex flex-col h-full shadow-sm" style={{ background: cardStyle.bg, borderColor: cardStyle.border }}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <ClipboardList size={16} />
              </div>
              <h2 className="text-base font-black tracking-tight" style={{ color: cardStyle.text }}>Tareas Prioritarias</h2>
            </div>
            <Link to="/tasks" className="text-[9px] font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-600 transition-colors">Ver todas</Link>
          </div>
          
          <div className="space-y-2 flex-1">
            {loading ? (
              [...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-xl animate-pulse bg-slate-100 dark:bg-white/5" />)
            ) : recentTasks.length > 0 ? (
              recentTasks.map(task => (
                <div key={task.id} className="flex items-center justify-between p-3 rounded-xl border transition-all hover:border-amber-500/30 group" style={{ borderColor: dark ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                    <div>
                      <h4 className="text-xs font-bold" style={{ color: cardStyle.text }}>{task.title}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[9px] font-bold" style={{ color: cardStyle.sub }}>
                          {task.room ? `Habitación ${task.room.number}` : 'Área General'}
                        </p>
                        {isManager && task.assignedTo && (
                          <>
                            <span className="text-[8px] opacity-30">•</span>
                            <p className="text-[9px] font-black text-emerald-500 uppercase tracking-tighter">
                              {task.assignedTo.name.split(' ')[0]}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${task.priority === 'URGENTE' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}`}>
                    {task.priority}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full opacity-50 py-8">
                <CheckCircle2 size={32} className="mb-2 text-emerald-500" />
                <p className="text-xs font-bold" style={{ color: cardStyle.sub }}>No hay tareas pendientes</p>
              </div>
            )}
          </div>
        </div>

        {/* Alertas de Inventario */}
        <div className="rounded-[1.5rem] border p-5 flex flex-col h-full shadow-sm" style={{ background: cardStyle.bg, borderColor: cardStyle.border }}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
                <Package size={16} />
              </div>
              <h2 className="text-base font-black tracking-tight" style={{ color: cardStyle.text }}>Insumos Críticos</h2>
            </div>
            <Link to="/inventory" className="text-[9px] font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-600 transition-colors">Abastecer</Link>
          </div>
          
          <div className="space-y-2 flex-1">
            {loading ? (
              [...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-xl animate-pulse bg-slate-100 dark:bg-white/5" />)
            ) : criticalItems.length > 0 ? (
              criticalItems.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border transition-all hover:border-red-500/30 group" style={{ borderColor: dark ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                      <span className="text-base font-black" style={{ color: cardStyle.text }}>{item.name.charAt(0)}</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold" style={{ color: cardStyle.text }}>{item.name}</h4>
                      <p className="text-[9px] font-bold text-red-500 mt-0.5">Solo quedan {item.currentQuantity} uds.</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] font-black uppercase tracking-widest opacity-50 block mb-0.5">Mínimo</span>
                    <span className="text-[11px] font-black" style={{ color: cardStyle.text }}>{item.minQuantity}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full opacity-50 py-8">
                <CheckCircle2 size={32} className="mb-2 text-emerald-500" />
                <p className="text-xs font-bold" style={{ color: cardStyle.sub }}>Inventario en nivel óptimo</p>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
