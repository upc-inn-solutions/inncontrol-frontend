import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import {
  Send, User as UserIcon, Search, Loader2, MessageSquare,
  Check, CheckCheck, Pin, PinOff, Users, Plus, X,
  Filter, Bell, MoreVertical, Trash2, Eraser, ChevronUp, ChevronDown, CheckCircle2, AlertTriangle, LogOut, Shield, UserMinus, UserPlus, ShieldPlus, ShieldMinus,
  Copy, CornerUpLeft, BrainCircuit, Sparkles, Camera
} from 'lucide-react';
import { Bot } from 'lucide-react';
import { api } from '../lib/axios';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { compressImage } from '../lib/imageUtils';
import ReactMarkdown from 'react-markdown';

export default function Messages() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { dark } = useThemeStore();
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [msgSearchTerm, setMsgSearchTerm] = useState('');
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [filterUnread, setFilterUnread] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [filterType, setFilterType] = useState('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [activeMessageMenu, setActiveMessageMenu] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [showPinnedBar, setShowPinnedBar] = useState(true);
  const [activeAssistantTab, setActiveAssistantTab] = useState('chat'); // 'chat' or 'updates'
  const [hasNewUpdates, setHasNewUpdates] = useState(false);
  
  // Custom Confirmation Modal
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    action: null,
    btnText: '',
    btnColor: 'bg-red-500',
    onCancel: null
  });
  
  // Read By Modal for Groups
  const [readByModal, setReadByModal] = useState({ isOpen: false, users: [] });
  const searchRef = useRef('');
  const stompClient = useRef(null);
  const activeTabRef = useRef(activeAssistantTab);
  const selectedChatRef = useRef(selectedChat);

  useEffect(() => {
    activeTabRef.current = activeAssistantTab;
  }, [activeAssistantTab]);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  // Manejar mensajes entrantes (con useCallback para evitar clausuras obsoletas)
  const handleIncomingMessage = useCallback((msg) => {
    // Notificar globalmente para otros componentes (ej. Chatbot flotante)
    window.dispatchEvent(new CustomEvent('inncontrol-new-message', { detail: msg }));

    const currentSelectedChat = selectedChatRef.current;
    const currentActiveTab = activeTabRef.current;

    // 1. Si es el chat abierto, añadirlo a la lista
    if (currentSelectedChat && (
        (msg.group && msg.group.id === currentSelectedChat.id) || 
        (!msg.group && msg.sender.id === currentSelectedChat.id) ||
        (!msg.group && msg.sender.id === user.id && msg.receiver.id === currentSelectedChat.id)
    )) {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Marcar como leído si el chat está abierto
      if (msg.sender.id !== user.id) {
          api.post(`/messages/read/${msg.sender.id}/${user.id}`).catch(() => {});
      }
    }

    // 2. Actualizar la lista de conversaciones
    setConversations(prev => {
      const updated = prev.map(conv => {
        const isMatch = msg.group 
          ? conv.group && conv.contactId === msg.group.id
          : !conv.group && (conv.contactId === msg.sender.id || conv.contactId === msg.receiver.id);

        if (isMatch) {
          const isFromMe = msg.sender.id === user.id;
          return {
            ...conv,
            lastMessage: msg.content,
            lastMessageTime: msg.createdAt,
            lastMessageIsFromMe: isFromMe,
            lastMessageRead: isFromMe,
            unreadCount: (!isFromMe && (!currentSelectedChat || currentSelectedChat.id !== conv.contactId)) 
              ? conv.unreadCount + 1 
              : conv.unreadCount
          };
        }
        return conv;
      });
      
      // Ordenar: Pinned arriba, luego por tiempo
      return [...updated].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
      });
    });
    // 3. Notificar si es una actualización de tarea y no estamos en la pestaña de actualizaciones
    const isSystemTask = msg.type?.includes('SYSTEM_TASK') || 
                         msg.msgType?.includes('SYSTEM_TASK') || 
                         (msg.content && (msg.content.startsWith('SYSTEM_TASK') || msg.content.startsWith('TASK_EVENT')));
    
    if (isSystemTask && currentActiveTab !== 'updates') {
      setHasNewUpdates(true);
    }
  }, [user.id]);

  // WebSocket Connection
  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:8080/ws';
    console.log("Chatbot: Intentando conectar a WebSocket en:", wsUrl);
    
    if (!wsUrl) {
        console.error("Chatbot: VITE_WS_URL no está definida en las variables de entorno.");
    }
    
    const socket = new SockJS(wsUrl);
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        console.log('Chatbot: Conectado con éxito al WebSocket');
      },
      onDisconnect: () => {
        console.log('Chatbot: Desconectado del WebSocket');
      }
    });

    client.onConnect = () => {
      // Suscribirse a mensajes privados
      client.subscribe(`/user/${user.id}/queue/messages`, (message) => {
        handleIncomingMessage(JSON.parse(message.body));
      });
    };

    client.activate();
    stompClient.current = client;

    return () => {
      if (stompClient.current) stompClient.current.deactivate();
    };
  }, [user.id, handleIncomingMessage]);

  // Suscribirse al grupo seleccionado
  useEffect(() => {
    if (selectedChat?.group && stompClient.current?.active) {
      const subscription = stompClient.current.subscribe(`/topic/group/${selectedChat.id}`, (message) => {
        handleIncomingMessage(JSON.parse(message.body));
      });
      return () => subscription.unsubscribe();
    }
  }, [selectedChat, handleIncomingMessage]);

  // Search state for messages
  const [searchMatches, setSearchMatches] = useState([]);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(-1);

  // Group Modal
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupPhoto, setGroupPhoto] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const groupPhotoInputRef = useRef(null);

  const hasAutoSelected = useRef(false);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const messageRefs = useRef({});

  const showReadBy = (item) => {
    if (!selectedChat?.isGroup || !item.readBy || item.readBy.length === 0) return;
    const readers = item.readBy.filter(u => u.id !== user.id).map(u => u.name);
    if (readers.length > 0) {
      setReadByModal({ isOpen: true, users: readers });
    }
  };

  const renderChecks = (item) => {
    if (!selectedChat?.isGroup) {
      return item.read ? <CheckCheck size={16} className="text-sky-400 drop-shadow-md" /> : <Check size={16} className={`${dark ? 'text-white/40' : 'text-gray-400'} drop-shadow-sm`} />;
    } else {
      if (item.type === 'SYSTEM' || item.msgType === 'SYSTEM') return null;
      
      const groupMemberIds = groupMembers.map(m => m.id).filter(id => id !== user.id);
      const readByIds = item.readBy ? item.readBy.map(u => u.id) : [];
      
      const allRead = groupMemberIds.length > 0 && groupMemberIds.every(id => readByIds.includes(id));
      
      return (
        <div 
          onClick={(e) => { e.stopPropagation(); showReadBy(item); }} 
          className={`cursor-pointer hover:scale-110 transition-transform ${item.readBy?.length > 0 ? 'opacity-100' : 'opacity-80'}`} 
          title="Ver quién lo leyó"
        >
          {allRead ? <CheckCheck size={16} className="text-sky-400 drop-shadow-md" /> : <Check size={16} className={`${dark ? 'text-white/40' : 'text-gray-400'} drop-shadow-sm`} />}
        </div>
      );
    }
  };

  useEffect(() => {
    if (statusMsg.text) {
      const timer = setTimeout(() => setStatusMsg({ type: '', text: '' }), 3000);
      return () => clearTimeout(timer);
    }
  }, [statusMsg]);

  useEffect(() => {
    if (showInfo && selectedChat?.isGroup) {
      fetchGroupMembers();
    }
  }, [showInfo, selectedChat]);

  const fetchGroupMembers = async (isInitial = false) => {
    if (!selectedChat?.id) return;
    if (isInitial) setLoadingMembers(true);
    try {
      const res = await api.get(`/messages/group/members?groupId=${selectedChat.id}`);
      const newData = res.data;
      setGroupMembers(prev => JSON.stringify(prev) === JSON.stringify(newData) ? prev : newData);
    } catch (e) {
      console.error("DEBUG: Error al traer miembros:", e);
    } finally {
      if (isInitial) setLoadingMembers(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    fetchUsersForGroup();

    // Use an interval that checks the latest search term via ref
    const interval = setInterval(() => {
      fetchConversations(searchRef.current);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (conversations.length > 0 && !selectedChat) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('chat') === 'assistant') {
        const assistantConv = conversations.find(c => c.contactName === 'InnControl Assistant');
        if (assistantConv) {
          setSelectedChat({
            id: assistantConv.contactId,
            name: assistantConv.contactName,
            isGroup: assistantConv.contactRole === 'GRUPO'
          });
          // Clean URL without reload
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    }
  }, [conversations, selectedChat]);

  // Escuchar cuando el chatbot flotante limpia el historial del Asistente
  useEffect(() => {
    const handleCleared = () => {
      const currentConv = conversations.find(c => c.contactId === selectedChat?.id);
      if (currentConv?.contactName === 'InnControl Assistant') {
        setMessages([]);
        fetchHistory();
      }
    };
    window.addEventListener('inncontrol-assistant-cleared', handleCleared);
    return () => window.removeEventListener('inncontrol-assistant-cleared', handleCleared);
  }, [conversations, selectedChat]);

  const handleSearchChange = (val) => {
    setSearchTerm(val);
    searchRef.current = val;
    fetchConversations(val);
  };

  useEffect(() => {
    if (selectedChat) {
      fetchHistory();
      if (selectedChat.isGroup) {
        fetchGroupMembers(true);
        markAsRead();
      } else {
        markAsRead();
        setGroupMembers([]); // Clear if not group
      }

      // Scroll to bottom when tab changes (especially for Assistant)
      setTimeout(() => scrollToBottom(true), 100);

      const interval = setInterval(() => {
        fetchHistory();
        if (selectedChat.isGroup) {
          fetchGroupMembers(false);
          markAsRead();
        } else {
          markAsRead();
        }
      }, 5000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat, activeAssistantTab]);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    const isFromMe = lastMsg?.senderId === user?.id;
    scrollToBottom(isFromMe);
  }, [messages]);

  // Message Search Logic
  useEffect(() => {
    if (msgSearchTerm.length > 2) {
      const matches = messages.reduce((acc, msg, idx) => {
        if (msg.content.toLowerCase().includes(msgSearchTerm.toLowerCase())) {
          acc.push(idx);
        }
        return acc;
      }, []);
      setSearchMatches(matches);
      if (matches.length > 0) {
        setCurrentMatchIdx(0);
        scrollToMessage(matches[0]);
      } else {
        setCurrentMatchIdx(-1);
      }
    } else {
      setSearchMatches([]);
      setCurrentMatchIdx(-1);
    }
  }, [msgSearchTerm, messages]);

  const scrollToMessage = (idx) => {
    const el = messageRefs.current[idx];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const nextMatch = () => {
    const next = (currentMatchIdx + 1) % searchMatches.length;
    setCurrentMatchIdx(next);
    scrollToMessage(searchMatches[next]);
  };

  const prevMatch = () => {
    const prev = (currentMatchIdx - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIdx(prev);
    scrollToMessage(searchMatches[prev]);
  };

  const scrollToBottom = (force = false) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
    if (force || isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: force ? 'smooth' : 'auto' });
    }
  };

  const fetchConversations = async (search = '') => {
    if (!user?.id) return;
    try {
      const response = await api.get(`/messages/conversations?userId=${user.id}&search=${search}`);
      const newData = response.data;
      setConversations(prev => JSON.stringify(prev) === JSON.stringify(newData) ? prev : newData);
    } catch (error) {
      console.error("Error fetching conversations", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsersForGroup = async () => {
    try {
      const res = await api.get('/users');
      setAllUsers(res.data.filter(u => u.id !== user?.id));
    } catch (e) { }
  };

  const fetchHistory = async () => {
    if (!selectedChat || !user?.id) return;
    try {
      const currentConv = conversations.find(c => c.contactId === selectedChat.id);
      const isGroupChat = !!(selectedChat.isGroup || currentConv?.group || currentConv?.contactRole === 'GRUPO');
      
      const url = isGroupChat
        ? `/messages/group/history?groupId=${selectedChat.id}&userId=${user.id}`
        : `/messages/history?userId1=${user.id}&userId2=${selectedChat.id}`;
      
      const response = await api.get(url);
      let data = response.data;

      // Si es el Asistente y no hay historial, enviar saludo inicial como mensaje real
      const isAssistant = selectedConv?.contactName === 'InnControl Assistant' || 
                          conversations.find(c => c.contactId === selectedChat.id)?.contactName === 'InnControl Assistant';
      if (isAssistant && !isGroupChat && data.length === 0) {
        try {
          await api.post('/messages/send', {
            senderId: selectedChat.id,
            receiverId: user.id,
            content: '¡Hola! Soy tu asistente de InnControl. ¿En qué puedo ayudarte hoy?'
          });
          const res2 = await api.get(url);
          data = res2.data;
        } catch (greetErr) {
          console.error("Error sending greeting", greetErr);
        }
      }

      setMessages(data);
      scrollToBottom();
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error("Error fetching history", error);
      }
    }
  };

  const markAsRead = async () => {
    if (!selectedChat || !user?.id) return;
    
    // Clear locally first for instant UI feedback
    setConversations(prev => prev.map(c => 
      c.contactId === selectedChat.id ? { ...c, unreadCount: 0 } : c
    ));

    try {
      if (selectedChat.isGroup) {
        await api.put(`/messages/group/read?groupId=${selectedChat.id}&userId=${user.id}`);
      } else {
        await api.put(`/messages/read?senderId=${selectedChat.id}&receiverId=${user.id}`);
      }
      
      // If switching to Assistant, default to 'chat' tab
      if (selectedConv?.contactName === 'InnControl Assistant' && !activeAssistantTab) {
        setActiveAssistantTab('chat');
      }
    } catch (e) { }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || !user?.id) return;

    try {
      const isAssistant = selectedConv?.contactName === 'InnControl Assistant';
      const currentConv = conversations.find(c => c.contactId === selectedChat.id);
      const isGroupChat = !!(selectedChat.isGroup || currentConv?.group || currentConv?.contactRole === 'GRUPO');
      
      const msgData = {
        senderId: user.id,
        receiverId: isGroupChat ? null : selectedChat.id,
        groupId: isGroupChat ? selectedChat.id : null,
        content: newMessage.trim(),
        replyToId: replyingTo?.id
      };
      
      const sentMsgRes = await api.post('/messages/send', msgData);
      setNewMessage('');
      setReplyingTo(null);

      fetchHistory();
      fetchConversations(searchRef.current);
    } catch (error) {
      console.error("Error sending message", error);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setStatusMsg({ type: 'success', text: 'Copiado al portapapeles' });
    setActiveMessageMenu(null);
  };

  const handleDeleteIndividualMessage = async (msg) => {
    const isSystemTask = msg.type === 'SYSTEM_TASK' || msg.msgType === 'SYSTEM_TASK';
    
    if (isSystemTask) {
      setConfirmModal({
        isOpen: true,
        title: '¿Eliminar notificación?',
        message: '¿Estás seguro de que quieres eliminar esta notificación del sistema? Esta acción es definitiva en tu historial.',
        btnText: 'Eliminar',
        btnColor: 'bg-red-500',
        action: async () => {
          try {
            await api.delete(`/messages/message/${msg.id}?userId=${user.id}&forEveryone=false`);
            fetchHistory();
            setStatusMsg({ type: 'success', text: 'Notificación eliminada' });
          } catch (e) {
            setStatusMsg({ type: 'error', text: 'Error al eliminar la notificación' });
          }
        }
      });
      return;
    }

    const isMine = msg.sender.id === user.id;
    const canDeleteForEveryone = isMine && (new Date() - new Date(msg.createdAt)) < (3600 * 1000);

    setConfirmModal({
      isOpen: true,
      title: isMine ? '¿Deseas eliminar el mensaje?' : '¿Deseas eliminar este mensaje?',
      message: isMine 
        ? (canDeleteForEveryone ? 'Puedes eliminarlo solo para ti o para todos.' : 'Ya pasó más de una hora, solo puedes eliminarlo para ti.')
        : 'Este mensaje se eliminará solo para ti.',
      showCustomButtons: true,
      customButtons: (
        <div className="flex flex-col gap-2 w-full mt-2">
          {canDeleteForEveryone && (
            <button 
              onClick={async () => {
                await api.delete(`/messages/message/${msg.id}?userId=${user.id}&forEveryone=true`);
                fetchHistory();
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
              }}
              className="w-full py-3 rounded-2xl bg-red-500 text-white font-black text-[10px] uppercase tracking-widest hover:bg-red-600 transition-all"
            >
              Eliminar para todos
            </button>
          )}
          <button 
            onClick={async () => {
              await api.delete(`/messages/message/${msg.id}?userId=${user.id}&forEveryone=false`);
              fetchHistory();
              setConfirmModal(prev => ({ ...prev, isOpen: false }));
            }}
            className={`w-full py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${dark ? 'bg-white/5 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Eliminar para mí
          </button>
          <button 
            onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            className="w-full py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white/5 transition-all"
          >
            Cancelar
          </button>
        </div>
      )
    });
  };

  const handleTogglePinMessage = async (msgId) => {
    try {
      await api.post(`/messages/message/${msgId}/pin`);
      fetchHistory();
      setActiveMessageMenu(null);
      setStatusMsg({ type: 'success', text: 'Estado de fijado actualizado' });
    } catch (e) { }
  };

  const handleBulkDelete = async () => {
    if (selectedMessageIds.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: '¿Eliminar mensajes?',
      message: `¿Estás seguro de que quieres eliminar ${selectedMessageIds.length} mensajes seleccionados para ti?`,
      btnText: 'Eliminar para mí',
      btnColor: 'bg-red-500',
      action: async () => {
        try {
          await api.post(`/messages/messages/bulk-delete?userId=${user.id}`, selectedMessageIds);
          setSelectedMessageIds([]);
          setIsSelectionMode(false);
          fetchHistory();
          setStatusMsg({ type: 'success', text: 'Mensajes eliminados' });
        } catch (e) { }
      }
    });
  };

  const toggleSelection = (id) => {
    setSelectedMessageIds(prev => 
      prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
    );
  };

  const togglePin = async (e, contactId, isGroup) => {
    e.stopPropagation();
    try {
      await api.put('/messages/pin', { userId: user.id, contactId, isGroup });
      fetchConversations(searchRef.current);
    } catch (e) { }
  };

  const deleteHistory = async (onlyHistory = true) => {
    if (!selectedChat || !user?.id) return;
    const isGroup = selectedChat.isGroup || (selectedConv?.contactRole === 'GRUPO');
    const actionText = onlyHistory ? 'vaciar el historial de' : 'eliminar por completo';
    const isAssistantChat = selectedConv?.contactName === 'InnControl Assistant';
    
    setConfirmModal({
      isOpen: true,
      title: onlyHistory ? '¿Vaciar historial?' : '¿Eliminar chat?',
      message: `Esta acción no se puede deshacer. ¿Estás seguro de que quieres ${actionText} este chat?`,
      btnText: onlyHistory ? 'Vaciar Ahora' : 'Eliminar Chat',
      btnColor: 'bg-red-500',
      action: async () => {
        try {
          const isGroupChat = selectedChat.isGroup || (selectedConv?.contactRole === 'GRUPO');
          const historyParams = isGroupChat
            ? `userId=${user.id}&groupId=${selectedChat.id}`
            : `userId=${user.id}&contactId=${selectedChat.id}`;
          
          const endpoint = onlyHistory ? '/messages/clear-history' : '/messages/delete';
          await api.delete(`${endpoint}?${historyParams}`);
          
          setMessages([]);
          setShowInfo(false);
          setShowChatMenu(false);

          if (!onlyHistory) {
            setSelectedChat(null);
            fetchConversations(searchRef.current);
          } else {
            await fetchHistory();
          }

          // Si vaciamos el chat del Asistente, notificar a la burbuja flotante DESPUÉS de recrear el saludo
          if (isAssistantChat && onlyHistory) {
            window.dispatchEvent(new CustomEvent('inncontrol-assistant-cleared'));
          }

          setStatusMsg({ type: 'success', text: onlyHistory ? 'Chat vaciado' : 'Chat eliminado' });
        } catch (e) {
          console.error("Error deleting history", e);
          setStatusMsg({ type: 'error', text: 'No se pudo realizar la acción' });
        }
      }
    });
  };

  const handleLeaveGroup = async () => {
    if (!selectedChat?.id || !user?.id) return;
    
    setConfirmModal({
      isOpen: true,
      title: '¿Salir del grupo?',
      message: 'Ya no podrás enviar ni recibir mensajes en este grupo.',
      btnText: 'Salir del Grupo',
      btnColor: 'bg-amber-500',
      action: async () => {
        try {
          await api.delete(`/messages/group/${selectedChat.id}/leave?userId=${user.id}`);
          setShowChatMenu(false);
          await fetchConversations(searchRef.current);
          fetchHistory();
          setStatusMsg({ type: 'success', text: 'Has salido del grupo' });
        } catch (e) {
          setStatusMsg({ type: 'error', text: 'Error al salir del grupo' });
        }
      }
    });
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (!selectedChat?.id || !user?.id) return;
    
    setShowInfo(false);
    
    setConfirmModal({
      isOpen: true,
      title: '¿Eliminar del grupo?',
      message: `¿Estás seguro de que quieres eliminar a ${memberName} del grupo?`,
      btnText: 'Eliminar Miembro',
      btnColor: 'bg-red-500',
      action: async () => {
        try {
          await api.delete(`/messages/group/${selectedChat.id}/remove?memberId=${memberId}&adminId=${user.id}`);
          fetchGroupMembers();
          fetchHistory();
          setStatusMsg({ type: 'success', text: `${memberName} ha sido eliminado` });
        } catch (e) {
          setStatusMsg({ type: 'error', text: 'Error al eliminar miembro' });
        }
      },
      onCancel: () => setShowInfo(true)
    });
  };

  const handlePromoteToAdmin = async (memberId, memberName) => {
    if (!selectedChat?.id || !user?.id) return;
    
    setShowInfo(false);
    
    setConfirmModal({
      isOpen: true,
      title: '¿Nombrar Administrador?',
      message: `¿Estás seguro de que quieres darle permisos de administrador a ${memberName}?`,
      btnText: 'Nombrar Admin',
      btnColor: 'bg-amber-500',
      action: async () => {
        try {
          await api.post(`/messages/group/${selectedChat.id}/promote?memberId=${memberId}&adminId=${user.id}`);
          fetchGroupMembers();
          fetchHistory();
          setStatusMsg({ type: 'success', text: `${memberName} ahora es administrador` });
        } catch (e) {
          setStatusMsg({ type: 'error', text: 'Error al nombrar administrador' });
        }
      },
      onCancel: () => setShowInfo(true)
    });
  };

  const handleDemoteAdmin = async (memberId, memberName) => {
    if (!selectedChat?.id || !user?.id) return;
    
    setShowInfo(false);
    
    setConfirmModal({
      isOpen: true,
      title: '¿Quitar Administrador?',
      message: `¿Estás seguro de que quieres quitarle los permisos de administrador a ${memberName}?`,
      btnText: 'Quitar Rango',
      btnColor: 'bg-red-500',
      action: async () => {
        try {
          await api.post(`/messages/group/${selectedChat.id}/demote?memberId=${memberId}&adminId=${user.id}`);
          fetchGroupMembers();
          fetchHistory();
          setStatusMsg({ type: 'success', text: `Se han revocado los permisos a ${memberName}` });
        } catch (e) {
          setStatusMsg({ type: 'error', text: 'Error al quitar rango' });
        }
      },
      onCancel: () => setShowInfo(true)
    });
  };

  const handleAddMember = async (memberId, memberName) => {
    try {
      await api.post(`/messages/group/${selectedChat.id}/add?memberId=${memberId}&adminId=${user.id}`);
      fetchGroupMembers();
      fetchHistory();
      setIsAddMemberModalOpen(false);
      setStatusMsg({ type: 'success', text: `${memberName} ha sido añadido al grupo` });
    } catch (e) {
      setStatusMsg({ type: 'error', text: 'Error al añadir miembro' });
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedChat?.id || !user?.id) return;

    setConfirmModal({
      isOpen: true,
      title: '¿ELIMINAR GRUPO?',
      message: 'Se desactivará el grupo para todos los miembros, pero se conservará el historial.',
      btnText: 'Eliminar Grupo',
      btnColor: 'bg-red-600',
      action: async () => {
        try {
          await api.delete(`/messages/group/${selectedChat.id}?requesterId=${user.id}`);
          setShowInfo(false);
          setShowChatMenu(false);
          // Re-fetch everything to show the "deleted" state immediately
          await fetchConversations(searchRef.current);
          fetchHistory();
          setStatusMsg({ type: 'success', text: 'Grupo eliminado' });
        } catch (e) {
          setStatusMsg({ type: 'error', text: 'Solo el administrador puede eliminar el grupo' });
        }
      }
    });
  };

  const handleCreateGroup = async () => {
    if (!groupName || selectedMembers.length === 0) return;
    setIsCreatingGroup(true);
    try {
      const payload = {
        name: groupName,
        description: "",
        photo: groupPhoto,
        memberIds: selectedMembers.map(id => Number(id)),
        creatorId: Number(user.id)
      };
      await api.post('/messages/group', payload);
      setStatusMsg({ type: 'success', text: '¡Grupo creado correctamente!' });
      setTimeout(() => {
        setIsGroupModalOpen(false);
        setGroupName('');
        setGroupPhoto(null);
        setSelectedMembers([]);
        fetchConversations(searchRef.current);
      }, 1000);
    } catch (e) {
      console.error("Error creating group", e);
      setStatusMsg({ type: 'error', text: 'Error al crear el grupo' });
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const cardStyle = dark
    ? { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', text: '#f1f5f9', sub: '#94a3b8' }
    : { bg: '#fff', border: '#e2e8f0', text: '#0f172a', sub: '#64748b' };

  const sidebarBg = dark ? '#0d1f14' : '#fff';
  const chatBg = dark ? '#0a1a11' : '#f8fafc';

  const formatTime = (dateStr) => {
    if (!dateStr || dateStr.startsWith('2000-01-01')) return '';
    const d = new Date(dateStr);
    const now = new Date();
    
    // Hoy: mostrar hora
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Ayer
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return 'Ayer';
    }
    
    // Esta semana: mostrar nombre del día
    const diffTime = Math.abs(now - d);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
      const day = d.toLocaleDateString('es-ES', { weekday: 'long' });
      return day.charAt(0).toUpperCase() + day.slice(1);
    }
    
    // Más antiguo: mostrar fecha
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'numeric', year: 'numeric' });
  };

  const formatMessageTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateLabel = (dateStr) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Hoy';
    if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
  };

  const displayedConversations = conversations.filter(c => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = c.contactName.toLowerCase().includes(searchLower);
    if (!matchesSearch) return false;

    if (filterType === 'unread') return c.unreadCount > 0;
    if (filterType === 'groups') return c.isGroup || c.contactRole === 'GRUPO';

    return true;
  });

  const groupedMessages = [];
  let lastDate = '';
  messages.forEach((msg, idx) => {
    const dateLabel = formatDateLabel(msg.createdAt);
    if (dateLabel !== lastDate) {
      groupedMessages.push({ type: 'date', label: dateLabel });
      lastDate = dateLabel;
    }
    groupedMessages.push({ type: 'msg', index: idx, ...msg });
  });

  const selectedConv = conversations.find(c => {
    const isGroupChat = c.isGroup || c.contactRole === 'GRUPO';
    return c.contactId === selectedChat?.id && isGroupChat === selectedChat?.isGroup;
  });

  const cleanRole = (role) => {
    if (!role) return '';
    return role.replace('ROLE_', '').toLowerCase().replace(/^\w/, c => c.toUpperCase());
  };

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-8rem)] flex overflow-hidden rounded-[2.5rem] border shadow-2xl"
      style={{ background: sidebarBg, border: `1px solid ${cardStyle.border}` }}>

      <aside className={`${selectedChat ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-col border-r shrink-0`} style={{ borderColor: cardStyle.border }}>
        <div className="px-3 py-7 space-y-4">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={16} />
              <input
                type="text"
                placeholder="Buscar personal..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className={`w-full pl-11 pr-4 py-3 rounded-2xl text-[11px] font-bold focus:outline-none transition-all ${dark ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-50 border-gray-100 text-gray-900'
                  }`}
              />
            </div>
            <button
              onClick={() => setIsGroupModalOpen(true)}
              className={`p-2.5 rounded-2xl border transition-all ${dark ? 'bg-white/5 border-white/10 text-gray-400 hover:bg-emerald-500/10 hover:text-emerald-500' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-emerald-500/10 hover:text-emerald-500'}`}
              title="Nuevo Grupo"
            >
              <Users size={18} />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className={`p-2.5 rounded-2xl border transition-all relative ${filterType !== 'all' ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' : (dark ? 'bg-white/5 border-white/10 text-gray-400 hover:bg-emerald-500/10 hover:text-emerald-500' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-emerald-500/10 hover:text-emerald-500')}`}
              >
                <Filter size={18} />
                {filterType !== 'all' && (
                  <span className="absolute -top-1 -right-1 bg-emerald-500 text-[8px] font-black text-white px-1.5 py-0.5 rounded-full border-2 border-white dark:border-[#0d1f14]">
                    !
                  </span>
                )}
              </button>
              {/* Menú Desplegable en Español - Controlado por Estado */}
              {showFilterMenu && (
                <div
                  className="absolute right-0 top-full mt-2 w-40 py-2 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] z-50 overflow-hidden animate-in fade-in zoom-in duration-200 border"
                  style={{
                    background: dark ? '#0d1f14' : '#ffffff',
                    borderColor: dark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0,0,0,0.05)'
                  }}
                >
                  <p className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest border-b mb-1 ${dark ? 'text-emerald-500/50 border-emerald-500/10' : 'text-gray-400 border-gray-50'}`}>
                    Filtrar por
                  </p>
                  <button
                    onClick={() => { setFilterType('all'); setShowFilterMenu(false); }}
                    className={`w-full text-left px-4 py-2.5 text-[11px] font-bold transition-all ${filterType === 'all' ? 'text-emerald-500 bg-emerald-500/10' : (dark ? 'text-gray-400 hover:bg-emerald-500/5 hover:text-emerald-500' : 'text-gray-600 hover:bg-gray-50 hover:text-emerald-500')}`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => { setFilterType('unread'); setShowFilterMenu(false); }}
                    className={`w-full text-left px-4 py-2.5 text-[11px] font-bold transition-all ${filterType === 'unread' ? 'text-emerald-500 bg-emerald-500/10' : (dark ? 'text-gray-400 hover:bg-emerald-500/5 hover:text-emerald-500' : 'text-gray-600 hover:bg-gray-50 hover:text-emerald-500')}`}
                  >
                    No leídos
                  </button>
                  <button
                    onClick={() => { setFilterType('groups'); setShowFilterMenu(false); }}
                    className={`w-full text-left px-4 py-2.5 text-[11px] font-bold transition-all ${filterType === 'groups' ? 'text-emerald-500 bg-emerald-500/10' : (dark ? 'text-gray-400 hover:bg-emerald-500/5 hover:text-emerald-500' : 'text-gray-600 hover:bg-gray-50 hover:text-emerald-500')}`}
                  >
                    Grupos
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-emerald-500" size={24} />
            </div>
          ) : (
            <div className="flex flex-col">
              {displayedConversations.map((conv, index) => {
                const isGroupChat = !!(conv.group || conv.contactRole === 'GRUPO');
                return (
                  <div
                    key={`${isGroupChat ? 'g' : 'u'}-${conv.contactId}`}
                    onClick={() => setSelectedChat({ id: conv.contactId, isGroup: isGroupChat })}
                    className={`w-full flex items-center gap-4 px-6 py-5 transition-all relative group cursor-pointer border-t ${selectedChat?.id === conv.contactId && (selectedChat?.isGroup === isGroupChat)
                      ? 'bg-emerald-500/25 border-r-2 border-emerald-500'
                      : 'hover:bg-emerald-500/5'
                      }`}
                    style={{ borderColor: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)' }}
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 overflow-hidden relative transition-all duration-300 ${conv.contactName === 'InnControl Assistant' ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                      {conv.contactPhoto ? (
                        <img src={conv.contactPhoto} className="w-full h-full object-cover" />
                      ) : (
                        conv.contactName === 'InnControl Assistant' ? <BrainCircuit size={20} className="text-emerald-500" /> : (isGroupChat ? <Users size={20} className="text-emerald-500" /> : <UserIcon size={20} className="text-emerald-500" />)
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex justify-between items-start mb-0.5">
                        <p className="font-bold text-sm truncate" style={{ color: selectedChat?.id === conv.contactId ? '#10b981' : cardStyle.text }}>{conv.contactName}</p>
                        <span className={`text-[8px] font-black shrink-0 transition-colors ${conv.unreadCount > 0 ? 'text-emerald-500 opacity-100' : 'opacity-40'}`} style={{ color: (conv.unreadCount > 0) ? undefined : cardStyle.sub }}>{formatTime(conv.lastMessageTime)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className={`text-[10px] truncate font-medium flex-1 transition-opacity ${conv.unreadCount > 0 ? 'opacity-100' : 'opacity-60'}`} style={{ color: cardStyle.text }}>
                          {(() => {
                            const msg = conv.lastMessage || '';
                            const isSystem = msg.startsWith('SYSTEM_');
                            const isTask = msg.startsWith('TASK_EVENT|');
                            if (isSystem || isTask) {
                              if (isTask) return 'Actualización de tarea';
                              if (msg === 'SYSTEM_GROUP_CREATED') return conv.lastMessageIsFromMe ? 'Creaste el grupo' : 'Grupo creado';
                              if (msg.startsWith('SYSTEM_MEMBER_ADDED:')) {
                                const name = msg.split(':')[1];
                                return conv.lastMessageIsFromMe ? `Añadiste a ${name}` : `${name} fue añadido`;
                              }
                              if (msg.startsWith('SYSTEM_MEMBER_REMOVED:')) {
                                const name = msg.split(':')[1];
                                return conv.lastMessageIsFromMe ? `Eliminaste a ${name}` : `${name} fue eliminado`;
                              }
                              if (msg.startsWith('SYSTEM_NEW_ADMIN:')) {
                                const name = msg.split(':')[1];
                                return conv.lastMessageIsFromMe ? `Hiciste admin a ${name}` : `${name} ahora es admin`;
                              }
                              if (msg.startsWith('SYSTEM_ADMIN_REMOVED:')) {
                                const name = msg.split(':')[1];
                                return conv.lastMessageIsFromMe ? `Quitaste admin a ${name}` : `Se quitó admin a ${name}`;
                              }
                              return 'Actualización del grupo';
                            }
                            return (
                              <div className="flex items-center min-w-0">
                                {conv.lastMessageIsFromMe && (
                                  <div className="mr-1.5 shrink-0">
                                    {conv.lastMessageRead ? (
                                      <CheckCheck size={14} className="text-sky-400" />
                                    ) : (
                                      <Check size={14} className={dark ? 'text-white/40' : 'text-gray-400'} />
                                    )}
                                  </div>
                                )}
                                <span className="truncate">
                                  {msg || (isGroupChat ? 'Nuevo grupo creado' : 'Empieza a chatear...')}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => togglePin(e, conv.contactId, isGroupChat)}
                            className={`transition-all p-1.5 rounded-lg hover:bg-gray-500/10 ${conv.pinned ? 'text-gray-400 opacity-100' : 'text-gray-400 opacity-0 group-hover:opacity-100'}`}
                            title={conv.pinned ? "Desanclar Chat" : "Anclar Chat"}
                          >
                            {conv.pinned ? <PinOff size={14} className="fill-current" /> : <Pin size={14} />}
                          </button>
                          {conv.unreadCount > 0 && (
                            <div className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
                              <span className="text-[9px] font-black text-white leading-none">
                                {conv.unreadCount}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {displayedConversations.length === 0 && (
                <div className="p-10 text-center space-y-3 opacity-40">
                  <Search size={32} className="mx-auto text-emerald-500" />
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: cardStyle.sub }}>Sin resultados</p>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      <main className={`flex-1 flex-col relative ${selectedChat ? 'flex' : 'hidden md:flex'} h-full overflow-hidden`} style={{ background: chatBg }}>
        {selectedChat ? (
          <>
            <header className="px-4 md:px-6 py-4 md:py-6 flex items-center justify-between border-b sticky top-0 z-10" style={{ borderColor: cardStyle.border, background: sidebarBg }}>
              <div className="flex items-center gap-3 md:gap-4 min-w-0">
                <button 
                  onClick={() => setSelectedChat(null)}
                  className="md:hidden p-2 -ml-2 rounded-xl hover:bg-emerald-500/10 text-emerald-500 transition-all"
                >
                  <ChevronDown className="rotate-90" size={24} />
                </button>
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0 overflow-hidden">
                  {selectedConv?.contactPhoto ? (
                    <img src={selectedConv.contactPhoto} className="w-full h-full object-cover" />
                  ) : (
                    (selectedChat?.isGroup || selectedConv?.contactRole === 'GRUPO') ? <Users size={18} className="text-emerald-500" /> : <UserIcon size={16} className="text-emerald-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-black text-sm tracking-tight truncate" style={{ color: cardStyle.text }}>
                    {selectedConv?.contactName || 'Cargando...'}
                  </p>
                  <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest opacity-70 truncate">
                    {(selectedChat?.isGroup || selectedConv?.contactRole === 'GRUPO')
                      ? (groupMembers && groupMembers.length > 0
                        ? (() => {
                          const others = groupMembers.filter(m => m.id !== user.id).map(m => m.name.split(' ')[0]);
                          const hasMe = groupMembers.some(m => m.id === user.id);
                          if (others.length === 0) return hasMe ? 'Tú' : '';
                          return others.join(', ') + (hasMe ? ', Tú' : '');
                        })()
                        : 'Cargando equipo...')
                      : (selectedConv?.contactName === 'InnControl Assistant' ? 'SISTEMA' : cleanRole(selectedConv?.contactRole))}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 md:gap-2">
                <div className={`flex items-center gap-2 transition-all ${showMsgSearch ? 'w-40 md:w-64 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={msgSearchTerm}
                    onChange={(e) => setMsgSearchTerm(e.target.value)}
                    className={`w-full px-4 py-2 text-xs rounded-xl border focus:outline-none ${dark ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                  />
                  {searchMatches.length > 0 && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={prevMatch} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400"><ChevronUp size={14} /></button>
                      <button onClick={nextMatch} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400"><ChevronDown size={14} /></button>
                    </div>
                  )}
                </div>
                <button onClick={() => { setShowMsgSearch(!showMsgSearch); setMsgSearchTerm(''); }} className={`p-2.5 md:p-3 rounded-2xl transition-all ${showMsgSearch ? 'bg-emerald-500 text-white' : 'hover:bg-emerald-500/5 text-gray-400'}`}><Search size={18} /></button>
                <div className="relative">
                  <button onClick={() => setShowChatMenu(!showChatMenu)} className={`p-2.5 md:p-3 rounded-2xl transition-all ${showChatMenu ? 'bg-emerald-500/10 text-emerald-500' : 'hover:bg-emerald-500/5 text-gray-400'}`}><MoreVertical size={18} /></button>
                  
                  {showChatMenu && (
                    <div className={`absolute right-0 top-full mt-2 w-48 py-2 rounded-2xl shadow-2xl z-[100] border animate-in fade-in zoom-in duration-200 ${dark ? 'bg-[#0d1f14] border-emerald-500/20' : 'bg-white border-gray-100'}`}>
                      {selectedChat?.isGroup && !selectedConv?.isDeleted && groupMembers.some(m => m.id === user?.id) && (
                        <button onClick={() => { setIsAddMemberModalOpen(true); setShowChatMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-all ${dark ? 'text-gray-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-50'}`}>
                          <UserPlus size={14} /> Añadir miembro
                        </button>
                      )}
                      <button onClick={() => { setShowInfo(true); setShowChatMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-all ${dark ? 'text-gray-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-50'}`}>
                        <UserIcon size={14} /> Información
                      </button>
                      <button onClick={() => { setSelectedChat(null); setShowChatMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-all ${dark ? 'text-gray-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-50'}`}>
                        <X size={14} /> Cerrar chat
                      </button>
                      {!selectedConv?.isDeleted && (
                        <button 
                          onClick={() => deleteHistory(true)} 
                          disabled={messages.filter(m => m.type !== 'SYSTEM' && m.msgType !== 'SYSTEM').length === 0}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-all ${
                            messages.filter(m => m.type !== 'SYSTEM' && m.msgType !== 'SYSTEM').length === 0
                              ? 'opacity-30 cursor-not-allowed text-gray-400'
                              : dark ? 'text-gray-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <Eraser size={14} /> Vaciar chat
                        </button>
                      )}
                      
                      {/* Ocultar "Eliminar chat" si es el InnControl Assistant */}
                      {!selectedChat?.isGroup && selectedConv?.contactName !== 'InnControl Assistant' ? (
                        <button onClick={() => deleteHistory(false)} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-red-400 hover:bg-red-500/5 transition-all">
                          <Trash2 size={14} /> Eliminar chat
                        </button>
                      ) : selectedChat?.isGroup ? (
                        <>
                          {!selectedConv?.isDeleted && selectedConv?.isMember !== false ? (
                            <>
                              <button onClick={handleLeaveGroup} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-amber-500 hover:bg-amber-500/5 transition-all">
                                <LogOut size={14} /> Salir del grupo
                              </button>
                              {/* Only show Delete Group if current user is the creator */}
                              {(selectedConv?.creatorId === user?.id || selectedConv?.creatorId === Number(user?.id)) && (
                                <button onClick={handleDeleteGroup} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-red-500 hover:bg-red-500/5 transition-all border-t border-emerald-500/10 mt-1 pt-2">
                                  <Trash2 size={14} /> Eliminar grupo
                                </button>
                              )}
                            </>
                          ) : (
                            <button onClick={() => deleteHistory(false)} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-red-400 hover:bg-red-500/5 transition-all">
                              <Trash2 size={14} /> Eliminar chat
                            </button>
                          )}
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* Assistant Tabs */}
            {selectedConv?.contactName === 'InnControl Assistant' && (
              <div className={`px-8 py-0 flex items-center border-b ${dark ? 'bg-[#0d1f14]/50 border-white/5' : 'bg-gray-50/50 border-gray-100'}`}>
                <button 
                  onClick={() => setActiveAssistantTab('chat')}
                  className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeAssistantTab === 'chat' ? 'text-emerald-500' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  <div className="flex items-center gap-2">
                    <BrainCircuit size={14} />
                    Asistente IA
                  </div>
                  {activeAssistantTab === 'chat' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />}
                </button>
                <button 
                  onClick={() => { setActiveAssistantTab('updates'); setHasNewUpdates(false); }}
                  className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeAssistantTab === 'updates' ? 'text-emerald-500' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  <div className="flex items-center gap-2">
                    <Bell size={14} />
                    Actualizaciones
                    {hasNewUpdates && activeAssistantTab !== 'updates' && (
                      <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                    )}
                  </div>
                  {activeAssistantTab === 'updates' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />}
                </button>
              </div>
            )}

            {/* Pinned Messages Bar */}
            {messages.some(m => m.pinned) && showPinnedBar && (
              <div className={`px-8 py-3 border-b flex items-center justify-between animate-in slide-in-from-top duration-300 ${dark ? 'bg-emerald-500/10 border-white/5' : 'bg-emerald-50 border-gray-100'}`}>
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-1 h-8 bg-emerald-500 rounded-full shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Mensaje Fijado</p>
                    <p className={`text-xs font-bold truncate ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {messages.find(m => m.pinned).content}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      const pinnedMsg = messages.find(m => m.pinned);
                      const idx = messages.indexOf(pinnedMsg);
                      scrollToMessage(idx);
                    }}
                    className="p-2 rounded-xl hover:bg-emerald-500/10 text-emerald-500 transition-all"
                  >
                    <Search size={14} />
                  </button>
                  <button onClick={() => setShowPinnedBar(false)} className="p-2 rounded-xl hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-all">
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto px-4 md:px-8 pt-6 pb-0 space-y-4 scrollbar-hide overflow-x-hidden"
            >
              {(() => {
                const filtered = groupedMessages.filter(item => {
                  if (selectedConv?.contactName !== 'InnControl Assistant') return true;
                  if (item.type === 'date') return true;
                  if (activeAssistantTab === 'chat') {
                    return item.type !== 'SYSTEM_TASK' && item.msgType !== 'SYSTEM_TASK';
                  } else {
                    return item.type === 'SYSTEM_TASK' || item.msgType === 'SYSTEM_TASK';
                  }
                });

                if (filtered.length === 0 || (filtered.length === 1 && filtered[0].type === 'date')) {
                  return (
                    <div className="h-full flex flex-col justify-center items-center opacity-40">
                        {selectedConv?.contactName === 'InnControl Assistant' ? (
                          activeAssistantTab === 'updates' ? (
                            <>
                              <Bell size={40} className="text-emerald-500 mb-4" />
                              <p className="font-black text-[10px] uppercase tracking-[0.2em]" style={{ color: cardStyle.sub }}>Sin actualizaciones registradas</p>
                            </>
                          ) : (
                            <div className="flex flex-col items-center">
                              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 border border-emerald-500/20">
                                <Bot size={32} className="text-emerald-500" />
                              </div>
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] mt-4" style={{ color: cardStyle.sub }}>
                                Iniciando asistente...
                              </p>
                            </div>
                          )
                        ) : (
                          <>
                            <MessageSquare size={40} className="text-emerald-500 mb-4" />
                            <p className="font-black text-[10px] uppercase tracking-[0.2em]" style={{ color: cardStyle.sub }}>Empieza a chatear...</p>
                          </>
                        )}
                    </div>
                  );
                }

                return filtered.map((item, idx) => {
                  const translateSystemMessage = (msg) => {
                    const isFromMe = msg.sender?.id === user.id;
                    if (msg.content === 'SYSTEM_GROUP_CREATED') {
                      return isFromMe ? 'Creaste este grupo' : `${msg.sender?.name} creó este grupo`;
                    }
                    if (msg.content === 'SYSTEM_GROUP_DELETED') {
                      return 'El administrador eliminó este grupo';
                    }
                    if (msg.content?.startsWith('SYSTEM_MEMBER_ADDED:')) {
                      const addedName = msg.content.split(':')[1];
                      const isTargetMe = msg.receiver?.id === user.id;
                      if (isFromMe) return `Añadiste a ${addedName}`;
                      if (isTargetMe) return `${msg.sender?.name} te añadió`;
                      return `${msg.sender?.name} añadió a ${addedName}`;
                    }
                    if (msg.content?.startsWith('SYSTEM_MEMBER_LEFT:')) {
                      const leftName = msg.content.split(':')[1];
                      return leftName === user.name ? 'Te saliste del grupo' : `${leftName} salió del grupo`;
                    }
                    if (msg.content?.startsWith('SYSTEM_MEMBER_REMOVED:')) {
                      const removedName = msg.content.split(':')[1];
                      return removedName === user.name ? 'Fuiste eliminado del grupo' : `${removedName} fue eliminado del grupo`;
                    }
                    if (msg.content?.startsWith('SYSTEM_NEW_ADMIN:')) {
                      const adminName = msg.content.split(':')[1];
                      if (adminName === user.name) return 'Ahora eres administrador';
                      if (isFromMe) return `Hiciste administrador a ${adminName}`;
                      return `${adminName} ahora es administrador`;
                    }
                    if (msg.content?.startsWith('SYSTEM_ADMIN_REMOVED:')) {
                      const adminName = msg.content.split(':')[1];
                      if (adminName === user.name) return 'Ya no eres administrador';
                      if (isFromMe) return `Quitaste el rango a ${adminName}`;
                      return `Se quitó el rango de administrador a ${adminName}`;
                    }
                    return msg.content;
                  };

                  const renderTaskMessage = (msg) => {
                    const parts = msg.content.split('|');
                    const actionStr = parts[1] || '';
                    const [action, newStatus] = actionStr.split(':');
                    const title = parts[3];
                    const assignee = parts[4];
                    const priority = parts[5];
                    
                    const formatStatus = (s) => {
                      if (s === 'PENDIENTE') return 'Pendiente';
                      if (s === 'EN_PROGRESO') return 'En Progreso';
                      if (s === 'COMPLETADA') return 'Completada';
                      return s;
                    };

                    const getPriorityStyle = (p) => {
                      switch(p) {
                        case 'URGENTE': return 'bg-red-500/10 text-red-500';
                        case 'ALTA': return 'bg-amber-500/10 text-amber-500';
                        case 'MEDIA': return 'bg-blue-500/10 text-blue-500';
                        case 'BAJA': return 'bg-gray-500/10 text-gray-500';
                        default: return 'bg-gray-500/10 text-gray-500';
                      }
                    };

                    const getStatusColor = (s) => {
                      if (s === 'PENDIENTE') return 'text-amber-500';
                      if (s === 'EN_PROGRESO') return 'text-blue-500';
                      if (s === 'COMPLETADA') return 'text-emerald-500';
                      return 'text-emerald-500';
                    };
                    
                    return (
                      <div className={`p-5 rounded-[2.5rem] border shadow-2xl animate-in fade-in zoom-in duration-500 w-full max-w-xs relative ${dark ? 'bg-[#0a1510] border-emerald-500/20' : 'bg-white border-gray-100'}`}>
                        <button 
                          onClick={() => handleDeleteIndividualMessage(msg)}
                          className="absolute top-4 right-4 p-1.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Eliminar notificación"
                        >
                          <Trash2 size={14} />
                        </button>
                        <div className="flex items-center gap-4 mb-4 pr-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0 ${action === 'CREATED' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'}`}>
                            {action === 'CREATED' ? <Plus size={20} /> : <Sparkles size={20} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-0.5">
                              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Asistente InnControl</p>
                              <span className="text-[9px] font-black opacity-40" style={{ color: cardStyle.sub }}>{formatTime(msg.createdAt)}</span>
                            </div>
                            <h4 className="text-sm font-black tracking-tight" style={{ color: cardStyle.text }}>
                              {action === 'CREATED' ? 'Tarea Registrada' : 'Estado de Tarea'}
                            </h4>
                          </div>
                        </div>
                        
                        <div className={`p-4 rounded-2xl mb-4 ${dark ? 'bg-white/5' : 'bg-gray-50'}`}>
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <h5 className="text-[11px] font-black leading-tight flex-1" style={{ color: cardStyle.text }}>{title}</h5>
                            {priority && (
                              <span className={`px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase tracking-tighter shrink-0 ${getPriorityStyle(priority)}`}>
                                {priority}
                              </span>
                            )}
                          </div>
                          <div className="space-y-1.5 mt-2">
                            <div className="flex items-center gap-2 opacity-60">
                              <UserIcon size={10} />
                              <span className="text-[9px] font-bold">Asignado a: {assignee}</span>
                            </div>
                            {newStatus && (
                              <div className="flex items-center gap-2">
                                <CheckCircle2 size={10} className={getStatusColor(newStatus)} />
                                <span className={`text-[10px] font-bold ${getStatusColor(newStatus)}`}>Nuevo estado: {formatStatus(newStatus)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <button 
                          onClick={() => navigate('/tasks')}
                          className="w-full py-3 rounded-xl bg-emerald-500 text-white font-black text-[9px] uppercase tracking-widest shadow-lg shadow-emerald-500/10 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                          Ir a Tareas
                        </button>
                      </div>
                    );
                  };

                  if (item.type === 'SYSTEM_TASK') {
                    return (
                      <div key={`st-${idx}`} className="flex flex-col items-center my-6">
                        {renderTaskMessage(item)}
                      </div>
                    );
                  }

                  if (item.msgType === 'SYSTEM' || item.type === 'SYSTEM') {
                    // Only show system messages inside group chats
                    if (!selectedChat?.isGroup) return null;
                    return (
                      <div key={`sys-${idx}`} className="flex justify-center my-4 px-10">
                        <div className={`px-4 py-1.5 rounded-xl text-[9.5px] font-bold text-center shadow-sm border transition-all ${dark ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-500/70' : 'bg-emerald-50/50 border-emerald-500/10 text-emerald-600/80'
                          }`}>
                          {translateSystemMessage(item)}
                        </div>
                      </div>
                    );
                  }

                  if (item.type === 'date') {
                    return (
                      <div key={`date-${idx}`} className="flex justify-center my-8">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm ${dark ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-white border-gray-100 text-gray-500'}`}>
                          {item.label}
                        </span>
                      </div>
                    );
                  }
                  const isMine = item.sender.id === user.id;
                  const isHighlighted = searchMatches.includes(item.index);
                  const isCurrent = searchMatches[currentMatchIdx] === item.index;

                   return (
                    <div
                      key={idx}
                      ref={el => messageRefs.current[item.index] = el}
                      className={`flex items-center gap-4 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {isSelectionMode && (
                        <div 
                          onClick={() => toggleSelection(item.id)}
                          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all shrink-0 ${
                            selectedMessageIds.includes(item.id) 
                              ? 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/20' 
                              : (dark ? 'border-white/10' : 'border-gray-200')
                          }`}
                        >
                          {selectedMessageIds.includes(item.id) && <Check size={14} className="text-white font-black" />}
                        </div>
                      )}

                      <div className={`max-w-[70%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-1.5 relative group`}>
                        {!isMine && selectedChat.isGroup && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 ml-1 mb-0.5">
                            {item.sender.name.split(' ')[0]}
                          </span>
                        )}
                        
                        <div className="relative group/bubble">
                          <div className={`px-5 py-3.5 rounded-[2rem] text-sm font-normal shadow-sm relative transition-all ${
                            (item.type === 'DELETED' || item.msgType === 'DELETED' || item.content === 'Mensaje eliminado')
                              ? (dark ? 'bg-white/5 text-gray-500 border border-white/5' : 'bg-gray-50 text-gray-400 border border-gray-100')
                              : (isMine 
                                  ? 'bg-emerald-500 text-white rounded-tr-none shadow-emerald-500/10'
                                  : (dark ? 'bg-white/5 text-white border border-white/10 rounded-tl-none' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none')
                                )
                            } ${isHighlighted ? (isCurrent ? 'ring-4 ring-amber-500 ring-offset-2 ring-offset-emerald-900' : 'bg-amber-500/30 ring-2 ring-amber-500/50') : ''} ${item.pinned ? 'ring-1 ring-emerald-500/50' : ''}`}>
                            
                            {item.parentMessage && (
                              <div className={`mb-2 p-2.5 rounded-xl text-[10px] border-l-4 overflow-hidden transition-all ${
                                isMine 
                                  ? 'bg-black/10 border-white/30 text-white/80' 
                                  : (dark ? 'bg-white/10 border-emerald-500/50 text-gray-300' : 'bg-gray-100 border-emerald-500/50 text-gray-600')
                              }`}>
                                <p className={`font-black mb-0.5 ${isMine ? 'text-white' : 'text-emerald-500'}`}>
                                  {item.parentMessage.sender?.name?.split(' ')[0] || 'Mensaje'}
                                </p>
                                <p className="truncate opacity-90">{item.parentMessage.content}</p>
                              </div>
                            )}

                            {item.type === 'DELETED' || item.msgType === 'DELETED' || item.content === 'Mensaje eliminado' ? (
                              <div className="flex items-center gap-2 italic opacity-50 text-[11px] py-1">
                                <Eraser size={14} className="shrink-0" />
                                <span>Mensaje eliminado</span>
                              </div>
                            ) : (
                              // Renderizar con Markdown si es el Asistente y el mensaje es suyo (no mío)
                              (!isMine && selectedConv?.contactName === 'InnControl Assistant') ? (
                                <div className="markdown-content text-sm leading-relaxed">
                                  <ReactMarkdown>{item.content}</ReactMarkdown>
                                </div>
                              ) : (
                                item.content
                              )
                            )}

                            {isMine && (
                              <div className="absolute -right-2 -bottom-4 flex items-center bg-transparent p-1">
                                {renderChecks(item)}
                              </div>
                            )}

                            {item.pinned && (
                              <div className="absolute -left-2 -bottom-4">
                                <Pin size={12} className="text-emerald-500 fill-current rotate-45" />
                              </div>
                            )}
                          </div>

                          {!isSelectionMode && (
                            <div className={`absolute top-0 ${isMine ? '-left-8' : '-right-8'} opacity-0 group-hover/bubble:opacity-100 transition-opacity z-20`}>
                              <button 
                                onClick={() => setActiveMessageMenu(activeMessageMenu === item.id ? null : item.id)}
                                className={`p-1.5 rounded-lg transition-all ${dark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                              >
                                <ChevronDown size={16} />
                              </button>
                              
                              {activeMessageMenu === item.id && (
                                <div className={`absolute ${messages.length > 4 && idx >= messages.length - 2 ? 'bottom-full mb-2' : 'top-full mt-2'} ${isMine ? 'right-0' : 'left-0'} w-44 py-2 rounded-2xl shadow-2xl z-[50] border animate-in fade-in zoom-in duration-200 ${dark ? 'bg-[#0d1f14] border-emerald-500/20' : 'bg-white border-gray-100'}`}>
                                  <button onClick={() => { setReplyingTo(item); setActiveMessageMenu(null); }} className={`w-full flex items-center gap-3 px-4 py-2 text-[11px] font-bold transition-all ${dark ? 'text-gray-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-50'}`}>
                                    <CornerUpLeft size={12} /> Responder
                                  </button>
                                  <button onClick={() => handleCopy(item.content)} className={`w-full flex items-center gap-3 px-4 py-2 text-[11px] font-bold transition-all ${dark ? 'text-gray-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-50'}`}>
                                    <Copy size={12} /> Copiar
                                  </button>
                                  <button onClick={() => handleTogglePinMessage(item.id)} className={`w-full flex items-center gap-3 px-4 py-2 text-[11px] font-bold transition-all ${dark ? 'text-gray-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-50'}`}>
                                    <Pin size={12} /> {item.pinned ? 'Desfijar' : 'Fijar'}
                                  </button>
                                  <button onClick={() => { setIsSelectionMode(true); setSelectedMessageIds([item.id]); setActiveMessageMenu(null); }} className={`w-full flex items-center gap-3 px-4 py-2 text-[11px] font-bold transition-all ${dark ? 'text-gray-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-50'}`}>
                                    <CheckCircle2 size={12} /> Seleccionar
                                  </button>
                                  <button onClick={() => handleDeleteIndividualMessage(item)} className={`w-full flex items-center gap-3 px-4 py-2 text-[11px] font-bold transition-all text-red-500 ${dark ? 'hover:bg-red-500/10' : 'hover:bg-red-50'}`}>
                                    <Trash2 size={12} /> Eliminar
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <span className="text-[9px] font-bold opacity-30 mt-1 px-2" style={{ color: cardStyle.text }}>
                          {formatMessageTime(item.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
              <div ref={messagesEndRef} />
            </div>

            <footer className="py-3 md:py-5 px-4 md:px-7 relative" style={{ background: sidebarBg, borderTop: `1px solid ${cardStyle.border}` }}>
              {isSelectionMode ? (
                <div className="max-w-4xl mx-auto flex justify-between items-center bg-emerald-500 text-white p-4 rounded-2xl shadow-xl animate-in slide-in-from-bottom duration-300">
                  <div className="flex items-center gap-4">
                    <button onClick={() => { setIsSelectionMode(false); setSelectedMessageIds([]); }} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                      <X size={20} />
                    </button>
                    <p className="font-black text-sm uppercase tracking-widest">{selectedMessageIds.length} seleccionados</p>
                  </div>
                  <button onClick={handleBulkDelete} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-6 py-2.5 rounded-xl font-bold text-xs transition-all">
                    <Trash2 size={16} /> Eliminar
                  </button>
                </div>
              ) : (
                <>
                  {replyingTo && (
                    <div className={`max-w-4xl mx-auto mb-4 p-4 rounded-2xl border-l-4 flex items-center justify-between animate-in slide-in-from-bottom duration-300 ${dark ? 'bg-white/10 border-emerald-500/50 shadow-2xl shadow-black/20' : 'bg-gray-100 border-emerald-500/50 shadow-sm'}`}>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-0.5">{replyingTo.sender.id === user.id ? 'Tú' : replyingTo.sender.name.split(' ')[0]}</p>
                        <p className={`text-xs font-bold truncate ${dark ? 'text-gray-200' : 'text-gray-600'}`}>{replyingTo.content}</p>
                      </div>
                      <button onClick={() => setReplyingTo(null)} className={`p-2 rounded-xl transition-all ${dark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-black/5 text-gray-400'}`}>
                        <X size={16} />
                      </button>
                    </div>
                  )}
                  {selectedChat.isGroup && (selectedConv?.isDeleted || selectedConv?.isMember === false) ? (
                    <div className="max-w-4xl mx-auto py-3 px-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-center text-[10px] font-black uppercase tracking-widest">
                      {selectedConv?.isDeleted 
                        ? "Este grupo ha sido eliminado por el administrador." 
                        : "No puedes enviar mensajes a este grupo porque ya no eres miembro."}
                    </div>
                  ) : (
                    selectedConv?.contactName === 'InnControl Assistant' && activeAssistantTab === 'updates' ? (
                      <div className="max-w-4xl mx-auto py-4 px-8 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-emerald-500/60 text-center text-[10px] font-black uppercase tracking-[0.2em] animate-in fade-in slide-in-from-bottom duration-500">
                        Historial de Notificaciones • No se admiten respuestas en este canal
                      </div>
                    ) : (
                      <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-4 items-center">
                        <input
                          type="text"
                          placeholder="Escribe un mensaje aquí..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          className={`flex-1 px-7 py-4 rounded-3xl text-sm font-bold focus:outline-none transition-all shadow-inner border-2 ${dark
                            ? 'bg-white/5 border-white/5 text-white placeholder:text-gray-600 focus:border-emerald-500/30'
                            : 'bg-gray-50 border-transparent text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-emerald-500/20'
                            }`}
                        />
                        <button
                          type="submit"
                          disabled={!newMessage.trim()}
                          className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 text-white w-12 h-12 rounded-2xl shadow-lg shadow-emerald-500/30 transition-all active:scale-90 flex items-center justify-center shrink-0"
                        >
                          <Send size={18} className="translate-x-0.5" />
                        </button>
                      </form>
                    )
                  )}
                </>
              )}
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col justify-center items-center relative overflow-hidden bg-gradient-to-b from-transparent to-emerald-500/5">
            {/* Fondo Decorativo Sutil */}
            <div className="absolute inset-0 opacity-[0.03]" style={{ 
              backgroundImage: `radial-gradient(circle at 2px 2px, ${dark ? '#fff' : '#000'} 1px, transparent 0)`,
              backgroundSize: '30px 30px'
            }} />
            
            <div className="relative z-10 flex flex-col items-center animate-in fade-in slide-in-from-bottom-10 duration-1000">
              <div className="relative mb-10">
                <div className="absolute inset-0 bg-emerald-500 blur-3xl opacity-20 rounded-full animate-pulse" />
                <div className="relative w-32 h-32 rounded-[3rem] bg-gradient-to-br from-emerald-400/20 to-emerald-600/5 flex items-center justify-center border border-emerald-500/20 shadow-[0_20px_50px_rgba(16,185,129,0.1)] group hover:scale-105 transition-transform duration-500">
                  <MessageSquare size={54} className="text-emerald-500 drop-shadow-lg group-hover:rotate-12 transition-transform" />
                </div>
              </div>

              <h2 className="text-4xl font-black mb-8 tracking-tighter" style={{ color: cardStyle.text }}>
                Mensajería <span className="text-emerald-500">InnControl</span>
              </h2>
              
              <p className="text-sm font-medium opacity-60 max-w-[450px] leading-relaxed text-center" style={{ color: cardStyle.text }}>
                Conecta con tu equipo de trabajo en tiempo real.<br />
                Selecciona un chat de la lista para empezar a conversar.
              </p>
              
              <div className="mt-12 flex items-center gap-3">
                <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-emerald-500/20" />
                <div className="flex gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/40 animate-bounce [animation-delay:0ms]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/40 animate-bounce [animation-delay:150ms]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/40 animate-bounce [animation-delay:300ms]" />
                </div>
                <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-emerald-500/20" />
              </div>
            </div>
          </div>
        )}
      </main>

      {showInfo && selectedConv && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowInfo(false)} />
          <div className="relative w-full max-w-sm rounded-[3rem] p-10 text-center shadow-2xl border border-white/10 overflow-hidden" style={{ background: dark ? '#0d1f14' : '#fff' }}>
            <button onClick={() => setShowInfo(false)} className="absolute top-6 right-6 p-2 rounded-xl hover:bg-red-500/10 text-red-400 transition-all"><X size={20} /></button>
            <div className="w-24 h-24 rounded-[2rem] bg-emerald-500/10 mx-auto mb-6 flex items-center justify-center border border-emerald-500/20 overflow-hidden">
              {selectedConv.contactPhoto ? <img src={selectedConv.contactPhoto} className="w-full h-full object-cover" /> : (selectedChat.isGroup ? <Users size={40} className="text-emerald-500" /> : <UserIcon size={40} className="text-emerald-500" />)}
            </div>
            <h2 className="text-2xl font-black mb-1" style={{ color: cardStyle.text }}>{selectedConv.contactName}</h2>
            <p className="text-xs font-black uppercase tracking-widest text-emerald-500 mb-8">{selectedChat.isGroup ? 'Grupo de Equipo' : cleanRole(selectedConv.contactRole)}</p>

            <div className="space-y-4 text-left mb-10 overflow-y-auto max-h-60 pr-2 custom-scrollbar">
              <div className={`p-4 rounded-2xl border ${dark ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Información</p>
                <p className="text-sm font-bold" style={{ color: cardStyle.text }}>{selectedChat.isGroup ? 'Grupo creado para la coordinación de tareas del hotel.' : `Conversación privada con ${selectedConv.contactName}.`}</p>
              </div>

              {selectedChat.isGroup && (
                <div className="space-y-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mb-2">Integrantes del Equipo ({groupMembers.length})</p>
                  {loadingMembers ? (
                    <div className="flex justify-center py-4"><Loader2 className="animate-spin text-emerald-500" size={20} /></div>
                  ) : (
                    [...groupMembers]
                      .sort((a, b) => {
                        if (a.id === user.id) return 1;
                        if (b.id === user.id) return -1;
                        return 0;
                      })
                      .map((member, mIdx) => (
                        <div 
                          key={member.id} 
                          className={`flex items-center justify-between p-4 transition-all group/member ${
                            mIdx === 0 ? '' : 'border-t'
                          }`}
                          style={{ borderColor: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 overflow-hidden relative shrink-0 shadow-sm">
                              {member.photo ? (
                                <img src={member.photo} className="w-full h-full object-cover" />
                              ) : (
                                <UserIcon size={18} className="text-emerald-500" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-black tracking-tight" style={{ color: cardStyle.text }}>
                                {member.id === user.id ? 'Tú' : member.name}
                              </p>
                              <p className="text-[8px] font-black text-emerald-500/50 uppercase tracking-[0.2em]">{member.role}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 shrink-0">
                            {member.isAdmin && (
                              <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-xl border border-amber-500/20 shadow-sm">
                                <Shield size={10} className="fill-current" />
                                <span className="text-[8px] font-black uppercase tracking-widest">Admin</span>
                              </div>
                            )}
                            {groupMembers.find(m => m.id === user.id)?.isAdmin && member.id !== user?.id && (
                              <div className="flex items-center gap-1 opacity-0 group-hover/member:opacity-100 transition-all">
                                {!member.isAdmin ? (
                                  <button 
                                    onClick={() => handlePromoteToAdmin(member.id, member.name)}
                                    className="p-2 rounded-lg text-amber-500 hover:bg-amber-500/10 transition-all"
                                    title="Hacer Administrador"
                                  >
                                    <ShieldPlus size={14} />
                                  </button>
                                ) : (
                                  member.id !== selectedConv?.creatorId && (
                                    <button 
                                      onClick={() => handleDemoteAdmin(member.id, member.name)}
                                      className="p-2 rounded-lg text-amber-600 hover:bg-amber-600/10 transition-all"
                                      title="Quitar Administrador"
                                    >
                                      <ShieldMinus size={14} />
                                    </button>
                                  )
                                )}
                                <button 
                                  onClick={() => handleRemoveMember(member.id, member.name)}
                                  className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-all"
                                  title="Eliminar del grupo"
                                >
                                  <UserMinus size={14} />
                                </button>
                              </div>
                            )}
                            {member.id === user.id && (
                              <div className="bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border border-emerald-500/10">
                                Tú
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO GRUPO */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setIsGroupModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border border-white/10 overflow-hidden" style={{ background: dark ? '#0a1510' : '#fff' }}>
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <Users size={24} />
                </div>
                <h2 className="text-xl font-black tracking-tight" style={{ color: cardStyle.text }}>Nuevo Grupo</h2>
              </div>
              <button onClick={() => setIsGroupModalOpen(false)} className="p-2 rounded-xl hover:bg-red-500/10 text-red-400 transition-all"><X size={20} /></button>
            </div>

            <div className="space-y-6">
              {/* Photo Upload */}
              <div className="flex flex-col items-center">
                <div className="relative group">
                  <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center border-2 border-emerald-500/20 overflow-hidden shadow-inner">
                    {groupPhoto ? (
                      <img src={groupPhoto} alt="Grupo" className="w-full h-full object-cover" />
                    ) : (
                      <Users size={32} className="text-emerald-500" />
                    )}
                  </div>
                  <button 
                    type="button"
                    onClick={() => groupPhotoInputRef.current.click()}
                    className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1.5 rounded-lg shadow-lg hover:scale-110 transition-transform z-10"
                  >
                    <Camera size={14} />
                  </button>
                  <input 
                    type="file" 
                    ref={groupPhotoInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (file) {
                        try {
                          const compressed = await compressImage(file, 400, 400, 0.6);
                          setGroupPhoto(compressed);
                        } catch (err) {
                          console.error("Error compressing group photo", err);
                        }
                      }
                    }} 
                  />
                </div>
                <p className="text-[8px] font-black uppercase tracking-widest text-emerald-500/50 mt-2">Icono del Grupo</p>
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest mb-2 text-emerald-500">Nombre del Grupo</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className={`w-full border rounded-xl px-5 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all ${dark ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                  placeholder="Ej: Recepción, Limpieza..."
                />
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest mb-2 text-emerald-500">Seleccionar Miembros</label>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {allUsers.map(u => (
                    <label key={u.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedMembers.includes(u.id)
                      ? 'bg-emerald-500/10 border-emerald-500/30 shadow-inner'
                      : (dark ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-gray-50 border-gray-100 hover:bg-gray-100')
                      }`}>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={selectedMembers.includes(u.id)}
                        onChange={() => {
                          if (selectedMembers.includes(u.id)) {
                            setSelectedMembers(selectedMembers.filter(id => id !== u.id));
                          } else {
                            setSelectedMembers([...selectedMembers, u.id]);
                          }
                        }}
                      />
                      <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 overflow-hidden shrink-0">
                        {u.photo ? <img src={u.photo} className="w-full h-full object-cover" /> : <UserIcon size={18} className="text-emerald-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black truncate" style={{ color: cardStyle.text }}>{u.name}</p>
                        <p className="text-[8px] font-black text-emerald-500/50 uppercase tracking-widest">{u.role?.replace('ROLE_', '')}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${selectedMembers.includes(u.id) ? 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/30' : 'border-gray-300 dark:border-white/10'}`}>
                        {selectedMembers.includes(u.id) && <Check size={12} className="text-white" />}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {statusMsg.text && (
                <div className={`p-4 rounded-2xl text-center text-[10px] font-black uppercase tracking-widest animate-bounce ${statusMsg.type === 'success' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'
                  }`}>
                  {statusMsg.text}
                </div>
              )}

              <button
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || selectedMembers.length === 0 || isCreatingGroup}
                className={`w-full py-4 rounded-2xl font-black text-xs tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-3 ${isCreatingGroup
                  ? 'bg-gray-500 cursor-wait'
                  : (!groupName.trim() || selectedMembers.length === 0)
                    ? 'bg-gray-400/20 text-gray-500 cursor-not-allowed border border-white/5'
                    : 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/25 active:scale-95 text-white'
                  }`}
              >
                {isCreatingGroup ? <Loader2 className="animate-spin" size={18} /> : null}
                {isCreatingGroup ? 'Creando Grupo...' : 'Crear Grupo de Trabajo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AÑADIR MIEMBRO */}
      {isAddMemberModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setIsAddMemberModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border border-white/10 overflow-hidden" style={{ background: dark ? '#0a1510' : '#fff' }}>
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <UserPlus size={24} />
                </div>
                <h2 className="text-xl font-black tracking-tight" style={{ color: cardStyle.text }}>Añadir Miembro</h2>
              </div>
              <button onClick={() => setIsAddMemberModalOpen(false)} className="p-2 rounded-xl hover:bg-red-500/10 text-red-400 transition-all"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mb-2">Selecciona un miembro para añadir a "{selectedConv?.contactName}"</p>
              <div className="max-h-80 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {allUsers
                  .filter(u => !groupMembers.some(m => m.id === u.id))
                  .map(u => (
                    <div 
                      key={u.id} 
                      onClick={() => handleAddMember(u.id, u.name)}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${dark ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}
                    >
                      <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 overflow-hidden shrink-0">
                        {u.photo ? <img src={u.photo} className="w-full h-full object-cover" /> : <UserIcon size={18} className="text-emerald-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black truncate" style={{ color: cardStyle.text }}>{u.name}</p>
                        <p className="text-[8px] font-black text-emerald-500/50 uppercase tracking-widest">{u.role?.replace('ROLE_', '')}</p>
                      </div>
                      <Plus size={16} className="text-emerald-500" />
                    </div>
                  ))
                }
                {allUsers.filter(u => !groupMembers.some(m => m.id === u.id)).length === 0 && (
                  <div className="py-10 text-center opacity-40">
                    <p className="text-xs font-bold" style={{ color: cardStyle.text }}>No hay más usuarios para añadir</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* MODAL DE CONFIRMACIÓN CUSTOM */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => {
            setConfirmModal({ ...confirmModal, isOpen: false });
            if (confirmModal.onCancel) confirmModal.onCancel();
          }} />
          <div className="relative w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-white/5 animate-in fade-in zoom-in duration-300" style={{ background: dark ? '#0a1510' : '#fff' }}>
            <div className="flex flex-col items-center text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 ${confirmModal.btnColor === 'bg-amber-500' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'}`}>
                <AlertTriangle size={32} />
              </div>
              <h2 className="text-xl font-black mb-2 tracking-tight" style={{ color: cardStyle.text }}>{confirmModal.title}</h2>
              <p className="text-sm mb-8 opacity-70 leading-relaxed" style={{ color: cardStyle.text }}>{confirmModal.message}</p>
              
              <div className="w-full">
                {confirmModal.showCustomButtons ? (
                  confirmModal.customButtons
                ) : (
                  <div className="grid grid-cols-2 gap-3 w-full">
                    <button 
                      onClick={() => {
                        setConfirmModal({ ...confirmModal, isOpen: false });
                        if (confirmModal.onCancel) confirmModal.onCancel();
                      }} 
                      className={`py-4 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] ${dark ? 'bg-white/5 text-white' : 'bg-gray-100 text-gray-600'}`}
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={() => {
                        confirmModal.action();
                        setConfirmModal({ ...confirmModal, isOpen: false });
                      }} 
                      className={`${confirmModal.btnColor} text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-black/10 transition-all hover:scale-[1.02] active:scale-[0.98]`}
                    >
                      {confirmModal.btnText}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Read By Modal */}
      {readByModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[200] p-4 animate-in fade-in duration-200" onClick={() => setReadByModal({ isOpen: false, users: [] })}>
          <div className="w-full max-w-sm rounded-[2rem] border shadow-2xl p-6 transform transition-all scale-100" style={{ background: dark ? '#0d1f14' : '#fff', borderColor: dark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0,0,0,0.05)' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black tracking-tight" style={{ color: cardStyle.text }}>Visto por</h3>
              <button onClick={() => setReadByModal({ isOpen: false, users: [] })} className="p-2 rounded-xl bg-gray-100/50 hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-all"><X size={16} /></button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
              {readByModal.users.map((name, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold text-xs">
                    {name.charAt(0)}
                  </div>
                  <span className="font-bold text-sm" style={{ color: cardStyle.text }}>{name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
