import { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

const statusIcon = {
  sent: '✓',
  delivered: '✓✓',
  read: '✓✓',
  failed: '✗',
};

const statusColor = {
  sent: 'text-wa-muted',
  delivered: 'text-wa-muted',
  read: 'text-blue-400',
  failed: 'text-red-400',
};

export default function ChatWindow({ conversation, messages, agents, onSendMessage, onSendNote, onAssign, onSetStatus, onSendTemplate, currentAgent }) {
  const [text, setText] = useState('');
  const [isNote, setIsNote] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversation?.id, isNote]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (isNote) {
      onSendNote(text.trim());
    } else {
      onSendMessage(text.trim());
    }
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const loadTemplates = async () => {
    try {
      const data = await api.getTemplates();
      setTemplates(data);
      setShowTemplates(true);
    } catch {}
  };

  const syncTemplates = async () => {
    setSyncing(true);
    try {
      await api.syncTemplates();
      const data = await api.getTemplates();
      setTemplates(data);
    } catch {}
    setSyncing(false);
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-wa-darker">
        <div className="text-center">
          <div className="w-20 h-20 bg-wa-panel rounded-3xl flex items-center justify-center mx-auto mb-4">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8696A0" strokeWidth="1.5">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <h2 className="text-wa-light text-lg font-medium">WA Inbox</h2>
          <p className="text-wa-muted text-sm mt-1">Selecciona una conversación para empezar</p>
        </div>
      </div>
    );
  }

  // Group messages by date
  let lastDate = '';
  const groupedMessages = messages.map((msg) => {
    const date = formatDate(msg.created_at);
    const showDate = date !== lastDate;
    lastDate = date;
    return { ...msg, showDate, dateLabel: date };
  });

  return (
    <div className="flex-1 flex h-screen">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Chat header */}
        <div className="px-4 py-3 bg-wa-dark border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-wa-input flex items-center justify-center text-wa-muted text-sm font-semibold">
              {(conversation.profile_name || conversation.contact_name || '?').substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-white font-medium text-sm">{conversation.profile_name || conversation.contact_name}</div>
              <div className="text-wa-muted text-xs">+{conversation.phone}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Template button */}
            <button onClick={loadTemplates} className="p-2 text-wa-muted hover:text-white transition rounded-lg hover:bg-wa-panel" title="Templates">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
              </svg>
            </button>

            {/* Status buttons */}
            <select
              value={conversation.status}
              onChange={(e) => onSetStatus(e.target.value)}
              className="bg-wa-input text-wa-light text-xs px-2 py-1.5 rounded-lg border-none focus:outline-none cursor-pointer"
            >
              <option value="open">Abierta</option>
              <option value="pending">Pendiente</option>
              <option value="resolved">Resuelta</option>
            </select>

            {/* Info panel toggle */}
            <button onClick={() => setShowDetails(!showDetails)} className={`p-2 rounded-lg transition ${showDetails ? 'text-wa-green bg-wa-green/10' : 'text-wa-muted hover:text-white hover:bg-wa-panel'}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-16 py-4 bg-wa-darker" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M30 5 L35 15 L25 15Z\' fill=\'%23ffffff\' opacity=\'.015\'/%3E%3C/svg%3E")' }}>
          {groupedMessages.map((msg, i) => (
            <div key={msg.id || i}>
              {msg.showDate && (
                <div className="flex justify-center my-3">
                  <span className="bg-wa-panel text-wa-muted text-[11px] px-3 py-1 rounded-lg">{msg.dateLabel}</span>
                </div>
              )}
              <div className={`flex mb-1.5 message-enter ${msg.sender_type === 'agent' || msg.sender_type === 'system' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[65%] rounded-lg px-3 py-1.5 ${
                  msg.is_note
                    ? 'bg-amber-500/10 border border-amber-500/20 note-stripe'
                    : msg.sender_type === 'contact'
                    ? 'bg-wa-panel'
                    : 'bg-wa-bubble'
                }`}>
                  {/* Agent name for outgoing */}
                  {msg.sender_type === 'agent' && msg.agent_name && (
                    <div className="text-[11px] font-medium mb-0.5" style={{ color: msg.agent_color || '#25D366' }}>
                      {msg.is_note && '📝 '}{msg.agent_name}
                    </div>
                  )}
                  {msg.is_note && !msg.agent_name && (
                    <div className="text-[11px] font-medium text-amber-400 mb-0.5">📝 Nota interna</div>
                  )}

                  {/* Message content */}
                  <div className="text-[13.5px] text-wa-light leading-relaxed whitespace-pre-wrap break-words">
                    {msg.content}
                  </div>

                  {/* Time and status */}
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <span className="text-[10px] text-wa-muted">{formatTime(msg.created_at)}</span>
                    {msg.sender_type === 'agent' && !msg.is_note && (
                      <span className={`text-[10px] ${statusColor[msg.status] || 'text-wa-muted'}`}>
                        {statusIcon[msg.status] || ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="px-4 py-3 bg-wa-dark border-t border-white/5">
          {/* Note toggle */}
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setIsNote(false)}
              className={`text-xs px-3 py-1 rounded-full transition ${!isNote ? 'bg-wa-green text-white' : 'bg-wa-input text-wa-muted hover:text-white'}`}
            >
              💬 Mensaje
            </button>
            <button
              onClick={() => setIsNote(true)}
              className={`text-xs px-3 py-1 rounded-full transition ${isNote ? 'bg-amber-500 text-white' : 'bg-wa-input text-wa-muted hover:text-white'}`}
            >
              📝 Nota
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isNote ? 'Escribe una nota interna...' : 'Escribe un mensaje...'}
              rows={1}
              className={`flex-1 px-4 py-2.5 text-sm text-white rounded-xl focus:outline-none resize-none ${
                isNote ? 'bg-amber-500/10 border border-amber-500/30 placeholder:text-amber-500/50' : 'bg-wa-input placeholder:text-wa-muted'
              }`}
              style={{ maxHeight: '120px' }}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition shrink-0 ${
                isNote
                  ? 'bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/30'
                  : 'bg-wa-green hover:bg-wa-green/80 disabled:bg-wa-green/30'
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </form>
        </div>
      </div>

      {/* Details panel */}
      {showDetails && (
        <div className="w-[300px] bg-wa-dark border-l border-white/5 overflow-y-auto">
          <div className="p-4">
            <div className="text-center mb-6 mt-4">
              <div className="w-20 h-20 rounded-full bg-wa-input flex items-center justify-center text-wa-muted text-2xl font-semibold mx-auto">
                {(conversation.profile_name || conversation.contact_name || '?').substring(0, 2).toUpperCase()}
              </div>
              <h3 className="text-white font-semibold mt-3">{conversation.profile_name || conversation.contact_name}</h3>
              <p className="text-wa-muted text-sm">+{conversation.phone}</p>
            </div>

            {/* Assign agent */}
            <div className="mb-4">
              <label className="text-wa-muted text-xs uppercase tracking-wide block mb-2">Asignar agente</label>
              <select
                value={conversation.assigned_agent_id || ''}
                onChange={(e) => onAssign(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full bg-wa-input text-wa-light text-sm px-3 py-2 rounded-lg focus:outline-none"
              >
                <option value="">Sin asignar</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="mb-4">
              <label className="text-wa-muted text-xs uppercase tracking-wide block mb-2">Estado</label>
              <select
                value={conversation.status}
                onChange={(e) => onSetStatus(e.target.value)}
                className="w-full bg-wa-input text-wa-light text-sm px-3 py-2 rounded-lg focus:outline-none"
              >
                <option value="open">Abierta</option>
                <option value="pending">Pendiente</option>
                <option value="resolved">Resuelta</option>
              </select>
            </div>

            {/* Info */}
            <div className="border-t border-white/5 pt-4 mt-4">
              <div className="text-wa-muted text-xs uppercase tracking-wide mb-2">Información</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-wa-muted">Creada</span>
                  <span className="text-wa-light">{new Date(conversation.created_at).toLocaleDateString('es-ES')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-wa-muted">Mensajes</span>
                  <span className="text-wa-light">{messages.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowTemplates(false)}>
          <div className="bg-wa-dark rounded-xl w-full max-w-md max-h-[70vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center">
              <h3 className="text-white font-semibold">Templates</h3>
              <div className="flex gap-2">
                <button onClick={syncTemplates} disabled={syncing} className="text-xs bg-wa-input text-wa-muted px-3 py-1 rounded-lg hover:text-white">
                  {syncing ? 'Sincronizando...' : '🔄 Sync'}
                </button>
                <button onClick={() => setShowTemplates(false)} className="text-wa-muted hover:text-white">✕</button>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-2">
              {templates.length === 0 ? (
                <div className="text-center text-wa-muted py-8 text-sm">
                  No hay templates. Haz clic en Sync para importar desde Meta.
                </div>
              ) : (
                templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      onSendTemplate(t.name, t.language);
                      setShowTemplates(false);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-wa-panel transition mb-1"
                  >
                    <div className="text-wa-light text-sm font-medium">{t.name}</div>
                    <div className="text-wa-muted text-xs mt-0.5">{t.language} · {t.category}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
