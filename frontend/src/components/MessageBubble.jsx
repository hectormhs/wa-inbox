import { useState } from 'react';

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

const statusIcon = { sent: '✓', delivered: '✓✓', read: '✓✓', failed: '✗' };
const statusColor = { sent: 'text-wa-muted', delivered: 'text-wa-muted', read: 'text-blue-400', failed: 'text-red-400' };

export default function MessageBubble({ msg }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [showFullImg, setShowFullImg] = useState(false);

  const isOutgoing = msg.sender_type === 'agent' || msg.sender_type === 'system';
  const token = localStorage.getItem('wa_token');
  const mediaUrl = msg.media_url ? `/api/media/${msg.id}?token=${token}` : null;

  const bubbleClass = msg.is_note
    ? 'bg-amber-500/10 border border-amber-500/20 note-stripe'
    : msg.sender_type === 'contact'
    ? 'bg-wa-panel'
    : 'bg-wa-bubble';

  return (
    <>
      <div className={`flex mb-1.5 message-enter ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[65%] rounded-lg overflow-hidden ${bubbleClass}`}>
          {/* Agent name */}
          {msg.sender_type === 'agent' && msg.agent_name && (
            <div className="px-3 pt-1.5 text-[11px] font-medium" style={{ color: msg.agent_color || '#25D366' }}>
              {msg.is_note && '📝 '}{msg.agent_name}
            </div>
          )}
          {msg.is_note && !msg.agent_name && (
            <div className="px-3 pt-1.5 text-[11px] font-medium text-amber-400">📝 Nota interna</div>
          )}

          {/* Media content */}
          {renderMedia(msg, mediaUrl, imgLoaded, setImgLoaded, imgError, setImgError, setShowFullImg)}

          {/* Text content */}
          {msg.content && (
            <div className="px-3 py-1 text-[13.5px] text-wa-light leading-relaxed whitespace-pre-wrap break-words">
              {msg.content}
            </div>
          )}

          {/* Time and status */}
          <div className="flex items-center justify-end gap-1 px-3 pb-1.5">
            <span className="text-[10px] text-wa-muted">{formatTime(msg.created_at)}</span>
            {msg.sender_type === 'agent' && !msg.is_note && (
              <span className={`text-[10px] ${statusColor[msg.status] || 'text-wa-muted'}`}>
                {statusIcon[msg.status] || ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen image modal */}
      {showFullImg && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 cursor-pointer"
          onClick={() => setShowFullImg(false)}
        >
          <button className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl">✕</button>
          <img src={mediaUrl} className="max-w-[90vw] max-h-[90vh] object-contain" alt="" />
        </div>
      )}
    </>
  );
}

function renderMedia(msg, mediaUrl, imgLoaded, setImgLoaded, imgError, setImgError, setShowFullImg) {
  if (!mediaUrl && msg.message_type === 'text') return null;

  switch (msg.message_type) {
    case 'image':
    case 'sticker':
      return (
        <div className="relative cursor-pointer" onClick={() => setShowFullImg(true)}>
          {!imgLoaded && !imgError && (
            <div className="w-64 h-48 bg-wa-input animate-pulse flex items-center justify-center">
              <span className="text-wa-muted text-sm">Cargando imagen...</span>
            </div>
          )}
          {imgError ? (
            <div className="w-64 h-32 bg-wa-input flex items-center justify-center">
              <span className="text-wa-muted text-sm">⚠️ Error cargando imagen</span>
            </div>
          ) : (
            <img
              src={mediaUrl}
              alt=""
              className={`max-w-64 rounded-t-lg ${imgLoaded ? '' : 'hidden'}`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
          )}
        </div>
      );

    case 'video':
      return (
        <div className="p-2">
          <video
            src={mediaUrl}
            controls
            className="max-w-64 rounded-lg"
            preload="metadata"
          />
        </div>
      );

    case 'audio':
      return (
        <div className="px-3 pt-2">
          <audio src={mediaUrl} controls className="w-full max-w-64" preload="metadata">
            Tu navegador no soporta audio
          </audio>
        </div>
      );

    case 'document':
      return (
        <a
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 pt-2 pb-1 hover:opacity-80 transition"
          download
        >
          <div className="w-10 h-10 bg-wa-input rounded-lg flex items-center justify-center shrink-0">
            <DocIcon mime={msg.media_mime_type} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-wa-light text-sm truncate">{msg.content || 'Documento'}</div>
            <div className="text-wa-muted text-[11px]">{getMimeLabel(msg.media_mime_type)}</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8696A0" strokeWidth="2" className="shrink-0">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
        </a>
      );

    case 'location':
      try {
        const loc = JSON.parse(msg.content);
        return (
          <a
            href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-3 pt-2 hover:opacity-80 transition"
          >
            <div className="w-64 h-32 bg-wa-input rounded-lg flex items-center justify-center">
              <div className="text-center">
                <span className="text-3xl">📍</span>
                <div className="text-wa-light text-xs mt-1">{loc.name || `${loc.lat}, ${loc.lng}`}</div>
                <div className="text-wa-green text-[11px] mt-0.5">Abrir en Google Maps →</div>
              </div>
            </div>
          </a>
        );
      } catch {
        return null;
      }

    case 'reaction':
      return (
        <div className="px-3 pt-1">
          <span className="text-2xl">{msg.content}</span>
        </div>
      );

    case 'template':
      return (
        <div className="px-3 pt-2">
          <div className="flex items-center gap-2 text-wa-muted text-xs">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
            </svg>
            <span>Template enviado</span>
          </div>
        </div>
      );

    default:
      return null;
  }
}

function DocIcon({ mime }) {
  if (mime?.includes('pdf')) {
    return <span className="text-red-400 text-lg font-bold">PDF</span>;
  }
  if (mime?.includes('word') || mime?.includes('docx') || mime?.includes('doc')) {
    return <span className="text-blue-400 text-lg font-bold">DOC</span>;
  }
  if (mime?.includes('sheet') || mime?.includes('xlsx') || mime?.includes('csv')) {
    return <span className="text-green-400 text-lg font-bold">XLS</span>;
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8696A0" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

function getMimeLabel(mime) {
  if (!mime) return 'Archivo';
  if (mime.includes('pdf')) return 'PDF';
  if (mime.includes('word') || mime.includes('docx')) return 'Word';
  if (mime.includes('sheet') || mime.includes('xlsx')) return 'Excel';
  if (mime.includes('csv')) return 'CSV';
  if (mime.includes('zip') || mime.includes('rar')) return 'Comprimido';
  return mime.split('/').pop()?.toUpperCase() || 'Archivo';
}
