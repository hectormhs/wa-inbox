import { useState, useEffect } from 'react';
import { api } from '../api.js';

export default function NewConversation({ onClose, onCreated }) {
  const [phone, setPhone] = useState('');
  const [contactName, setContactName] = useState('');
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [params, setParams] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getTemplates().then(setTemplates).catch(() => {});
  }, []);

  const selectTemplate = (t) => {
    setSelectedTemplate(t);
    // Extract parameters from template body
    const body = t.components?.find(c => c.type === 'BODY');
    if (body?.text) {
      const matches = body.text.match(/\{\{(\d+)\}\}/g) || [];
      setParams(matches.map(() => ''));
    } else {
      setParams([]);
    }
  };

  const getPreview = () => {
    if (!selectedTemplate) return '';
    const body = selectedTemplate.components?.find(c => c.type === 'BODY');
    if (!body?.text) return '';
    let text = body.text;
    params.forEach((val, i) => {
      text = text.replace(`{{${i + 1}}}`, val || `[param ${i + 1}]`);
    });
    return text;
  };

  const handleSend = async () => {
    if (!phone.trim()) return setError('Introduce un número de teléfono');
    if (!selectedTemplate) return setError('Selecciona un template');

    setSending(true);
    setError('');
    try {
      // Format phone: remove spaces, +, etc
      let cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '');
      if (!cleanPhone.startsWith('34') && cleanPhone.length === 9) {
        cleanPhone = '34' + cleanPhone;
      }

      const components = [];
      if (params.length > 0) {
        components.push({
          type: 'body',
          parameters: params.map(p => ({ type: 'text', text: p })),
        });
      }

      const res = await api.sendNewTemplate(
        cleanPhone,
        selectedTemplate.name,
        selectedTemplate.language || 'es',
        components,
        contactName || cleanPhone
      );

      onCreated(res.conversation_id);
      onClose();
    } catch (err) {
      setError(err.message);
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-wa-dark rounded-xl w-full max-w-lg max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center">
          <h2 className="text-white font-semibold">Nueva conversación</h2>
          <button onClick={onClose} className="text-wa-muted hover:text-white text-lg">✕</button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[70vh]">
          {error && (
            <div className="mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg">
              {error}
            </div>
          )}

          {/* Phone & Name */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div>
              <label className="text-wa-muted text-xs uppercase tracking-wide block mb-1.5">Teléfono *</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="34612345678"
                className="w-full bg-wa-input text-white text-sm px-3 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-wa-green/50 placeholder:text-wa-muted/50"
                autoFocus
              />
            </div>
            <div>
              <label className="text-wa-muted text-xs uppercase tracking-wide block mb-1.5">Nombre (opcional)</label>
              <input
                type="text"
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                placeholder="Héctor"
                className="w-full bg-wa-input text-white text-sm px-3 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-wa-green/50 placeholder:text-wa-muted/50"
              />
            </div>
          </div>

          {/* Template selection */}
          <div className="mb-4">
            <label className="text-wa-muted text-xs uppercase tracking-wide block mb-1.5">
              Template * <span className="normal-case text-wa-muted/50">(obligatorio para iniciar conversación)</span>
            </label>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {templates.length === 0 ? (
                <div className="text-wa-muted text-sm py-4 text-center">
                  No hay templates. Ve a Configuración → WhatsApp API → Probar conexión primero.
                </div>
              ) : (
                templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => selectTemplate(t)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                      selectedTemplate?.id === t.id
                        ? 'bg-wa-green/20 border border-wa-green/40 text-white'
                        : 'bg-wa-input text-wa-muted hover:text-white hover:bg-wa-panel'
                    }`}
                  >
                    <span className="font-medium">{t.name}</span>
                    <span className="text-wa-muted/60 ml-2 text-xs">{t.language}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Template parameters */}
          {selectedTemplate && params.length > 0 && (
            <div className="mb-4">
              <label className="text-wa-muted text-xs uppercase tracking-wide block mb-1.5">Parámetros del template</label>
              <div className="space-y-2">
                {params.map((val, i) => (
                  <input
                    key={i}
                    type="text"
                    value={val}
                    onChange={e => {
                      const newParams = [...params];
                      newParams[i] = e.target.value;
                      setParams(newParams);
                    }}
                    placeholder={`Parámetro {{${i + 1}}}`}
                    className="w-full bg-wa-input text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-wa-green/50 placeholder:text-wa-muted/50"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {selectedTemplate && (
            <div className="mb-5">
              <label className="text-wa-muted text-xs uppercase tracking-wide block mb-1.5">Vista previa</label>
              <div className="bg-wa-bubble/50 rounded-lg px-4 py-3 text-wa-light text-sm whitespace-pre-wrap">
                {getPreview()}
              </div>
            </div>
          )}

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={sending || !phone.trim() || !selectedTemplate}
            className="w-full py-3 bg-wa-green text-white font-semibold rounded-lg hover:bg-wa-green/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? 'Enviando...' : '📤 Enviar template'}
          </button>

          <p className="text-wa-muted text-xs text-center mt-3">
            Según las normas de Meta, el primer mensaje debe ser siempre un template aprobado.
          </p>
        </div>
      </div>
    </div>
  );
}
