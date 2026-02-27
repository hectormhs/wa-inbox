import { useState } from 'react';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

const statusColors = { open: 'bg-wa-green', pending: 'bg-yellow-500', resolved: 'bg-gray-500' };
const statusLabels = { open: 'Abiertas', pending: 'Pendientes', resolved: 'Resueltas', all: 'Todas' };

export default function ConversationList({ conversations, selectedId, onSelect, filter, onFilterChange, onSearch, agent, onLogout, onOpenSettings, onNewConversation }) {
  const [searchText, setSearchText] = useState('');

  const handleSearch = (val) => {
    setSearchText(val);
    onSearch(val);
  };

  return (
    <div className="w-[360px] min-w-[360px] bg-wa-dark flex flex-col h-screen border-r border-white/5">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-wa-green/20 text-wa-green flex items-center justify-center text-sm font-semibold">
            {getInitials(agent?.name)}
          </div>
          <div>
            <div className="text-white text-sm font-medium">{agent?.name}</div>
            <div className="text-wa-muted text-xs">{agent?.role}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onNewConversation} className="text-wa-muted hover:text-white transition p-1.5" title="Nueva conversación">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /><path d="M12 8v6M9 11h6" />
            </svg>
          </button>
          <button onClick={onOpenSettings} className="text-wa-muted hover:text-white transition p-1.5" title="Configuración">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
          <button onClick={onLogout} className="text-wa-muted hover:text-white transition p-1.5" title="Cerrar sesión">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <svg className="absolute left-3 top-2.5 text-wa-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Buscar conversación..."
            value={searchText}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-wa-input text-white text-sm rounded-lg focus:outline-none placeholder:text-wa-muted"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-3 pb-2 flex gap-1">
        {['open', 'pending', 'resolved', 'all'].map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={`px-3 py-1 text-xs rounded-full transition font-medium ${
              filter === f ? 'bg-wa-green text-white' : 'bg-wa-input text-wa-muted hover:text-white'
            }`}
          >
            {statusLabels[f]}
          </button>
        ))}
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <div className="text-center text-wa-muted text-sm py-12">Sin conversaciones</div>
        )}
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`w-full text-left px-4 py-3 flex items-center gap-3 transition border-b border-white/5 ${
              selectedId === conv.id ? 'bg-wa-panel' : 'hover:bg-wa-panel/50'
            }`}
          >
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-wa-input flex items-center justify-center text-wa-muted text-sm font-semibold shrink-0">
                {getInitials(conv.profile_name || conv.contact_name)}
              </div>
              {conv.unread_count > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-wa-green text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {conv.unread_count > 9 ? '9+' : conv.unread_count}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center">
                <span className={`text-sm truncate ${conv.unread_count > 0 ? 'text-white font-semibold' : 'text-wa-light'}`}>
                  {conv.profile_name || conv.contact_name}
                </span>
                <span className="text-[11px] text-wa-muted shrink-0 ml-2">
                  {timeAgo(conv.last_message_at)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColors[conv.status]}`} />
                <span className={`text-xs truncate ${conv.unread_count > 0 ? 'text-wa-light' : 'text-wa-muted'}`}>
                  {conv.last_message_preview || 'Sin mensajes'}
                </span>
              </div>
              {conv.agent_name && (
                <span className="text-[10px] px-1.5 py-0.5 rounded mt-1 inline-block" style={{ backgroundColor: conv.agent_color + '20', color: conv.agent_color }}>
                  {conv.agent_name}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
