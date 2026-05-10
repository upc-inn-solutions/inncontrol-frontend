import { useState, useEffect } from 'react';
import { api } from '../lib/axios';
import { BedDouble, Loader2, Plus, X, Save, Edit2, RefreshCw, Trash2, Layers, Minus, Check, Filter, Hash, Tag, Users, Activity } from 'lucide-react';
import { useThemeStore } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';

export default function Rooms() {
  const { dark } = useThemeStore();
  const { user } = useAuthStore();
  const isManager = user?.role === 'GERENTE' || user?.role === 'ROLE_GERENTE';
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFloorModalOpen, setIsFloorModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  
  const [totalFloors, setTotalFloors] = useState(5);
  const [tempFloors, setTempFloors] = useState(5);
  const [filter, setFilter] = useState('TODAS');
  
  const [roomData, setRoomData] = useState({
    number: '',
    type: 'SIMPLE',
    capacity: 2,
    status: 'LIBRE',
    floor: 1
  });

  useEffect(() => {
    fetchRooms();
    const savedFloors = localStorage.getItem('totalFloors');
    if (savedFloors) {
      const n = parseInt(savedFloors);
      setTotalFloors(n);
      setTempFloors(n);
    }
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await api.get('/rooms');
      setRooms(response.data);
    } catch (error) {
      console.error("Error fetching rooms", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (room = null) => {
    if (room) {
      setEditingRoom(room);
      setRoomData({ 
        ...room, 
        floor: room.floor || parseInt(room.number.charAt(0)) || 1 
      });
    } else {
      setEditingRoom(null);
      setRoomData({ number: '', type: 'SIMPLE', capacity: 2, status: 'LIBRE', floor: 1 });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRoom) {
        await api.put(`/rooms/${editingRoom.id}`, roomData);
      } else {
        await api.post('/rooms', roomData);
      }
      setIsModalOpen(false);
      fetchRooms();
    } catch (error) {
      console.error("Error saving room", error);
    }
  };

  const toggleStatus = async (room) => {
    const statuses = ['LIBRE', 'OCUPADA', 'LIMPIEZA', 'MANTENIMIENTO'];
    const nextStatus = statuses[(statuses.indexOf(room.status) + 1) % statuses.length];
    try {
      await api.put(`/rooms/${room.id}`, { ...room, status: nextStatus });
      fetchRooms();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar esta habitación?')) return;
    try {
      await api.delete(`/rooms/${id}`);
      fetchRooms();
    } catch (e) { console.error(e); }
  };

  const handleSaveFloors = () => {
    setTotalFloors(tempFloors);
    localStorage.setItem('totalFloors', tempFloors);
    setIsFloorModalOpen(false);
  };

  const openFloorModal = () => {
    setTempFloors(totalFloors);
    setIsFloorModalOpen(true);
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'LIBRE': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'OCUPADA': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'LIMPIEZA': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'MANTENIMIENTO': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const cardStyle = dark 
    ? { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', text: '#f1f5f9', sub: '#94a3b8' }
    : { bg: '#fff', border: '#e2e8f0', text: '#0f172a', sub: '#64748b' };

  const filteredRooms = filter === 'TODAS' 
    ? rooms 
    : rooms.filter(r => r.status === filter);

  const groupedRooms = filteredRooms.reduce((acc, room) => {
    const floor = room.floor?.toString() || room.number.charAt(0) || '0';
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {});

  const floorList = [];
  for (let i = 1; i <= totalFloors; i++) floorList.push(i.toString());
  Object.keys(groupedRooms).forEach(f => {
    if (!floorList.includes(f)) floorList.push(f);
  });
  floorList.sort((a,b) => parseInt(a) - parseInt(b));

  const filterOptions = [
    { label: 'Todas', value: 'TODAS' },
    { label: 'Libres', value: 'LIBRE' },
    { label: 'Ocupadas', value: 'OCUPADA' },
    { label: 'Limpieza', value: 'LIMPIEZA' },
    { label: 'Mantenimiento', value: 'MANTENIMIENTO' },
  ];

  return (
    <div className="max-w-[1600px] mx-auto pb-20 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: cardStyle.text }}>Control de Habitaciones</h1>
          <p className="text-sm mt-1" style={{ color: cardStyle.sub }}>Monitorea la disponibilidad y el estado de tus habitaciones.</p>
        </div>
          
          {isManager && (
            <div className="flex gap-3">
              <button 
                onClick={openFloorModal}
                className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl font-black text-xs transition-all border ${dark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'}`}
              >
                <Layers size={18} className="text-emerald-500" />
                Pisos: {totalFloors}
              </button>
              <button 
                onClick={() => handleOpenModal()}
                className="flex items-center gap-3 bg-emerald-500 hover:bg-emerald-600 text-white px-7 py-4 rounded-2xl font-black text-xs tracking-wide transition-all active:scale-95 shadow-lg shadow-emerald-500/25"
              >
                <Plus size={18} />
                NUEVA HABITACIÓN
              </button>
            </div>
          )}
        </div>

        {/* Filter Bar */}
        <div className="flex justify-start mb-12">
          <div className={`flex items-center p-1.5 rounded-2xl border ${dark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
            <div className="px-3 text-slate-400 hidden sm:block"><Filter size={16} /></div>
            <div className="flex flex-wrap gap-1">
              {filterOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    filter === opt.value 
                      ? 'bg-emerald-500 text-white shadow-none'
                      : (dark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:bg-white hover:text-emerald-600')
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-96">
          <Loader2 className="animate-spin text-emerald-500" size={48} />
        </div>
      ) : (
        <div className="space-y-16">
          {floorList.map(floor => (
            <div key={floor} className="space-y-8">
              <div className="flex items-center gap-6">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500 bg-emerald-500/5 px-5 py-2 rounded-xl border border-emerald-500/10">
                  {floor === '0' ? 'Sin Asignar' : `Piso ${floor}`}
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/10 to-transparent" />
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {(groupedRooms[floor] || []).sort((a,b) => a.number.localeCompare(b.number)).map(room => (
                  <div key={room.id} className="rounded-2xl p-5 transition-all duration-300 border shadow-sm hover:shadow-md"
                    style={{ background: cardStyle.bg, borderColor: cardStyle.border }}>
                    
                    <div className="flex justify-between items-center mb-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/10">
                        <BedDouble size={20} />
                      </div>
                      <div className={`text-[7px] font-black px-2 py-1 rounded-md border tracking-widest uppercase ${getStatusColor(room.status)}`}>
                        {room.status === 'MANTENIMIENTO' ? 'MANT.' : room.status}
                      </div>
                    </div>
                    
                    <div className="mb-6">
                      <h3 className="text-xl font-black tracking-tight" style={{ color: cardStyle.text }}>{room.number}</h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">{room.type}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-500 opacity-20" />
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{room.capacity}P</span>
                      </div>
                    </div>

                    <div className="flex justify-between gap-2">
                      {isManager && (
                        <button 
                          onClick={() => handleOpenModal(room)}
                          className={`flex-1 flex items-center justify-center py-3 rounded-xl transition-all ${dark ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20' : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100'}`}
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                      <button 
                        onClick={() => toggleStatus(room)}
                        className={`flex-1 flex items-center justify-center py-3 rounded-xl transition-all ${dark ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100'}`}
                        title="Cambiar Estado"
                      >
                        <RefreshCw size={16} />
                      </button>
                      {isManager && (
                        <button 
                          onClick={() => handleDelete(room.id)}
                          className={`flex-1 flex items-center justify-center py-3 rounded-xl transition-all ${dark ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100'}`}
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL PISOS */}
      {isFloorModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsFloorModalOpen(false)} />
          <div className="relative w-full max-w-[320px] rounded-[2rem] p-6 border border-white/10 shadow-2xl"
            style={{ background: dark ? '#111827' : '#ffffff' }}>
            
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${dark ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-500'}`}>
                  <Layers size={16} />
                </div>
                <h2 className="text-lg font-black tracking-tight" style={{ color: cardStyle.text }}>Pisos</h2>
              </div>
              <button onClick={() => setIsFloorModalOpen(false)} className="p-2 rounded-xl hover:bg-red-500/10 text-red-400 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-6">
              <div className={`rounded-2xl p-4 border ${dark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-center justify-between gap-4">
                  <button 
                    onClick={() => setTempFloors(Math.max(1, tempFloors - 1))}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 border ${dark ? 'bg-white/10 hover:bg-white/20 text-white border-white/10' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'}`}
                  >
                    <Minus size={18} />
                  </button>
                  
                  <div className="text-center">
                    <span className="block text-4xl font-black tracking-tighter leading-none" style={{ color: cardStyle.text }}>{tempFloors}</span>
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-500 mt-1 block">Pisos</span>
                  </div>

                  <button 
                    onClick={() => setTempFloors(tempFloors + 1)}
                    className="w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white transition-all active:scale-90 shadow-none"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              <button 
                onClick={handleSaveFloors}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3.5 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-none border-none"
              >
                <Check size={16} />
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA/EDITAR HABITACIÓN ACTUALIZADO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl border border-white/10 overflow-hidden"
            style={{ background: dark ? '#0a1510' : '#fff' }}>
            
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  {editingRoom ? <Edit2 size={24} /> : <Plus size={24} />}
                </div>
                <h2 className="text-xl font-black tracking-tight" style={{ color: cardStyle.text }}>
                  {editingRoom ? 'Editar Habitación' : 'Nueva Habitación'}
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl hover:bg-red-500/10 text-red-400 transition-all">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest mb-2 text-emerald-500"><Hash size={10}/> Número de Habitación</label>
                    <input 
                      type="text" 
                      required
                      value={roomData.number}
                      onChange={(e) => setRoomData({...roomData, number: e.target.value})}
                      className={`w-full border rounded-xl px-5 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all ${
                        dark ? 'bg-white/5 border-white/10 text-white placeholder:text-gray-600' : 'bg-gray-50 border-gray-200 text-gray-900'
                      }`}
                      placeholder="Ej: 101"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest mb-2 text-emerald-500"><Layers size={10}/> Piso</label>
                    <select
                      required
                      value={roomData.floor}
                      onChange={(e) => setRoomData({...roomData, floor: parseInt(e.target.value)})}
                      className={`w-full border rounded-xl px-5 py-3 text-xs font-bold focus:outline-none appearance-none cursor-pointer ${
                        dark ? 'bg-slate-900 border-white/10 text-white [color-scheme:dark]' : 'bg-gray-50 border-gray-200 text-gray-900'
                      }`}
                    >
                      {Array.from({ length: totalFloors }, (_, i) => i + 1).map(f => (
                        <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} key={f} value={f}>Piso {f}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest mb-2 text-emerald-500"><Tag size={10}/> Tipo</label>
                    <select 
                      value={roomData.type}
                      onChange={(e) => setRoomData({...roomData, type: e.target.value})}
                      className={`w-full border rounded-xl px-5 py-3 text-xs font-bold focus:outline-none appearance-none cursor-pointer ${
                        dark ? 'bg-slate-900 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                      }`}
                    >
                      <option className={dark ? "bg-slate-900 text-white" : ""} value="SIMPLE">Simple</option>
                      <option className={dark ? "bg-slate-900 text-white" : ""} value="DOBLE">Doble</option>
                      <option className={dark ? "bg-slate-900 text-white" : ""} value="SUITE">Suite</option>
                      <option className={dark ? "bg-slate-900 text-white" : ""} value="PRESIDENCIAL">Presidencial</option>
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest mb-2 text-emerald-500"><Users size={10}/> Capacidad</label>
                    <input 
                      type="number" 
                      min="1"
                      value={roomData.capacity}
                      onChange={(e) => setRoomData({...roomData, capacity: parseInt(e.target.value)})}
                      className={`w-full border rounded-xl px-5 py-3 text-xs font-bold focus:outline-none transition-all ${
                        dark ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest mb-2 text-emerald-500"><Activity size={10}/> Estado Inicial</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['LIBRE', 'OCUPADA', 'LIMPIEZA', 'MANTENIMIENTO'].map(s => (
                      <button key={s} type="button" onClick={() => setRoomData({...roomData, status: s})}
                        className={`py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                          roomData.status === s 
                            ? 'bg-emerald-500 text-white border-emerald-500' 
                            : (dark ? 'bg-white/5 border-white/10 text-slate-400 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100')
                        }`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/25"
              >
                <Save size={18} />
                Guardar Habitación
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
