import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { Mail, KeyRound, Loader2, User, Eye, EyeOff, Briefcase, ArrowRight, Sun, Moon, Hotel } from 'lucide-react';


function Field({ label, type = 'text', value, onChange, placeholder, icon: Icon, required, right, dark }) {
  const [focused, setFocused] = useState(false);
  const accent = '#34d399';
  const borderColor = focused ? 'rgba(52,211,153,0.55)' : dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
  const bg = focused
    ? (dark ? 'rgba(16,185,129,0.07)' : 'rgba(16,185,129,0.05)')
    : (dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)');

  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-widest mb-2 transition-colors duration-200"
        style={{ color: focused ? accent : dark ? '#64748b' : '#94a3b8' }}>
        {label}
      </label>
      <div className="relative rounded-xl transition-all duration-300"
        style={{ background: bg, border: `1.5px solid ${borderColor}`,
          boxShadow: focused ? `0 0 18px rgba(16,185,129,0.1)` : 'none' }}>
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"
          style={{ color: focused ? accent : dark ? '#475569' : '#94a3b8' }}>
          <Icon size={16} />
        </div>
        <input type={type} value={value} onChange={onChange} placeholder={placeholder}
          required={required} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          className="w-full bg-transparent text-sm py-3.5 pl-11 pr-11 focus:outline-none"
          style={{ color: dark ? '#f1f5f9' : '#0f172a', caretColor: accent }}
        />
        {right && <div className="absolute inset-y-0 right-0 pr-4 flex items-center">{right}</div>}
      </div>
    </div>
  );
}

export default function Login() {
  const { dark, toggleTheme } = useThemeStore();
  const [tab, setTab] = useState('login');
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('ROLE_GERENTE');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [formError, setFormError] = useState('');
  const [angle, setAngle] = useState(0);
  const { login, register, isLoading, error } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const id = setInterval(() => setAngle(a => (a + 1.2) % 360), 40);
    return () => clearInterval(id);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault(); setFormError('');
    if (tab === 'register') {
      if (step === 1) { setStep(2); return; }
      if (password !== confirmPassword) { setFormError('Las contraseñas no coinciden.'); return; }
      const ok = await register(`${firstName} ${lastName}`.trim(), email, password, role);
      if (ok) navigate('/dashboard');
    } else {
      const ok = await login(email, password);
      if (ok) navigate('/dashboard');
    }
  };

  const switchTab = (t) => { setTab(t); setStep(1); setFormError(''); };

  const eyeBtn = (
    <button type="button" onClick={() => setShowPw(!showPw)}
      className="transition-colors" style={{ color: dark ? '#475569' : '#94a3b8' }}
      onMouseEnter={e => e.currentTarget.style.color = '#34d399'}
      onMouseLeave={e => e.currentTarget.style.color = dark ? '#475569' : '#94a3b8'}>
      {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
    </button>
  );

  // Theme tokens
  const bg = dark
    ? 'radial-gradient(ellipse at 65% 15%, #041a11 0%, #030c16 50%, #01000a 100%)'
    : 'radial-gradient(ellipse at 65% 15%, #ecfdf5 0%, #f0f9ff 50%, #f8fafc 100%)';
  const cardBg = dark ? 'rgba(4,12,22,0.96)' : 'rgba(255,255,255,0.97)';
  const textPrimary = dark ? '#f1f5f9' : '#0f172a';
  const textSub = dark ? '#64748b' : '#94a3b8';
  const tabInactive = dark ? '#475569' : '#94a3b8';
  const tabBg = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
  const tabBorder = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden transition-all duration-500 p-4"
      style={{ background: bg }}>

      {/* Ambient orbs */}
      {dark && <>
        <div className="absolute pointer-events-none" style={{ width: 700, height: 700, top: '-20%', left: '-12%',
          background: 'radial-gradient(circle, #10b981 0%, transparent 65%)', filter: 'blur(60px)', opacity: 0.14,
          animation: 'floatA 14s ease-in-out infinite' }} />
        <div className="absolute pointer-events-none" style={{ width: 450, height: 450, bottom: '-12%', right: '-8%',
          background: 'radial-gradient(circle, #14b8a6 0%, transparent 65%)', filter: 'blur(70px)', opacity: 0.1,
          animation: 'floatB 18s ease-in-out infinite' }} />
      </>}
      {!dark && <>
        <div className="absolute pointer-events-none" style={{ width: 600, height: 600, top: '-15%', left: '-10%',
          background: 'radial-gradient(circle, #a7f3d0 0%, transparent 65%)', filter: 'blur(60px)', opacity: 0.5,
          animation: 'floatA 14s ease-in-out infinite' }} />
        <div className="absolute pointer-events-none" style={{ width: 400, height: 400, bottom: '-10%', right: '-5%',
          background: 'radial-gradient(circle, #bae6fd 0%, transparent 65%)', filter: 'blur(60px)', opacity: 0.4,
          animation: 'floatB 18s ease-in-out infinite' }} />
      </>}

      {/* Dot grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle, ${dark ? 'rgba(16,185,129,0.07)' : 'rgba(16,185,129,0.12)'} 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
      }} />

      {/* Theme toggle */}
      <button onClick={toggleTheme}
        className="absolute top-5 right-5 z-20 flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold transition-all duration-300"
        style={{
          background: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
          border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
          color: dark ? '#94a3b8' : '#64748b',
          backdropFilter: 'blur(12px)',
        }}>
        {dark
          ? <Sun size={18} className="text-yellow-400" />
          : <Moon size={18} className="text-indigo-500" />}
      </button>

      {/* Card with rotating border */}
      <div className="relative z-10 p-px rounded-3xl w-full" style={{
        maxWidth: 460,
        background: `conic-gradient(from ${angle}deg, #10b981, ${dark ? '#0f172a' : '#e2e8f0'} 40%, #10b981 55%, ${dark ? '#0f172a' : '#e2e8f0'} 80%, #10b981)`,
        boxShadow: dark
          ? '0 0 80px rgba(16,185,129,0.1), 0 40px 80px rgba(0,0,0,0.6)'
          : '0 0 60px rgba(16,185,129,0.12), 0 20px 50px rgba(0,0,0,0.12)',
      }}>
        <div className="rounded-3xl p-8 sm:p-10 transition-colors duration-500" style={{ background: cardBg, backdropFilter: 'blur(40px)' }}>

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{
                  background: dark ? 'linear-gradient(135deg, #064e3b, #065f46)' : 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
                  boxShadow: dark ? '0 0 32px rgba(16,185,129,0.4), inset 0 1px 0 rgba(52,211,153,0.2)' : '0 0 20px rgba(16,185,129,0.2)',
                  border: `1px solid ${dark ? 'rgba(52,211,153,0.3)' : 'rgba(16,185,129,0.25)'}`,
                }}>
                <Hotel size={32} className="text-emerald-500" />
              </div>
              {/* Pulse ring */}
              <div className="absolute inset-0 rounded-2xl" style={{
                border: '2px solid rgba(52,211,153,0.4)',
                animation: 'pulseRing 2.8s ease-out infinite',
              }} />
            </div>
            <h1 className="text-2xl font-black tracking-tight transition-colors duration-300" style={{ color: textPrimary }}>
              InnControl
            </h1>
            <p className="text-xs mt-1.5 font-bold tracking-[0.22em] uppercase" style={{ color: '#34d399' }}>
              Gestión Hotelera Inteligente
            </p>
          </div>

          {/* Tabs */}
          <div className="flex mb-7 p-1 rounded-xl gap-1"
            style={{ background: tabBg, border: `1px solid ${tabBorder}` }}>
            {[{ id: 'login', label: 'Iniciar Sesión' }, { id: 'register', label: 'Registrarse' }].map(t => (
              <button key={t.id} type="button" onClick={() => switchTab(t.id)}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-300"
                style={{
                  background: tab === t.id ? 'linear-gradient(135deg, #059669, #10b981)' : 'transparent',
                  color: tab === t.id ? '#fff' : tabInactive,
                  boxShadow: tab === t.id ? '0 4px 15px rgba(16,185,129,0.3)' : 'none',
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Step progress */}
          {tab === 'register' && (
            <div className="flex items-center gap-2 mb-6">
              {[1, 2].map((s, i) => (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300"
                    style={{
                      background: s <= step ? 'linear-gradient(135deg,#059669,#10b981)' : (dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                      color: s <= step ? '#fff' : tabInactive,
                      border: s === step ? '2px solid rgba(52,211,153,0.6)' : '2px solid transparent',
                      boxShadow: s === step ? '0 0 14px rgba(16,185,129,0.35)' : 'none',
                    }}>
                    {s < step ? '✓' : s}
                  </div>
                  <span className="text-xs font-semibold" style={{ color: s <= step ? (dark ? '#94a3b8' : '#64748b') : (dark ? '#334155' : '#cbd5e1') }}>
                    {s === 1 ? 'Datos personales' : 'Credenciales'}
                  </span>
                  {i < 1 && <div className="h-px flex-1 ml-1 rounded-full transition-all duration-500"
                    style={{ background: step > 1 ? '#10b981' : (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)') }} />}
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {(error || formError) && (
            <div className="mb-5 p-3.5 rounded-xl text-sm flex items-center gap-2 font-medium"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
              ⚠️ {formError || error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'login' && (<>
              <Field label="Correo Electrónico" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="gerente@hotel.com" icon={Mail} required dark={dark} />
              <Field label="Contraseña" type={showPw ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)} placeholder="••••••••" icon={KeyRound} required right={eyeBtn} dark={dark} />
            </>)}

            {tab === 'register' && step === 1 && (<>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre" value={firstName} onChange={e => setFirstName(e.target.value)}
                  placeholder="Juan" icon={User} required dark={dark} />
                <Field label="Apellido" value={lastName} onChange={e => setLastName(e.target.value)}
                  placeholder="Pérez" icon={User} required dark={dark} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: dark ? '#64748b' : '#94a3b8' }}>
                  Rol en la Plataforma
                </label>
                <div className="relative rounded-xl transition-all duration-300"
                  style={{ background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', border: `1.5px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'}` }}>
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none" style={{ color: dark ? '#475569' : '#94a3b8' }}>
                    <Briefcase size={16} />
                  </div>
                  <select value={role} onChange={e => setRole(e.target.value)}
                    className="w-full bg-transparent text-sm py-3.5 pl-11 pr-4 focus:outline-none appearance-none cursor-pointer"
                    style={{ color: dark ? '#f1f5f9' : '#0f172a' }}>
                    <option className="bg-slate-900 text-white" value="ROLE_GERENTE">👔 Gerente General</option>
                    <option className="bg-slate-900 text-white" value="ROLE_EMPLEADO">👷 Empleado / Staff</option>
                  </select>
                </div>
              </div>
            </>)}

            {tab === 'register' && step === 2 && (<>
              <Field label="Correo Electrónico" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="juan@hotel.com" icon={Mail} required dark={dark} />
              <Field label="Contraseña" type={showPw ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)} placeholder="••••••••" icon={KeyRound} required right={eyeBtn} dark={dark} />
              <Field label="Confirmar Contraseña" type={showPw ? 'text' : 'password'} value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" icon={KeyRound} required right={eyeBtn} dark={dark} />
            </>)}

            {tab === 'register' && step === 2 && (
              <button type="button" onClick={() => setStep(1)}
                className="text-xs font-semibold transition-colors" style={{ color: textSub }}>
                ← Volver al paso 1
              </button>
            )}

            <button type="submit" disabled={isLoading}
              className="w-full relative overflow-hidden flex items-center justify-center gap-2 py-4 rounded-xl font-extrabold text-sm tracking-wide transition-all duration-300 mt-2 group disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#059669 0%,#10b981 50%,#34d399 100%)',
                boxShadow: '0 4px 28px rgba(16,185,129,0.32)', color: '#fff', backgroundSize: '200% 100%' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 40px rgba(16,185,129,0.55)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 28px rgba(16,185,129,0.32)'; }}>
              <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"
                style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)' }} />
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : <>
                {tab === 'login' ? 'Acceder al sistema' : step === 1 ? 'Continuar' : 'Crear mi cuenta'}
                <ArrowRight size={18} />
              </>}
            </button>
          </form>

          <p className="text-center mt-6 text-sm" style={{ color: textSub }}>
            {tab === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
            <button type="button" onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}
              className="font-bold transition-colors" style={{ color: '#34d399' }}
              onMouseEnter={e => e.target.style.color = '#6ee7b7'}
              onMouseLeave={e => e.target.style.color = '#34d399'}>
              {tab === 'login' ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes floatA { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(25px,-18px) scale(1.04)} 66%{transform:translate(-15px,12px) scale(0.97)} }
        @keyframes floatB { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-20px,-25px)} }
        @keyframes pulseRing { 0%{transform:scale(1);opacity:.6} 70%,100%{transform:scale(1.35);opacity:0} }
      `}</style>
    </div>
  );
}
