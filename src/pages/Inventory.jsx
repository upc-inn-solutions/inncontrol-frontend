import { useState, useEffect } from 'react';
import { api } from '../lib/axios';
import { 
  Loader2, Plus, PackageSearch, X, Save, AlertTriangle, 
  Trash2, Edit3, Search, Filter, ArrowUp, ArrowDown, 
  Coffee, Droplets, Bed, Briefcase, Zap, Info, CheckCircle2 
} from 'lucide-react';
import { useThemeStore } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';

const CATEGORIES = {
  LIMPIEZA: { label: 'Limpieza', icon: <Droplets size={18} />, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  AMENITIES: { label: 'Amenities', icon: <Zap size={18} />, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  BLANQUERIA: { label: 'Blanquería', icon: <Bed size={18} />, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  ALIMENTOS: { label: 'Minibar', icon: <Coffee size={18} />, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  OFICINA: { label: 'Oficina', icon: <Briefcase size={18} />, color: 'text-slate-500', bg: 'bg-slate-500/10' }
};

export default function Inventory() {
  const { dark } = useThemeStore();
  const { user } = useAuthStore();
  const isManager = user?.role === 'GERENTE' || user?.role === 'ROLE_GERENTE';
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  
  // Filtering & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, CRITICAL
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const [formData, setFormData] = useState({
    name: '',
    category: 'LIMPIEZA',
    currentQuantity: 0,
    minQuantity: 10
  });

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await api.get('/inventory');
      setItems(response.data);
    } catch (error) {
      console.error("Error fetching inventory", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        category: item.category,
        currentQuantity: item.currentQuantity,
        minQuantity: item.minQuantity
      });
    } else {
      setEditingItem(null);
      setFormData({ name: '', category: 'LIMPIEZA', currentQuantity: 0, minQuantity: 10 });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await api.put(`/inventory/${editingItem.id}`, formData);
      } else {
        await api.post('/inventory', formData);
      }
      setIsModalOpen(false);
      fetchItems();
    } catch (error) { console.error(error); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/inventory/${itemToDelete.id}`);
      setItems(prev => prev.filter(i => i.id !== itemToDelete.id));
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (error) { console.error(error); }
  };

  const adjustQuantity = async (id, change) => {
    try {
      // Optimistic update
      setItems(items.map(item => 
        item.id === id 
          ? { ...item, currentQuantity: Math.max(0, item.currentQuantity + change) } 
          : item
      ));
      await api.patch(`/inventory/${id}/quantity?change=${change}`);
    } catch (error) {
      fetchItems(); // Rollback on error
    }
  };

  const cardStyle = dark 
    ? { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', text: '#f1f5f9', sub: '#94a3b8' }
    : { bg: '#fff', border: '#e2e8f0', text: '#0f172a', sub: '#64748b' };

  // Logic for health bars and stats
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
    const isLowStock = item.currentQuantity <= item.minQuantity;
    const matchesStatus = statusFilter === 'ALL' || (statusFilter === 'CRITICAL' && isLowStock);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const stats = {
    total: items.length,
    critical: items.filter(i => i.currentQuantity <= i.minQuantity).length,
    ok: items.filter(i => i.currentQuantity > i.minQuantity).length
  };

  const getStockHealth = (current, min) => {
    if (current === 0) return 0;
    const percentage = (current / (min * 2)) * 100;
    return Math.min(100, percentage);
  };

  return (
    <div className="max-w-[1600px] mx-auto pb-20 px-4 overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: cardStyle.text }}>Inventario</h1>
          <p className="text-sm mt-1" style={{ color: cardStyle.sub }}>Administra y supervisa los artículos y suministros del hotel.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex p-1 rounded-xl border" style={{ background: dark ? 'rgba(255,255,255,0.03)' : '#f8fafc', borderColor: cardStyle.border }}>
            <div className="px-3 py-1 text-center border-r border-white/5 last:border-0 flex flex-col items-center">
              <span className="text-lg font-black leading-none" style={{ color: cardStyle.text }}>{stats.total}</span>
              <span className="text-[7px] font-black uppercase tracking-widest text-slate-500 mt-1.5">Total</span>
            </div>
            <div className="px-3 py-1 text-center border-r border-white/5 last:border-0 flex flex-col items-center">
              <span className="text-lg font-black leading-none text-red-500">{stats.critical}</span>
              <span className="text-[7px] font-black uppercase tracking-widest text-red-500/70 mt-1.5">Críticos</span>
            </div>
            <div className="px-3 py-1 text-center flex flex-col items-center">
              <span className="text-lg font-black leading-none text-emerald-500">{stats.ok}</span>
              <span className="text-[7px] font-black uppercase tracking-widest text-emerald-500/70 mt-1.5">Óptimos</span>
            </div>
          </div>
          {isManager && (
            <button 
              onClick={() => handleOpenModal()}
              className="flex items-center gap-3 bg-emerald-500 hover:bg-emerald-600 text-white px-7 py-4 rounded-2xl font-black text-xs tracking-wide transition-all active:scale-95 shadow-lg shadow-emerald-500/25"
            >
              <Plus size={18} />
              NUEVO INSUMO
            </button>
          )}
        </div>
      </div>

      {/* SEARCH & FILTERS */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 items-center justify-between bg-white/5 p-4 rounded-[2rem] border border-white/5" style={{ background: dark ? 'rgba(255,255,255,0.02)' : '#fff' }}>
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar artículo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full pl-12 pr-4 py-3.5 rounded-2xl text-sm font-bold focus:outline-none transition-all ${dark ? 'bg-white/5 border border-white/10 text-white' : 'bg-gray-50 border border-gray-200 text-slate-900'}`}
          />
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => setStatusFilter(statusFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
              statusFilter === 'CRITICAL' 
                ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20' 
                : (dark ? 'bg-white/5 text-slate-400 border-white/10 hover:text-white' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50')
            }`}
          >
            <AlertTriangle size={14} />
            Stock Crítico
          </button>
          
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border outline-none cursor-pointer ${dark ? 'bg-white/5 text-white border-white/10 hover:border-white/20 [color-scheme:dark]' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
          >
            <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} value="ALL">Todas las categorías</option>
            {Object.entries(CATEGORIES).map(([id, cat]) => (
              <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} key={id} value={id}>{cat.label}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* ITEMS LIST */}
      {isLoading ? (
        <div className="flex justify-center items-center h-96">
          <Loader2 className="animate-spin text-emerald-500" size={48} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* MÓVIL: Vista de Tarjetas */}
          <div className="grid grid-cols-1 gap-4 lg:hidden">
            {filteredItems.map(item => {
              const isLowStock = item.currentQuantity <= item.minQuantity;
              const category = CATEGORIES[item.category] || CATEGORIES.OFICINA;
              return (
                <div key={item.id} className="p-5 rounded-[2rem] border transition-all" style={{ background: cardStyle.bg, borderColor: cardStyle.border }}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${category.bg} ${category.color}`}>
                        {category.icon}
                      </div>
                      <div>
                        <h3 className="text-sm font-black" style={{ color: cardStyle.text }}>{item.name}</h3>
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${category.bg} ${category.color}`}>
                          {category.label}
                        </span>
                      </div>
                    </div>
                    {isManager && (
                      <div className="flex gap-2">
                        <button onClick={() => handleOpenModal(item)} className="p-2 rounded-xl bg-blue-500/10 text-blue-500"><Edit3 size={16} /></button>
                        <button onClick={() => { setItemToDelete(item); setIsModalOpen(false); setIsDeleteModalOpen(true); }} className="p-2 rounded-xl bg-red-500/10 text-red-500"><Trash2 size={16} /></button>
                      </div>
                    )}
                  </div>

                  <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-4">
                    <div className="flex justify-between items-end mb-2">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black uppercase tracking-tighter text-slate-500">Stock Actual</span>
                        <span className={`text-xl font-black ${isLowStock ? 'text-red-500' : 'text-emerald-500'}`}>{item.currentQuantity} <span className="text-[10px] text-slate-500">UDS</span></span>
                      </div>
                      <div className="text-right">
                        <span className="text-[8px] font-black uppercase tracking-tighter text-slate-500">Mínimo</span>
                        <p className="text-xs font-bold" style={{ color: cardStyle.text }}>{item.minQuantity} UDS</p>
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full ${isLowStock ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (item.currentQuantity / (item.minQuantity * 2)) * 100)}%` }} />
                    </div>
                  </div>

                  {isManager && (
                    <div className="flex gap-2 mt-4">
                      <button onClick={() => adjustQuantity(item.id, -1)} className="flex-1 py-3 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center font-bold text-xs"><ArrowDown size={14} className="mr-2" /> RECOGER</button>
                      <button onClick={() => adjustQuantity(item.id, 1)} className="flex-1 py-3 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xs"><ArrowUp size={14} className="mr-2" /> ABASTECER</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* DESKTOP: Vista de Tabla Original */}
          <div className="hidden lg:flex flex-col gap-2">
            <div className="flex items-center px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-white/5">
              <div className="flex-[2] flex items-center gap-2">Artículo</div>
              <div className="flex-1">Categoría</div>
              <div className="flex-[2]">Nivel de Stock</div>
              <div className="flex-1 text-center">Estado</div>
              {isManager && <div className="w-32 text-right">Acciones</div>}
            </div>

            {filteredItems.map(item => {
              const isLowStock = item.currentQuantity <= item.minQuantity;
              const health = (item.currentQuantity / (item.minQuantity * 2)) * 100;
              const category = CATEGORIES[item.category] || CATEGORIES.OFICINA;
              return (
                <div key={item.id} className="group flex items-center px-6 py-3 rounded-2xl transition-all duration-300 border border-transparent hover:border-emerald-500/20 shadow-sm" style={{ background: cardStyle.bg }}>
                  <div className="flex-[2] flex items-center gap-4 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${category.bg} ${category.color}`}>{category.icon}</div>
                    <h3 className="text-[13px] font-bold truncate" style={{ color: cardStyle.text }}>{item.name}</h3>
                  </div>
                  <div className="flex-1">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${category.bg} ${category.color}`}>{category.label}</span>
                  </div>
                  <div className="flex-[2] pr-8">
                    <div className="flex justify-between items-center mb-1.5 px-1">
                      <div className="flex items-center gap-1.5"><span className={`text-base font-black ${isLowStock ? 'text-red-500' : 'text-emerald-500'}`}>{item.currentQuantity}</span><span className="text-[9px] font-bold text-slate-500 uppercase">uds</span></div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mín: {item.minQuantity}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-700 ${isLowStock ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.2)]'}`} style={{ width: `${Math.min(100, health)}%` }} />
                    </div>
                  </div>
                  <div className="w-32 flex justify-center shrink-0">
                    {isLowStock ? (
                      <div className="flex items-center gap-2 text-red-500 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20"><AlertTriangle size={12} className="animate-pulse" /><span className="text-[8px] font-black uppercase tracking-widest">Crítico</span></div>
                    ) : (
                      <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20"><CheckCircle2 size={12} /><span className="text-[8px] font-black uppercase tracking-widest">Óptimo</span></div>
                    )}
                  </div>
                  {isManager && (
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
                        <button onClick={() => adjustQuantity(item.id, -1)} className="w-8 h-8 rounded-md bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><ArrowDown size={14} /></button>
                        <button onClick={() => adjustQuantity(item.id, 1)} className="w-8 h-8 rounded-md bg-emerald-500/10 text-emerald-500 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all"><ArrowUp size={14} /></button>
                      </div>
                      <div className="h-8 w-px bg-white/10 mx-1" />
                      <div className="flex gap-1">
                        <button onClick={() => handleOpenModal(item)} className="w-8 h-8 rounded-md bg-blue-500/10 text-blue-500 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all"><Edit3 size={14} /></button>
                        <button onClick={() => { setItemToDelete(item); setIsModalOpen(false); setIsDeleteModalOpen(true); }} className="w-8 h-8 rounded-md bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL NUEVO / EDITAR INSUMO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl border border-white/10 overflow-hidden" style={{ background: dark ? '#0a1510' : '#fff' }}>
            
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  {editingItem ? <Edit3 size={24} /> : <Plus size={24} />}
                </div>
                <h2 className="text-xl font-black tracking-tight" style={{ color: cardStyle.text }}>
                  {editingItem ? 'Editar Insumo' : 'Nuevo Insumo'}
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl hover:bg-red-500/10 text-red-400 transition-all"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest mb-2 text-emerald-500">Nombre del Artículo</label>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className={`w-full border rounded-xl px-5 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all ${dark ? 'bg-white/5 border-white/10 text-white placeholder:text-gray-600' : 'bg-gray-50 border-gray-200 text-gray-900'}`} placeholder="Ej: Toallas Blancas Premium" />
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest mb-2 text-emerald-500">Categoría</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(CATEGORIES).map(([key, cat]) => (
                      <button key={key} type="button" onClick={() => setFormData({...formData, category: key})}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                          formData.category === key 
                            ? 'bg-emerald-500 text-white border-emerald-500' 
                            : (dark ? 'bg-white/5 border-white/10 text-slate-400 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100')
                        }`}>
                        {cat.icon} {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest mb-2 text-emerald-500">Stock Actual</label>
                    <input type="number" min="0" value={formData.currentQuantity} onChange={(e) => setFormData({...formData, currentQuantity: parseInt(e.target.value)})} className={`w-full border rounded-xl px-5 py-3 text-sm font-bold ${dark ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest mb-2 text-emerald-500">Mínimo para Alerta</label>
                    <input type="number" min="1" value={formData.minQuantity} onChange={(e) => setFormData({...formData, minQuantity: parseInt(e.target.value)})} className={`w-full border rounded-xl px-5 py-3 text-sm font-bold ${dark ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} />
                  </div>
                </div>
              </div>

              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/25">
                <Save size={18} /> {editingItem ? 'Guardar Cambios' : 'Registrar Insumo'}
              </button>
            </form>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setIsDeleteModalOpen(false)} />
          <div className="relative w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-red-500/20" style={{ background: dark ? '#0f172a' : '#fff' }}>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 mb-4"><AlertTriangle size={32} /></div>
              <h2 className="text-xl font-black mb-2" style={{ color: cardStyle.text }}>¿Eliminar insumo?</h2>
              <p className="text-xs font-bold mb-6 px-4 py-2 rounded-xl bg-red-500/5 border border-red-500/10 text-red-400">"{itemToDelete?.name}"</p>
              <p className="text-xs mb-6" style={{ color: cardStyle.sub }}>Esta acción no se puede deshacer.</p>
              <div className="grid grid-cols-2 gap-3 w-full">
                <button onClick={() => setIsDeleteModalOpen(false)} className={`py-4 rounded-2xl font-bold text-xs uppercase transition-all ${dark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Cancelar</button>
                <button onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-lg shadow-red-500/20 transition-all active:scale-95">Eliminar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
