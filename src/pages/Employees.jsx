import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/axios';
import { 
  Loader2, Plus, User as UserIcon, X, Save, AlertTriangle, 
  Trash2, Edit3, Search, Shield, ShieldCheck, Mail, Key,
  CheckCircle2, Users, Briefcase, Camera
} from 'lucide-react';
import { useThemeStore } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';
import { compressImage } from '../lib/imageUtils';

const ROLES = {
  GERENTE: { label: 'Gerente', icon: <ShieldCheck size={18} />, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  TRABAJADOR: { label: 'Empleado', icon: <Briefcase size={18} />, color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
};

export default function Employees() {
  const { dark } = useThemeStore();
  const { user: currentUser } = useAuthStore();
  const isManager = currentUser?.role === 'GERENTE' || currentUser?.role === 'ROLE_GERENTE';
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);

  if (!isManager) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center px-4">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-6 animate-bounce">
          <ShieldCheck size={40} />
        </div>
        <h1 className="text-2xl font-black mb-2" style={{ color: dark ? '#fff' : '#0f172a' }}>Acceso Restringido</h1>
        <p className="text-sm opacity-60 max-w-md mx-auto leading-relaxed" style={{ color: dark ? '#94a3b8' : '#64748b' }}>
          Lo sentimos, solo los administradores con el rol de <strong>Gerente</strong> pueden gestionar el personal.
        </p>
      </div>
    );
  }
  const [successMessage, setSuccessMessage] = useState('');
  
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'TRABAJADOR',
    photo: null
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/users');
      // Filter out the system assistant
      const filtered = response.data.filter(emp => emp.email !== 'system@inncontrol.com');
      setEmployees(filtered);
    } catch (error) {
      console.error("Error fetching employees", error);
    } finally {
      setIsLoading(false);
    }
  };

  const normalizeRole = (roleStr) => {
    if (!roleStr) return 'TRABAJADOR';
    const r = roleStr.toUpperCase();
    if (r.includes('GERENTE')) return 'GERENTE';
    return 'TRABAJADOR';
  };

  const handleOpenModal = (emp = null) => {
    if (emp) {
      setEditingEmployee(emp);
      setFormData({
        name: emp.name,
        email: emp.email,
        password: '', 
        role: normalizeRole(emp.role),
        photo: emp.photo || null
      });
    } else {
      setEditingEmployee(null);
      setFormData({ name: '', email: '', password: '', role: 'TRABAJADOR', photo: null });
    }
    setIsModalOpen(true);
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const compressed = await compressImage(file, 400, 400, 0.6);
        setFormData(prev => ({ ...prev, photo: compressed }));
      } catch (err) {
        console.error("Error compressing image", err);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        role: formData.role === 'GERENTE' ? 'ROLE_GERENTE' : 'ROLE_EMPLEADO'
      };

      if (editingEmployee) {
        await api.put(`/users/${editingEmployee.id}`, payload);
        setSuccessMessage('¡Miembro actualizado con éxito!');
      } else {
        await api.post('/users', payload);
        setSuccessMessage('¡Nuevo miembro registrado correctamente!');
      }
      setIsModalOpen(false);
      fetchEmployees();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) { console.error(error); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/users/${employeeToDelete.id}`);
      setIsDeleteModalOpen(false);
      fetchEmployees();
    } catch (error) { console.error(error); }
  };

  const cardStyle = dark 
    ? { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', text: '#f1f5f9', sub: '#94a3b8' }
    : { bg: '#fff', border: '#e2e8f0', text: '#0f172a', sub: '#64748b' };

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(search.toLowerCase()) ||
    emp.email.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: employees.length,
    managers: employees.filter(e => normalizeRole(e.role) === 'GERENTE').length,
    workers: employees.filter(e => normalizeRole(e.role) === 'TRABAJADOR').length
  };

  return (
    <div className="max-w-[1600px] mx-auto pb-20 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: cardStyle.text }}>Gestión de Equipo</h1>
          <p className="text-sm mt-1" style={{ color: cardStyle.sub }}>Administra el personal y controla los accesos del hotel.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex p-1 rounded-xl border" style={{ background: dark ? 'rgba(255,255,255,0.03)' : '#f8fafc', borderColor: cardStyle.border }}>
            <div className="px-3 py-1 text-center border-r border-white/5 last:border-0 flex flex-col items-center">
              <span className="text-lg font-black leading-none" style={{ color: cardStyle.text }}>{stats.total}</span>
              <span className="text-[7px] font-black uppercase tracking-widest text-slate-500 mt-1.5">Total</span>
            </div>
            <div className="px-3 py-1 text-center border-r border-white/5 last:border-0 flex flex-col items-center">
              <span className="text-lg font-black leading-none text-blue-500">{stats.managers}</span>
              <span className="text-[7px] font-black uppercase tracking-widest text-blue-500/70 mt-1.5">Gerentes</span>
            </div>
            <div className="px-3 py-1 text-center flex flex-col items-center">
              <span className="text-lg font-black leading-none text-emerald-500">{stats.workers}</span>
              <span className="text-[7px] font-black uppercase tracking-widest text-emerald-500/70 mt-1.5">Empleados</span>
            </div>
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-3 bg-emerald-500 hover:bg-emerald-600 text-white px-7 py-4 rounded-2xl font-black text-xs tracking-wide transition-all active:scale-95 shadow-lg shadow-emerald-500/25"
          >
            <Plus size={18} />
            NUEVO MIEMBRO
          </button>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="relative w-full max-w-md mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text" 
          placeholder="Buscar por nombre o correo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`w-full pl-12 pr-4 py-3.5 rounded-2xl text-sm font-bold focus:outline-none transition-all ${dark ? 'bg-white/5 border border-white/10 text-white' : 'bg-white border border-gray-200 text-slate-900 shadow-sm'}`}
        />
      </div>

      {/* EMPLOYEES GRID */}
      {isLoading ? (
        <div className="flex justify-center items-center h-96">
          <Loader2 className="animate-spin text-emerald-500" size={48} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredEmployees.map(emp => {
            const normRole = normalizeRole(emp.role);
            const role = ROLES[normRole] || ROLES.TRABAJADOR;
            const isMe = emp.id === currentUser?.id;
            
            return (
              <div key={emp.id} className="group relative rounded-2xl px-5 pt-5 pb-3 transition-all duration-300 hover:-translate-y-1 border shadow-sm hover:shadow-md"
                style={{ background: cardStyle.bg, borderColor: cardStyle.border }}>
                
                <div className="flex justify-between items-start mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-slate-500/10 text-slate-500 border border-slate-500/10 overflow-hidden`}>
                    {emp.photo ? (
                      <img src={emp.photo} alt={emp.name} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={24} />
                    )}
                  </div>
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => handleOpenModal(emp)} className="p-2 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all"><Edit3 size={14} /></button>
                    {!isMe && (
                      <button onClick={() => { setEmployeeToDelete(emp); setIsDeleteModalOpen(true); }} className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>

                <div className="mt-4 mb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${role.bg} ${role.color}`}>
                      {role.label}
                    </span>
                    {isMe && <span className="text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/10">Tú</span>}
                  </div>
                  <h3 className="text-base font-bold tracking-tight truncate mt-2" style={{ color: cardStyle.text }}>{emp.name}</h3>
                  <div className="flex items-center gap-2 text-[10px] font-bold truncate mt-1" style={{ color: cardStyle.sub }}>
                    <Mail size={12} className="text-emerald-500/50 shrink-0" />
                    {emp.email}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL NUEVO / EDITAR MIEMBRO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl border border-white/10 overflow-hidden" style={{ background: dark ? '#0a1510' : '#fff' }}>
            
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  {editingEmployee ? <Edit3 size={24} /> : <Plus size={24} />}
                </div>
                <h2 className="text-xl font-black tracking-tight" style={{ color: cardStyle.text }}>
                  {editingEmployee ? 'Editar Miembro' : 'Nuevo Miembro'}
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl hover:bg-red-500/10 text-red-400 transition-all"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex flex-col items-center mb-6">
                <div className="relative group">
                  <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center border-2 border-emerald-500/20 overflow-hidden shadow-inner">
                    {formData.photo ? (
                      <img src={formData.photo} alt="Perfil" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={32} className="text-emerald-500" />
                    )}
                  </div>
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current.click()}
                    className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1.5 rounded-lg shadow-lg hover:scale-110 transition-transform z-10"
                  >
                    <Camera size={14} />
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoChange} />
                </div>
                <p className="text-[8px] font-black uppercase tracking-widest text-emerald-500/50 mt-2">Foto de Perfil</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest mb-2 text-emerald-500">Nombre Completo</label>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className={`w-full border rounded-xl px-5 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all ${dark ? 'bg-white/5 border-white/10 text-white placeholder:text-gray-600' : 'bg-gray-50 border-gray-200 text-gray-900'}`} placeholder="Ej: Juan Pérez" />
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest mb-2 text-emerald-500">Correo Electrónico (Login)</label>
                  <input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className={`w-full border rounded-xl px-5 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all ${dark ? 'bg-white/5 border-white/10 text-white placeholder:text-gray-600' : 'bg-gray-50 border-gray-200 text-gray-900'}`} placeholder="ejemplo@hotel.com" />
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest mb-2 text-emerald-500">{editingEmployee ? 'Nueva Contraseña (dejar en blanco para no cambiar)' : 'Contraseña'}</label>
                  <input type="password" required={!editingEmployee} value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className={`w-full border rounded-xl px-5 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all ${dark ? 'bg-white/5 border-white/10 text-white placeholder:text-gray-600' : 'bg-gray-50 border-gray-200 text-gray-900'}`} placeholder="••••••••" />
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest mb-2 text-emerald-500">Rol en la Empresa</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(ROLES).map(([key, role]) => (
                      <button key={key} type="button" onClick={() => setFormData({...formData, role: key})}
                        className={`flex items-center justify-center gap-2 px-4 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                          formData.role === key 
                            ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20' 
                            : (dark ? 'bg-white/5 border-white/10 text-slate-400 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100')
                        }`}>
                        {role.icon} {role.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-5 rounded-2xl font-black text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/25 mt-4">
                <Save size={18} /> {editingEmployee ? 'Actualizar Miembro' : 'Registrar en el Equipo'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ELIMINAR */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsDeleteModalOpen(false)} />
          <div className="relative w-full max-sm rounded-[2.5rem] p-8 shadow-2xl border border-white/5" style={{ background: dark ? '#0f172a' : '#fff' }}>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-6"><AlertTriangle size={32} /></div>
              <h2 className="text-xl font-black mb-2" style={{ color: cardStyle.text }}>¿Dar de baja?</h2>
              <p className="text-sm mb-8" style={{ color: cardStyle.sub }}>Esta acción eliminará permanentemente a <strong>{employeeToDelete?.name}</strong>. Ya no podrá acceder al sistema ni realizar tareas.</p>
              <div className="grid grid-cols-2 gap-3 w-full">
                <button onClick={() => setIsDeleteModalOpen(false)} className={`py-4 rounded-2xl font-bold text-xs uppercase ${dark ? 'bg-white/5 text-white' : 'bg-gray-100 text-gray-600'}`}>Cancelar</button>
                <button onClick={handleDelete} className="bg-red-500 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-lg shadow-red-500/20">Dar de Baja</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST MENSAJE DE ÉXITO */}
      {successMessage && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] bg-emerald-500 text-white px-6 py-3.5 rounded-full shadow-2xl shadow-emerald-500/30 font-bold text-sm flex items-center gap-3 animate-in fade-in slide-in-from-bottom-6 duration-300">
          <CheckCircle2 size={18} />
          {successMessage}
        </div>
      )}
    </div>
  );
}
