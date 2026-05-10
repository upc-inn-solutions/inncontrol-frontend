import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { User, Mail, Save, CheckCircle2, Camera, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { compressImage } from '../lib/imageUtils';

export default function Settings() {
  const { user, updateProfile } = useAuthStore();
  const { dark } = useThemeStore();
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    photo: null,
  });

  // Sync with store user
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        nombre: user.name?.split(' ')[0] || '',
        apellido: user.name?.split(' ').slice(1).join(' ') || '',
        email: user.email || '',
        photo: user.photo || null,
      }));
    }
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    
    try {
      const success = await updateProfile({
        name: `${formData.nombre} ${formData.apellido}`.trim(),
        email: formData.email,
        photo: formData.photo
      });
      
      if (success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError("Error al guardar los cambios en el servidor. La imagen podría ser demasiado grande.");
      }
    } catch (err) {
      setError("Error de conexión con el servidor.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const compressedBase64 = await compressImage(file, 400, 400, 0.6);
        setFormData(prev => ({ ...prev, photo: compressedBase64 }));
      } catch (err) {
        setError("Error al procesar la imagen.");
      }
    }
  };

  const cardStyle = dark 
    ? { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', text: '#f1f5f9', sub: '#94a3b8' }
    : { bg: '#fff', border: '#e2e8f0', text: '#0f172a', sub: '#64748b' };

  const inputClasses = `w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all ${
    dark 
      ? 'bg-slate-900 border-white/10 text-white placeholder:text-slate-600' 
      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'
  }`;

  return (
    <div className="max-w-[1600px] mx-auto pb-20 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight" style={{ color: cardStyle.text }}>Ajustes del Sistema</h1>
        <p className="text-sm mt-1" style={{ color: cardStyle.sub }}>Gestiona tu cuenta y preferencias personales.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-64 space-y-2">
          <button
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all bg-emerald-500 text-white shadow-lg shadow-emerald-500/20`}
          >
            <User size={18} />
            Perfil Personal
          </button>
        </aside>

        <div className="flex-1 p-8 rounded-[2.5rem]" style={{ background: cardStyle.bg, border: `1px solid ${cardStyle.border}` }}>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="flex items-center gap-6 mb-8">
              <div className="relative group">
                <div className="w-24 h-24 rounded-3xl bg-emerald-500/10 flex items-center justify-center border-2 border-emerald-500/20 overflow-hidden shadow-inner">
                  {formData.photo ? (
                    <img src={formData.photo} alt="Perfil" className="w-full h-full object-cover" />
                  ) : (
                    <User size={48} className="text-emerald-500" />
                  )}
                </div>
                <button 
                  type="button"
                  onClick={() => fileInputRef.current.click()}
                  className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-2.5 rounded-xl shadow-lg hover:scale-110 transition-transform z-10"
                >
                  <Camera size={16} />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handlePhotoChange} 
                />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight" style={{ color: cardStyle.text }}>Foto de Perfil</h3>
                <p className="text-xs font-bold mt-1" style={{ color: cardStyle.sub }}>Formato JPG o PNG.</p>
                <div className="flex gap-4 items-center mt-3">
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current.click()}
                    className="text-[10px] font-black uppercase tracking-widest text-emerald-500 hover:underline flex items-center gap-2"
                  >
                    <Camera size={12} />
                    Subir nueva foto
                  </button>
                  {formData.photo && (
                    <button 
                      type="button" 
                      onClick={() => setFormData(prev => ({ ...prev, photo: null }))}
                      className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-500 hover:underline flex items-center gap-2"
                    >
                      <Trash2 size={12} />
                      Eliminar foto
                    </button>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-500 text-[10px] font-black uppercase tracking-wider">
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: cardStyle.sub }}>Nombre</label>
                <input 
                  type="text" 
                  value={formData.nombre}
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                  className={inputClasses}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: cardStyle.sub }}>Apellido</label>
                <input 
                  type="text" 
                  value={formData.apellido}
                  onChange={(e) => setFormData({...formData, apellido: e.target.value})}
                  className={inputClasses}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: cardStyle.sub }}>Correo Electrónico</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="email" 
                  disabled
                  value={formData.email}
                  className={`${inputClasses} pl-12 opacity-50 cursor-not-allowed font-bold`}
                />
              </div>
            </div>

            <div className="pt-6 flex items-center justify-between border-t border-white/5">
              <button 
                type="submit" 
                disabled={isSaving}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 transition-all active:scale-95 shadow-lg shadow-emerald-500/25 disabled:opacity-70"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
              
              {saved && (
                <div className="flex items-center gap-2 text-emerald-500 font-black text-[10px] uppercase tracking-widest animate-in fade-in slide-in-from-left-2">
                  <CheckCircle2 size={18} />
                  ¡Cambios guardados!
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
