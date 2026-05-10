import { useState, useEffect } from 'react';
import { api } from '../lib/axios';
import { Plus, Clock, CheckCircle2, CircleDashed, User as UserIcon, Users, BedDouble, Sparkles, X, Save, Trash2, BrainCircuit, Loader2, AlertTriangle, Calendar, MapPin, AlignLeft, History, Tag, Layout, Edit3, Search, Filter, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';

// Variable global para DnD
let globalDraggedTaskId = null;

export default function Tasks() {
  const { dark } = useThemeStore();
  const { user } = useAuthStore();
  const isManager = user?.role === 'GERENTE' || user?.role === 'ROLE_GERENTE';
  const [tasks, setTasks] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [selectedTaskForAi, setSelectedTaskForAi] = useState(null);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [draggedOverColumn, setDraggedOverColumn] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'MEDIA',
    roomId: '',
    assignedToId: '',
    dueDate: '',
    dueTime: ''
  });

  const [editTaskData, setEditTaskData] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState('ALL');
  const [editSelectedFloor, setEditSelectedFloor] = useState('ALL');

  // Advanced Filtering State
  const [filters, setFilters] = useState({
    search: '',
    employeeId: '',
    priority: '',
    roomId: '',
    date: '',
    floor: 'ALL',
    onlyMine: !isManager
  });

  useEffect(() => {
    fetchTasks();
    fetchRooms();
    fetchEmployees();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await api.get('/tasks');
      setTasks(response.data);
    } catch (error) { console.error(error); }
    finally { setIsLoading(false); }
  };

  const fetchRooms = async () => {
    try {
      const response = await api.get('/rooms');
      setRooms(response.data.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })));
    } catch (e) { console.error(e); }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/users');
      setEmployees(response.data.filter(emp => emp.role !== 'GERENTE' && emp.role !== 'ROLE_GERENTE' && emp.id !== user?.id));
    } catch (e) { console.error(e); }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!user?.id) return;
    
    let finalDueDate = null;
    if (newTask.dueDate) {
      finalDueDate = `${newTask.dueDate}T${newTask.dueTime || '00:00'}:00`;
    }

    try {
      await api.post('/tasks', {
        ...newTask,
        roomId: newTask.roomId ? parseInt(newTask.roomId) : null,
        assignedToId: newTask.assignedToId ? parseInt(newTask.assignedToId) : null,
        dueDate: finalDueDate
      });
      setIsModalOpen(false);
      setNewTask({ title: '', description: '', priority: 'MEDIA', roomId: '', assignedToId: '', dueDate: '', dueTime: '' });
      fetchTasks();
    } catch (error) { console.error(error); }
  };

  const handleUpdateTask = async (e) => {
    e.preventDefault();
    try {
      let finalDueDate = null;
      if (editTaskData.dueDateOnly) {
        finalDueDate = `${editTaskData.dueDateOnly}T${editTaskData.dueTimeOnly || '00:00'}:00`;
      }

      await api.put(`/tasks/${selectedTask.id}`, {
        title: editTaskData.title,
        description: editTaskData.description,
        priority: editTaskData.priority,
        assignedToId: editTaskData.assignedToId ? parseInt(editTaskData.assignedToId) : null,
        roomId: editTaskData.roomId ? parseInt(editTaskData.roomId) : null,
        dueDate: finalDueDate
      });
      
      setIsEditing(false);
      setIsDetailModalOpen(false);
      fetchTasks();
    } catch (error) { console.error(error); }
  };

  const openDeleteModal = (e, id) => {
    e.stopPropagation();
    setTaskToDelete(id);
    setIsDetailModalOpen(false);
    setIsEditing(false);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteTask = async () => {
    try {
      await api.delete(`/tasks/${taskToDelete}`);
      setTasks(tasks.filter(t => t.id !== taskToDelete));
      setIsDeleteModalOpen(false);
      setIsDetailModalOpen(false);
      setSelectedTask(null);
      setTaskToDelete(null);
    } catch (error) { console.error(error); }
  };

  const openDetail = (task) => {
    setSelectedTask(task);
    const d = task.dueDate ? new Date(task.dueDate) : null;
    setEditTaskData({
      title: task.title,
      description: task.description,
      priority: task.priority,
      roomId: task.room?.id || '',
      assignedToId: task.assignedTo?.id || '',
      dueDateOnly: d ? d.toISOString().split('T')[0] : '',
      dueTimeOnly: d ? d.toTimeString().slice(0, 5) : ''
    });
    
    if (task.room?.number) {
      setEditSelectedFloor(task.room.number.charAt(0));
    } else {
      setEditSelectedFloor('ALL');
    }
    
    setIsEditing(false);
    setIsDetailModalOpen(true);
  };

  // DnD Logic
  const handleDragStart = (e, id) => {
    globalDraggedTaskId = id;
    e.dataTransfer.setData('text/plain', id.toString());
    setTimeout(() => {
      const el = document.getElementById(`task-${id}`);
      if (el) el.style.opacity = '0.4';
    }, 0);
  };

  const handleDragEnd = (id) => {
    const el = document.getElementById(`task-${id}`);
    if (el) el.style.opacity = '1';
    setDraggedOverColumn(null);
  };

  const handleDrop = async (e, newStatus) => {
    const taskId = globalDraggedTaskId;
    globalDraggedTaskId = null;
    setDraggedOverColumn(null);
    if (!taskId) return;
    const taskToUpdate = tasks.find(t => t.id === taskId);
    if (!taskToUpdate || taskToUpdate.status === newStatus) return;
    setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    try { await api.patch(`/tasks/${taskId}/status?status=${newStatus}`); }
    catch (e) { fetchTasks(); }
  };

  const handleAiSuggest = async (e, task) => {
    e.stopPropagation();
    setSelectedTaskForAi(task);
    setIsAiModalOpen(true);
    setIsAiLoading(true);
    try {
      const res = await api.get(`/ai/suggest-assignment?taskTitle=${encodeURIComponent(task.title)}&priority=${task.priority}`);
      setAiSuggestion(res.data);
    } catch (e) { console.error(e); }
    finally { setIsAiLoading(false); }
  };

  const confirmAiAssignment = async () => {
    try {
      await api.put(`/tasks/${selectedTaskForAi.id}`, {
        ...selectedTaskForAi,
        status: 'EN_PROGRESO',
        assignedTo: { id: aiSuggestion.employeeId },
        room: selectedTaskForAi.room ? { id: selectedTaskForAi.room.id } : null
      });
      setIsAiModalOpen(false);
      fetchTasks();
    } catch (e) { console.error(e); }
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const hasTime = dateString.includes('T') && !dateString.endsWith('T00:00:00');
    
    const options = { day: '2-digit', month: 'short' };
    if (hasTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }
    return new Intl.DateTimeFormat('es-ES', options).format(date);
  };

  const isOverdue = (dateString) => {
    if (!dateString) return false;
    return new Date(dateString) < new Date();
  };

  const formatText = (text) => {
    if (!text) return '';
    const formatted = text.replace('_', ' ').toLowerCase();
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  const cardStyle = dark 
    ? { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', text: '#f1f5f9', sub: '#94a3b8' }
    : { bg: '#fff', border: '#e2e8f0', text: '#0f172a', sub: '#64748b' };

  const floors = Array.from(new Set(rooms.map(r => r.floor?.toString() || r.number.charAt(0)))).filter(Boolean).sort();
  const roomsOnSelectedFloor = selectedFloor === 'ALL' ? [] : rooms.filter(r => (r.floor?.toString() || r.number.charAt(0)) === selectedFloor);
  const roomsOnEditSelectedFloor = editSelectedFloor === 'ALL' ? [] : rooms.filter(r => (r.floor?.toString() || r.number.charAt(0)) === editSelectedFloor);

  const getStatusStyle = (status) => {
    switch(status) {
      case 'PENDIENTE': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'EN_PROGRESO': return 'bg-blue-600/10 text-blue-600 border-blue-600/20';
      case 'COMPLETADA': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const getPriorityStyle = (priority) => {
    switch(priority) {
      case 'URGENTE': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'ALTA': return 'bg-violet-500/10 text-violet-500 border-violet-500/20';
      case 'MEDIA': return 'bg-sky-500/10 text-sky-500 border-sky-500/20';
      case 'BAJA': return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  const editInputClasses = `
    text-[10px] p-1 rounded-md border transition-all duration-300 focus:outline-none
    ${dark ? 'bg-slate-800 border-white/10 text-white focus:border-emerald-500/50 [color-scheme:dark]' : 'bg-gray-50 border-gray-200 text-slate-900 focus:border-emerald-500/50'}
  `;

  const handleDragOver = (e, statusId) => {
    e.preventDefault();
    if (draggedOverColumn !== statusId) setDraggedOverColumn(statusId);
  };

  const handleDragLeave = () => {
    setDraggedOverColumn(null);
  };

  const renderColumn = (title, statusId, icon, colorClass) => {
    const priorityWeights = { 'URGENTE': 4, 'ALTA': 3, 'MEDIA': 2, 'BAJA': 1 };

    const columnTasks = tasks
      .filter(t => t.status === statusId)
      .filter(task => {
        const matchesSearch = !filters.search || task.title.toLowerCase().includes(filters.search.toLowerCase());
        const matchesEmployee = !filters.employeeId || task.assignedTo?.id === parseInt(filters.employeeId);
        const matchesPriority = !filters.priority || task.priority === filters.priority;
        const matchesFloor = filters.floor === 'ALL' || (task.room?.floor && task.room.floor.toString() === filters.floor);
        const matchesRoom = !filters.roomId || task.room?.id === parseInt(filters.roomId);
        const matchesDate = !filters.date || (task.dueDate && task.dueDate.startsWith(filters.date));
        const matchesOnlyMine = !filters.onlyMine || task.assignedTo?.id === user?.id;
        return matchesSearch && matchesEmployee && matchesPriority && matchesRoom && matchesDate && matchesOnlyMine && matchesFloor;
      })
      .sort((a, b) => (priorityWeights[b.priority] || 0) - (priorityWeights[a.priority] || 0));

    const isOver = draggedOverColumn === statusId;

    return (
      <div
        className={`flex flex-col h-full rounded-3xl p-5 transition-all duration-300 border-2 ${isOver ? 'border-emerald-500 bg-emerald-500/10' : 'border-transparent'}`}
        style={{ background: isOver ? undefined : (dark ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.02)'), borderColor: isOver ? undefined : cardStyle.border, minHeight: '200px' }}
        onDragOver={(e) => handleDragOver(e, statusId)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, statusId)}>

        <div className="flex items-center justify-between mb-4 px-2 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center`} style={{ background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>{icon}</div>
            <h3 className={`font-black text-sm uppercase tracking-widest ${colorClass}`}>{title}</h3>
          </div>
          <span className="text-[10px] font-black px-2.5 py-1 rounded-full" style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)', color: cardStyle.sub }}>{columnTasks.length}</span>
        </div>

        <div className="space-y-1.5 flex-1 overflow-y-auto pr-1 custom-scrollbar">
          {columnTasks.map(task => (
            <div 
              id={`task-${task.id}`}
              key={task.id} 
              draggable={isManager || task.assignedTo?.id === user?.id}
              onClick={() => openDetail(task)}
              onDragStart={(e) => handleDragStart(e, task.id)}
              onDragEnd={() => handleDragEnd(task.id)}
              className={`rounded-xl p-2.5 transition-all duration-300 group cursor-pointer relative overflow-hidden border shadow-sm flex items-center gap-3 h-14 ${
                task.assignedTo?.id === user?.id && !filters.onlyMine
                  ? 'border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20 hover:border-emerald-400'
                  : isManager ? 'hover:border-emerald-500/50' : 'opacity-75 hover:border-white/10 cursor-default'
              }`}
              style={{ background: cardStyle.bg, borderColor: task.assignedTo?.id === user?.id && !filters.onlyMine ? undefined : cardStyle.border }}>
              
              <div className={`w-1 h-full absolute left-0 top-0 ${
                task.priority === 'URGENTE' ? 'bg-red-500' : 
                task.priority === 'ALTA' ? 'bg-violet-500' : 
                task.priority === 'MEDIA' ? 'bg-sky-500' : 'bg-slate-400'
              }`} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="font-bold text-[11px] truncate" style={{ color: cardStyle.text }}>{task.title}</h4>
                  <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-md border uppercase shrink-0 ${getPriorityStyle(task.priority)}`}>{task.priority}</span>
                </div>
                <div className="flex items-center gap-3 text-[9px] font-bold" style={{ color: cardStyle.sub }}>
                  {task.room && <span className="flex items-center gap-1 text-emerald-500"><BedDouble size={10}/>{task.room.number}</span>}
                  <span className={`flex items-center gap-1 ${task.assignedTo?.id === user?.id && !filters.onlyMine ? 'text-emerald-500' : ''}`}>
                    <UserIcon size={10}/>
                    {task.assignedTo?.name?.split(' ')[0] || 'Nadie'}
                  </span>
                </div>
              </div>

              {task.dueDate && (
                <div className={`flex flex-col items-end gap-1 shrink-0 ml-2`}>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
                    isOverdue(task.dueDate) && task.status !== 'COMPLETADA'
                      ? 'bg-red-500/10 border-red-500/20 text-red-500 animate-pulse'
                      : (dark ? 'bg-white/5 border-white/5 text-gray-400' : 'bg-gray-50 border-gray-100 text-gray-500')
                  }`}>
                    <Calendar size={10} className={isOverdue(task.dueDate) && task.status !== 'COMPLETADA' ? 'text-red-500' : 'text-emerald-500'} />
                    <span className="text-[9px] font-black uppercase tracking-tight flex items-center gap-1.5">
                      {formatDate(task.dueDate).replace(',', ' • ')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto min-h-screen lg:h-[calc(100vh-6rem)] flex flex-col px-4">
      <div className="flex justify-between items-start mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: cardStyle.text }}>Control de Tareas</h1>
          <p className="text-sm mt-1" style={{ color: cardStyle.sub }}>Supervisa y asigna las labores diarias de tu equipo.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
              showFilters 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                : (dark ? 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50')
            }`}
          >
            <Filter size={14} />
            Filtros
            {(!showFilters && (filters.search || filters.employeeId || filters.priority || filters.roomId || filters.date || (isManager && filters.onlyMine))) && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
            )}
          </button>
          {isManager && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-3 bg-emerald-500 hover:bg-emerald-600 text-white px-7 py-4 rounded-2xl font-black text-xs tracking-wide transition-all active:scale-95 shadow-lg shadow-emerald-500/25"
            >
              <Plus size={18} />
              NUEVA TAREA
            </button>
          )}
        </div>
      </div>

      {/* ── FILTER BAR ── */}
      <div className={`flex flex-wrap lg:flex-nowrap items-center gap-4 overflow-hidden transition-all duration-500 ease-in-out ${
        showFilters ? 'mb-6 opacity-100 max-h-[500px] py-4 px-5' : 'max-h-0 opacity-0 mb-0 py-0 px-5'
      } rounded-3xl border backdrop-blur-xl ${dark ? 'bg-slate-900/60 border-white/10' : 'bg-white/90 border-gray-100 shadow-xl shadow-slate-200/50'}`}>
        
        {/* Search */}
        <div className="relative group flex-grow min-w-[180px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
          <input 
            type="text"
            placeholder="Buscar tarea..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-medium outline-none transition-all ${dark ? 'bg-white/5 text-white focus:bg-white/10 border border-white/5 focus:border-emerald-500/30' : 'bg-gray-50 text-gray-700 focus:bg-white border border-gray-200/50 focus:border-emerald-500/20'}`}
          />
        </div>

        {/* My Tasks Toggle (Integrated) */}
        {!isManager && (
          <div className="shrink-0">
            <button 
              onClick={() => setFilters(prev => ({ ...prev, onlyMine: !prev.onlyMine }))}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                filters.onlyMine 
                  ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/20' 
                  : (dark ? 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10' : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200')
              }`}
            >
              {filters.onlyMine ? <UserIcon size={16} /> : <Users size={16} />}
              <span>{filters.onlyMine ? 'Mis Tareas' : 'Todas'}</span>
            </button>
          </div>
        )}

        {/* Employee Filter (Manager only) */}
        {isManager && (
          <div className="relative shrink-0 min-w-[160px]">
            <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={filters.employeeId}
              onChange={(e) => setFilters(prev => ({ ...prev, employeeId: e.target.value }))}
              className={`w-full pl-10 pr-8 py-2.5 rounded-xl text-xs font-bold appearance-none outline-none cursor-pointer transition-all ${dark ? 'bg-white/5 text-white border border-white/5 hover:border-white/10 [color-scheme:dark]' : 'bg-gray-50 text-gray-700 border border-gray-200/50 hover:border-gray-200'}`}
            >
              <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} value="">Empleado...</option>
              {employees.map(emp => (
                <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        )}

        {/* Priority Filter */}
        <div className="relative shrink-0 min-w-[150px]">
          <Tag size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            value={filters.priority}
            onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
            className={`w-full pl-10 pr-8 py-2.5 rounded-xl text-xs font-bold appearance-none outline-none cursor-pointer transition-all ${dark ? 'bg-white/5 text-white border border-white/5 hover:border-white/10 [color-scheme:dark]' : 'bg-gray-50 text-gray-700 border border-gray-200/50 hover:border-gray-200'}`}
          >
            <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} value="">Prioridad...</option>
            <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} value="URGENTE">Urgente</option>
            <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} value="ALTA">Alta</option>
            <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} value="MEDIA">Media</option>
            <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} value="BAJA">Baja</option>
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Room Filter (Two-Step: Floor then Room) */}
        <div className="flex gap-2 shrink-0">
          <div className="relative min-w-[100px]">
            <Layout size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={filters.floor}
              onChange={(e) => setFilters(prev => ({ ...prev, floor: e.target.value, roomId: '' }))}
              className={`w-full pl-10 pr-8 py-2.5 rounded-xl text-xs font-bold appearance-none outline-none cursor-pointer transition-all ${dark ? 'bg-white/5 text-white border border-white/5 hover:border-white/10 [color-scheme:dark]' : 'bg-gray-50 text-gray-700 border border-gray-200/50 hover:border-gray-200'}`}
            >
              <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} value="ALL">Pisos</option>
              {floors.map(f => (
                <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} key={f} value={f}>Piso {f}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative min-w-[120px]">
            <BedDouble size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={filters.roomId}
              disabled={filters.floor === 'ALL'}
              onChange={(e) => setFilters(prev => ({ ...prev, roomId: e.target.value }))}
              className={`w-full pl-10 pr-8 py-2.5 rounded-xl text-xs font-bold appearance-none outline-none cursor-pointer transition-all ${
                filters.floor === 'ALL' 
                  ? 'opacity-40 cursor-not-allowed' 
                  : ''
              } ${dark ? 'bg-white/5 text-white border border-white/5 hover:border-white/10 [color-scheme:dark]' : 'bg-gray-50 text-gray-700 border border-gray-200/50 hover:border-gray-200'}`}
            >
              <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} value="">Habit...</option>
              {rooms
                .filter(r => (r.floor?.toString() || r.number.charAt(0)) === filters.floor)
                .map(room => (
                  <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} key={room.id} value={room.id}>Hab. {room.number}</option>
                ))
              }
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Date Filter */}
        <div className="relative shrink-0 min-w-[180px]">
          <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="date"
            value={filters.date}
            onChange={(e) => setFilters(prev => ({ ...prev, date: e.target.value }))}
            className={`w-full pl-10 pr-12 py-2.5 rounded-xl text-xs font-bold outline-none transition-all ${dark ? 'bg-white/5 text-white border border-white/5 focus:border-emerald-500/30 [color-scheme:dark]' : 'bg-gray-50 text-gray-700 border border-gray-200/50 focus:border-emerald-500/20'}`}
          />
          {filters.date && (
            <button 
              onClick={() => setFilters(prev => ({ ...prev, date: '' }))}
              className="absolute right-9 top-1/2 -translate-y-1/2 text-gray-400 hover:text-emerald-500 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 lg:overflow-hidden pb-10 lg:pb-4">
        {renderColumn('Pendientes', 'PENDIENTE', <CircleDashed size={20} className="text-amber-500" />, 'text-amber-500')}
        {renderColumn('En Progreso', 'EN_PROGRESO', <Clock size={20} className="text-blue-600" />, 'text-blue-600')}
        {renderColumn('Completadas', 'COMPLETADA', <CheckCircle2 size={20} className="text-emerald-500" />, 'text-emerald-500')}
      </div>

      {/* MODAL NUEVA TAREA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl border border-white/10 overflow-hidden" style={{ background: dark ? '#0a1510' : '#fff' }}>
            
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <Plus size={24} />
                </div>
                <h2 className="text-xl font-black tracking-tight" style={{ color: cardStyle.text }}>Crear Nueva Tarea</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl hover:bg-red-500/10 text-red-400 transition-all"><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest mb-2 text-emerald-500">Título</label>
                  <input type="text" required value={newTask.title} onChange={(e) => setNewTask({...newTask, title: e.target.value})} className={`w-full border rounded-xl px-5 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all ${dark ? 'bg-white/5 border-white/10 text-white placeholder:text-gray-600' : 'bg-gray-50 border-gray-200 text-gray-900'}`} placeholder="Ej: Limpieza profunda Suite 101" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest mb-2 text-emerald-500"><Tag size={10}/> Prioridad</label>
                    <select value={newTask.priority} onChange={(e) => setNewTask({...newTask, priority: e.target.value})} className={`w-full border rounded-xl px-5 py-3 text-xs font-bold appearance-none cursor-pointer ${dark ? 'bg-slate-900 border-white/10 text-white [color-scheme:dark]' : 'bg-gray-50 border-gray-200 text-gray-900'}`}>
                      <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} value="BAJA">Baja</option>
                      <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} value="MEDIA">Media</option>
                      <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} value="ALTA">Alta</option>
                      <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} value="URGENTE">Urgente</option>
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest mb-2 text-emerald-500"><UserIcon size={10}/> Responsable</label>
                    <select value={newTask.assignedToId} onChange={(e) => setNewTask({...newTask, assignedToId: e.target.value})} className={`w-full border rounded-xl px-5 py-3 text-xs font-bold appearance-none cursor-pointer ${dark ? 'bg-slate-900 border-white/10 text-white [color-scheme:dark]' : 'bg-gray-50 border-gray-200 text-gray-900'}`}>
                      <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} value="">Sin asignar</option>
                      {employees.map(emp => (
                        <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest mb-2 text-emerald-500"><Calendar size={10}/> Fecha Límite</label>
                    <div className="flex gap-2 items-center">
                      <input type="date" required value={newTask.dueDate} onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})} className={`flex-1 border rounded-xl px-3 py-3 text-[11px] font-bold ${dark ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} />
                      <div className="flex items-center gap-1">
                        <input type="time" value={newTask.dueTime} onChange={(e) => setNewTask({...newTask, dueTime: e.target.value})} className={`w-20 border rounded-xl px-2 py-3 text-[11px] font-bold ${dark ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} />
                        {newTask.dueTime && (
                          <button type="button" onClick={() => setNewTask({...newTask, dueTime: ''})} className="p-2 rounded-xl hover:bg-red-500/10 text-red-400 transition-all"><X size={14}/></button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest mb-2 text-emerald-500"><Layout size={10}/> Piso</label>
                      <select value={selectedFloor} onChange={(e) => { setSelectedFloor(e.target.value); setNewTask({...newTask, roomId: ''}); }} className={`w-full border rounded-xl px-5 py-3 text-xs font-bold appearance-none cursor-pointer ${dark ? 'bg-slate-900 border-white/10 text-white [color-scheme:dark]' : 'bg-gray-50 border-gray-200 text-gray-900'}`}>
                        <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} value="ALL">Gral</option>
                        {floors.map(f => (<option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} key={f} value={f}>P{f}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest mb-2 text-emerald-500"><BedDouble size={10}/> Hab</label>
                      <select value={newTask.roomId} disabled={selectedFloor === 'ALL'} onChange={(e) => setNewTask({...newTask, roomId: e.target.value})} className={`w-full border rounded-xl px-5 py-3 text-xs font-bold appearance-none cursor-pointer ${dark ? 'bg-slate-900 border-white/10 text-white [color-scheme:dark]' : 'bg-gray-50 border-gray-200 text-gray-900'}`}>
                        <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} value="">-</option>
                        {roomsOnSelectedFloor.map(r => (<option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} key={r.id} value={r.id}>{r.number}</option>))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest mb-2 text-emerald-500">Descripción</label>
                  <textarea rows="2" value={newTask.description} onChange={(e) => setNewTask({...newTask, description: e.target.value})} className={`w-full border rounded-xl px-5 py-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none transition-all ${dark ? 'bg-white/5 border-white/10 text-white placeholder:text-gray-600' : 'bg-gray-50 border-gray-200 text-gray-900'}`} placeholder="Detalles de la tarea..." />
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/25"
              >
                <Save size={18} />
                Crear Tarea
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETALLE */}
      {isDetailModalOpen && selectedTask && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => { setIsDetailModalOpen(false); setIsEditing(false); }} />
          <div className="relative w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl border border-white/10 overflow-hidden" style={{ background: dark ? '#0f172a' : '#fff' }}>
            
            <div className="flex justify-between items-start mb-8">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full tracking-widest border ${getPriorityStyle(isEditing ? editTaskData.priority : selectedTask.priority)}`}>
                    {formatText(isEditing ? editTaskData.priority : selectedTask.priority)}
                  </span>
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-widest ${getStatusStyle(selectedTask.status)}`}>
                    {formatText(selectedTask.status)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <History size={11} />
                  <span className="text-[9px] font-black uppercase tracking-widest">{formatDate(selectedTask.createdAt)}</span>
                </div>
              </div>
              <div className="flex gap-2">
                {isManager && (
                  <>
                    <button 
                      type="button"
                      onClick={(e) => openDeleteModal(e, selectedTask.id)} 
                      className={`p-3 rounded-2xl transition-all ${dark ? 'bg-white/5 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}
                      title="Eliminar Tarea"
                    >
                      <Trash2 size={20} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsEditing(!isEditing)} 
                      className={`p-3 rounded-2xl transition-all ${isEditing ? 'bg-amber-500 text-white shadow-lg' : (dark ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}`}
                      title="Editar Tarea"
                    >
                      <Edit3 size={20} />
                    </button>
                  </>
                )}
                <button onClick={() => { setIsDetailModalOpen(false); setIsEditing(false); }} className={`p-3 rounded-2xl transition-all ${dark ? 'bg-white/5 text-gray-400 hover:bg-red-500/20 hover:text-red-500' : 'bg-gray-100 text-gray-500 hover:bg-red-500/10 hover:text-red-500'}`}><X size={20} /></button>
              </div>
            </div>

            <form onSubmit={handleUpdateTask}>
              <div className="mb-8">
                {isEditing ? (
                  <input type="text" value={editTaskData.title} onChange={(e) => setEditTaskData({...editTaskData, title: e.target.value})} className={`w-full text-3xl font-black bg-transparent border-b-2 border-white/10 focus:border-white/30 focus:outline-none mb-1 pb-1 ${dark ? 'text-white' : 'text-slate-900'}`} />
                ) : (
                  <h2 className="text-3xl font-black leading-tight tracking-tight mb-1" style={{ color: cardStyle.text }}>{selectedTask.title}</h2>
                )}
                <div className="h-1.5 w-16 bg-emerald-500 rounded-full"></div>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-8">
                <div className="space-y-6">
                  <div className="flex items-center gap-4 h-12">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/10"><Calendar className="text-emerald-500" size={22} /></div>
                    <div className="flex flex-col flex-1">
                      <p className="text-xs font-black uppercase tracking-wider text-emerald-500 leading-none mb-1.5">Fecha Límite</p>
                      {isEditing ? (
                        <div className="flex gap-1 items-center">
                          <input type="date" value={editTaskData.dueDateOnly} onChange={(e) => setEditTaskData({...editTaskData, dueDateOnly: e.target.value})} className={editInputClasses} />
                          <div className="flex items-center gap-1">
                            <input type="time" value={editTaskData.dueTimeOnly} onChange={(e) => setEditTaskData({...editTaskData, dueTimeOnly: e.target.value})} className={`${editInputClasses} w-16`} />
                            {editTaskData.dueTimeOnly && (
                              <button type="button" onClick={() => setEditTaskData({...editTaskData, dueTimeOnly: ''})} className="p-1 rounded-md hover:bg-red-500/10 text-red-400 transition-all"><X size={12}/></button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className={`text-sm font-bold leading-none ${isOverdue(selectedTask.dueDate) && selectedTask.status !== 'COMPLETADA' ? 'text-red-500' : ''}`} style={{ color: !isOverdue(selectedTask.dueDate) || selectedTask.status === 'COMPLETADA' ? cardStyle.sub : undefined }}>
                          {formatDate(selectedTask.dueDate) || 'Sin fecha asignada'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 h-12">
                    <div className="w-11 h-11 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/10"><UserIcon className="text-blue-500" size={22} /></div>
                    <div className="flex flex-col flex-1">
                      <p className="text-xs font-black uppercase tracking-wider text-blue-500 leading-none mb-1.5">Responsable</p>
                      {isEditing ? (
                        <select value={editTaskData.assignedToId} onChange={(e) => setEditTaskData({...editTaskData, assignedToId: e.target.value})} className={`${editInputClasses} w-full`}>
                          <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} value="">Sin asignar</option>
                          {employees.map(emp => <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} key={emp.id} value={emp.id}>{emp.name}</option>)}
                        </select>
                      ) : (
                        <p className="text-sm font-bold leading-none" style={{ color: cardStyle.sub }}>{selectedTask.assignedTo?.name || 'Sin asignar'}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="flex items-center gap-4 h-12">
                    <div className="w-11 h-11 rounded-2xl bg-orange-500/10 flex items-center justify-center shrink-0 border border-orange-500/10"><MapPin className="text-orange-500" size={22} /></div>
                    <div className="flex flex-col flex-1">
                      <p className="text-xs font-black uppercase tracking-wider text-orange-500 leading-none mb-1.5">Ubicación</p>
                      {isEditing ? (
                        <div className="flex gap-1">
                          <select value={editSelectedFloor} onChange={(e) => { setEditSelectedFloor(e.target.value); setEditTaskData({...editTaskData, roomId: ''}); }} className={`${editInputClasses} w-14`}>
                            <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} value="ALL">Piso</option>
                            {floors.map(f => (<option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} key={f} value={f}>P{f}</option>))}
                          </select>
                          <select value={editTaskData.roomId} onChange={(e) => setEditTaskData({...editTaskData, roomId: e.target.value})} className={`${editInputClasses} flex-1`}>
                            <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} value="">Hab</option>
                            {roomsOnEditSelectedFloor.map(r => <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} key={r.id} value={r.id}>{r.number}</option>)}
                          </select>
                        </div>
                      ) : (
                        <p className="text-sm font-bold leading-none" style={{ color: cardStyle.sub }}>{selectedTask.room ? `Habitación ${selectedTask.room.number}` : 'General'}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 h-12">
                    <div className="w-11 h-11 rounded-2xl bg-purple-500/10 flex items-center justify-center shrink-0 border border-purple-500/10"><Tag className="text-purple-500" size={22} /></div>
                    <div className="flex flex-col flex-1">
                      <p className="text-xs font-black uppercase tracking-wider text-purple-500 leading-none mb-1.5">Importancia</p>
                      {isEditing ? (
                        <select value={editTaskData.priority} onChange={(e) => setEditTaskData({...editTaskData, priority: e.target.value})} className={`${editInputClasses} w-full`}>
                          <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} value="BAJA">Baja</option>
                          <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} value="MEDIA">Media</option>
                          <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} value="ALTA">Alta</option>
                          <option className={dark ? "bg-slate-900 text-white" : "bg-white text-slate-900"} value="URGENTE">Urgente</option>
                        </select>
                      ) : (
                        <p className="text-sm font-bold leading-none" style={{ color: cardStyle.sub }}>{formatText(selectedTask.priority)}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className={`p-6 rounded-[2rem] border relative transition-colors h-36 ${dark ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100 shadow-inner'}`}>
                <p className="text-xs font-black uppercase tracking-wider text-gray-500 leading-none mb-3">Descripción de la tarea</p>
                {isEditing ? (
                  <textarea rows="3" value={editTaskData.description} onChange={(e) => setEditTaskData({...editTaskData, description: e.target.value})} className={`w-full text-sm leading-relaxed bg-transparent border-none focus:outline-none resize-none p-0 ${dark ? 'text-white placeholder:text-gray-600' : 'text-slate-900'}`} placeholder="Detalles..." />
                ) : (
                  <p className="text-sm leading-relaxed" style={{ color: cardStyle.text }}>
                    {selectedTask.description || 'No se han proporcionado detalles adicionales.'}
                  </p>
                )}
              </div>

              {isEditing && (
                <button type="submit" className="w-full mt-6 bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-3">
                  <Save size={20} /> Guardar Cambios
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Modales AI y Delete */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setIsDeleteModalOpen(false)} />
          <div className="relative w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-red-500/20" style={{ background: dark ? '#0f172a' : '#fff' }}>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
                <AlertTriangle size={32} className="text-red-500" />
              </div>
              <h2 className="text-xl font-black mb-2" style={{ color: cardStyle.text }}>¿Eliminar tarea?</h2>
              {taskToDelete && tasks.find(t => t.id === taskToDelete) && (
                <p className="text-xs font-bold mb-6 px-4 py-2 rounded-xl bg-red-500/5 border border-red-500/10 text-red-400">
                  "{tasks.find(t => t.id === taskToDelete)?.title}"
                </p>
              )}
              <p className="text-xs mb-6" style={{ color: cardStyle.sub }}>Esta acción no se puede deshacer.</p>
              <div className="grid grid-cols-2 gap-3 w-full">
                <button onClick={() => setIsDeleteModalOpen(false)} className={`py-4 rounded-2xl font-bold text-xs uppercase transition-all ${dark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Cancelar</button>
                <button onClick={confirmDeleteTask} className="bg-red-500 hover:bg-red-600 text-white py-4 rounded-2xl font-black text-xs uppercase transition-all active:scale-95">Eliminar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAiModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsAiModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-3xl p-8 shadow-2xl border border-emerald-500/30 overflow-hidden" style={{ background: dark ? '#0d1f14' : '#fff' }}>
            <div className="relative z-10 text-center">
              <h2 className="text-xl font-black mb-6" style={{ color: cardStyle.text }}>Sugerencia IA</h2>
              {isAiLoading ? <Loader2 className="animate-spin text-emerald-500 mx-auto" size={48} /> : (
                <div className="space-y-6">
                  <p className="text-sm" style={{ color: cardStyle.text }}>La mejor opción es: <strong>{aiSuggestion?.employeeName}</strong></p>
                  <p className="text-xs italic" style={{ color: cardStyle.sub }}>{aiSuggestion?.reasoning}</p>
                  <button onClick={confirmAiAssignment} className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black shadow-lg shadow-emerald-500/30">Confirmar</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
