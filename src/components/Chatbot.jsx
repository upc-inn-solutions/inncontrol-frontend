import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, User as UserIcon, Maximize2, Minimize2, Trash2, Bell, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { api } from '../lib/axios';
import { useThemeStore } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export default function Chatbot() {
  const { dark } = useThemeStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [assistant, setAssistant] = useState(null);
  const [confirmModal, setConfirmModal] = useState(false);
  const messagesEndRef = useRef(null);
  const stompClient = useRef(null);

  // Fetch Assistant user info
  useEffect(() => {
    const fetchAssistant = async () => {
      try {
        const res = await api.get('/users/search?name=InnControl Assistant');
        if (res.data && res.data.length > 0) {
          setAssistant(res.data[0]);
        }
      } catch (err) {
        console.error("Error fetching assistant info", err);
      }
    };
    fetchAssistant();
  }, []);

  // WebSocket for real-time sync
  useEffect(() => {
    if (!user?.id || !assistant) return;

    const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:8080/ws';
    const socket = new SockJS(wsUrl);
    const client = new Client({
      webSocketFactory: () => socket,
      onConnect: () => {
        client.subscribe(`/user/${user.id}/queue/messages`, (message) => {
          const msg = JSON.parse(message.body);
          // Solo si es un mensaje del asistente o mio para el asistente
          const isFromAssistant = msg.sender?.id === assistant.id || msg.senderId === assistant.id;
          const isToAssistant = msg.receiver?.id === assistant.id || msg.receiverId === assistant.id;
          
          if (isFromAssistant || isToAssistant) {
            // Ignorar mensajes de sistema en el chatbot flotante
            if (msg.type === 'SYSTEM_TASK' || msg.msgType === 'SYSTEM_TASK') return;

            setMessages(prev => {
              if (prev.some(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            if (isFromAssistant) setIsTyping(false);
          }
        });
      },
    });

    client.activate();
    stompClient.current = client;

    // Escuchar mensajes globales interceptados por Messages.jsx (por si STOMP enruta a la otra sesión)
    const handleGlobalMessage = (e) => {
      const msg = e.detail;
      const isFromAssistant = msg.sender?.id === assistant.id || msg.senderId === assistant.id;
      const isToAssistant = msg.receiver?.id === assistant.id || msg.receiverId === assistant.id;
      
      if (isFromAssistant || isToAssistant) {
        if (msg.type === 'SYSTEM_TASK' || msg.msgType === 'SYSTEM_TASK') return;
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (isFromAssistant) setIsTyping(false);
      }
    };
    window.addEventListener('inncontrol-new-message', handleGlobalMessage);

    return () => {
      if (stompClient.current) stompClient.current.deactivate();
      window.removeEventListener('inncontrol-new-message', handleGlobalMessage);
    };
  }, [user?.id, assistant]);

  const fetchHistory = useCallback(async () => {
    if (!user?.id || !assistant?.id) return;
    try {
      const res = await api.get(`/messages/history?userId1=${user.id}&userId2=${assistant.id}`);
      // Filter out system task messages for the chatbot bubble to keep it clean (chat only)
      const chatOnly = res.data.filter(m => m.type !== 'SYSTEM_TASK' && m.msgType !== 'SYSTEM_TASK');

      // Si no hay mensajes previos, enviar el saludo inicial como mensaje real
      if (chatOnly.length === 0) {
        await api.post('/messages/send', {
          senderId: assistant.id,
          receiverId: user.id,
          content: '¡Hola! Soy tu asistente de InnControl. ¿En qué puedo ayudarte hoy?'
        });
        // Volver a cargar para obtener el mensaje recién creado
        const res2 = await api.get(`/messages/history?userId1=${user.id}&userId2=${assistant.id}`);
        const chatOnly2 = res2.data.filter(m => m.type !== 'SYSTEM_TASK' && m.msgType !== 'SYSTEM_TASK');
        setMessages(chatOnly2);
      } else {
        setMessages(chatOnly);
      }
    } catch (err) {
      console.error("Error fetching chat history", err);
    }
  }, [user?.id, assistant?.id]);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, fetchHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !user?.id || !assistant?.id) return;

    const text = input.trim();
    setInput('');
    setIsTyping(true);

    // Mostrar el mensaje del usuario inmediatamente (sin esperar al WebSocket)
    const optimisticMsg = {
      id: `temp-${Date.now()}`,
      content: text,
      sender: { id: user.id },
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const res = await api.post('/messages/send', {
        senderId: user.id,
        receiverId: assistant.id,
        content: text
      });
      // Reemplazar el mensaje optimista con el real del servidor
      setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? res.data : m));
      
      // La respuesta del IA se genera secuencialmente en el backend, por lo que 
      // al terminar esta petición, el mensaje del IA ya está en la base de datos.
      await fetchHistory();
      setIsTyping(false);
    } catch (err) {
      console.error("Error sending message to AI", err);
      setIsTyping(false);
    }
  };

  const clearHistory = () => {
    if (!user?.id || !assistant?.id) return;
    setConfirmModal(true);
  };

  const doDeleteHistory = async () => {
    setConfirmModal(false);
    try {
      await api.delete(`/messages/clear-history?userId=${user.id}&contactId=${assistant.id}`);
      await fetchHistory(); // Await para asegurar que el saludo se cree antes de notificar
      // Notificar a Messages.jsx para que también actualice su estado
      window.dispatchEvent(new CustomEvent('inncontrol-assistant-cleared'));
    } catch (err) {
      console.error("Error clearing history", err);
    }
  };

  // Escuchar cuando Messages.jsx limpia el historial del Asistente
  useEffect(() => {
    const handleCleared = () => fetchHistory();
    window.addEventListener('inncontrol-assistant-cleared', handleCleared);
    return () => window.removeEventListener('inncontrol-assistant-cleared', handleCleared);
  }, [fetchHistory]);


  const goToFullChat = () => {
    setIsOpen(false);
    navigate('/messages?chat=assistant');
  };

  if (!user) return null;

  const chatBg   = dark ? '#0d1a14' : '#fff';
  const msgBg    = dark ? 'rgba(255,255,255,0.04)' : '#f8fafc';
  const inputBg  = dark ? 'rgba(255,255,255,0.06)' : '#f1f5f9';
  const inputBorder = dark ? 'rgba(255,255,255,0.1)' : '#e2e8f0';
  const aiBubble = dark ? 'rgba(255,255,255,0.07)' : '#fff';
  const aiText   = dark ? '#e2e8f0' : '#1e293b';

  return (
    <>
      {/* Custom Confirm Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmModal(false)} />
          <div
            className="relative w-full max-w-sm rounded-[2rem] p-7 shadow-2xl border animate-in fade-in zoom-in duration-200"
            style={{
              background: dark ? '#0d1f14' : '#ffffff',
              borderColor: dark ? 'rgba(16,185,129,0.25)' : '#e2e8f0'
            }}
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <Trash2 size={26} className="text-red-400" />
              </div>
              <div>
                <p className="font-black text-base mb-1" style={{ color: dark ? '#f1f5f9' : '#0f172a' }}>¿Borrar historial?</p>
                <p className="text-xs leading-relaxed" style={{ color: dark ? '#94a3b8' : '#64748b' }}>
                  Esta acción eliminará toda la conversación con el Asistente. No se puede deshacer.
                </p>
              </div>
              <div className="flex gap-3 w-full mt-1">
                <button
                  onClick={() => setConfirmModal(false)}
                  className="flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                  style={{ background: dark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', color: dark ? '#94a3b8' : '#64748b' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={doDeleteHistory}
                  className="flex-1 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-red-500/20"
                >
                  Borrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* FAB button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center transition-all duration-300"
        style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg, #059669, #10b981)',
          boxShadow: '0 4px 20px rgba(16,185,129,0.4)',
          transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
        }}
        title={isOpen ? 'Cerrar chat' : 'Abrir asistente IA'}
      >
        {isOpen ? <X size={24} color="#fff" /> : <Bot size={26} color="#fff" />}
      </button>

      {/* Chat window */}
      <div
        className={`fixed bottom-24 right-4 md:right-6 rounded-3xl flex flex-col z-40 overflow-hidden transition-all duration-300 origin-bottom-right shadow-2xl`}
        style={{
          width: isOpen ? (isExpanded ? '600px' : '384px') : '0px',
          maxHeight: 'calc(100vh - 120px)',
          height: isOpen ? (isExpanded ? '600px' : '480px') : '0px',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'all' : 'none',
          background: chatBg,
          border: `1px solid ${dark ? 'rgba(16,185,129,0.2)' : '#e2e8f0'}`,
          boxShadow: dark ? '0 20px 50px rgba(0,0,0,0.5)' : '0 20px 50px rgba(0,0,0,0.12)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ background: 'linear-gradient(135deg,#064e3b,#065f46)', borderBottom: '1px solid rgba(16,185,129,0.2)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.35)' }}>
              <Bot size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">InnControl Assistant</p>
              <p className="text-[10px] flex items-center gap-1.5" style={{ color: '#34d399' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                SISTEMA
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={clearHistory}
              className="p-1.5 rounded-lg transition-colors hover:bg-white/10 text-emerald-300"
              title="Borrar historial">
              <Trash2 size={16} />
            </button>
            <button onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg transition-colors hover:bg-white/10 text-emerald-300"
              title={isExpanded ? "Reducir" : "Ampliar"}>
              {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button onClick={goToFullChat}
              className="p-1.5 rounded-lg transition-colors hover:bg-white/10 text-emerald-300"
              title="Ir a mensajería">
              <ExternalLink size={16} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar" style={{ background: msgBg }}>
          {messages.length === 0 && !isTyping && (
             <div className="h-full flex flex-col justify-center items-center opacity-40 text-center px-6">
                <Bot size={40} className="text-emerald-500 mb-4" />
                <p className="text-xs font-bold leading-relaxed" style={{ color: aiText }}>
                  ¡Hola! Soy tu asistente de InnControl.<br/>¿En qué puedo ayudarte hoy?
                </p>
             </div>
          )}
          {messages.map(msg => {
            const isMe = msg.sender?.id === user.id || msg.senderId === user.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex gap-2 max-w-[85%] ${isMe ? 'flex-row-reverse' : ''}`}>
                  <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center"
                    style={{ background: isMe ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)' }}>
                    {isMe ? <UserIcon size={14} className="text-emerald-400" /> : <Bot size={14} className="text-emerald-400" />}
                  </div>
                  <div className={`px-3 py-2.5 rounded-2xl text-sm leading-relaxed ${!isMe ? 'whitespace-normal' : 'whitespace-pre-wrap'}`}
                    style={{
                      background: isMe ? 'linear-gradient(135deg,#059669,#10b981)' : aiBubble,
                      color: isMe ? '#fff' : aiText,
                      border: !isMe ? `1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}` : 'none',
                      borderTopLeftRadius: !isMe ? 4 : undefined,
                      borderTopRightRadius: isMe ? 4 : undefined,
                    }}>
                    {!isMe ? (
                      <div className="markdown-content">
                        <ReactMarkdown>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
                  <Bot size={14} className="text-emerald-400" />
                </div>
                <div className="px-4 py-3 rounded-2xl flex gap-1.5 items-center" style={{ background: aiBubble, border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}` }}>
                  {[0,0.2,0.4].map((d,i) => (
                    <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#10b981', animationDelay: `${d}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 shrink-0" style={{ background: chatBg, borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}` }}>
          <form onSubmit={handleSend} className="flex gap-2">
            <input type="text" value={input} onChange={e => setInput(e.target.value)}
              placeholder="Pregunta sobre tareas o habitaciones..."
              className="flex-1 text-sm px-4 py-2.5 rounded-xl focus:outline-none transition-all"
              style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: dark ? '#f1f5f9' : '#0f172a' }} />
            <button type="submit" disabled={!input.trim() || isTyping}
              className="px-3 py-2 rounded-xl flex items-center justify-center transition-colors disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#059669,#10b981)', color: '#fff' }}>
              <Send size={17} />
            </button>
          </form>
          <div className="flex items-center justify-center mt-1.5 cursor-default select-none">
            <span className="text-[12px] font-semibold opacity-60 hover:opacity-100 transition-opacity" style={{ color: dark ? '#94a3b8' : '#64748b' }}>
              Gemini 2.5 Flash
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
