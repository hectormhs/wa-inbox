import { useState, useEffect } from 'react';
import { api } from '../api.js';

const AGENT_COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444', '#06B6D4', '#84CC16'];

export default function Settings({ agent, onClose }) {
  const [tab, setTab] = useState('meta');
  const [meta, setMeta] = useState({
    meta_access_token: '',
    meta_phone_number_id: '',
    meta_waba_id: '',
    meta_verify_token: '',
    webhook_url: '',
  });
  const [source, setSource] = useState({});
  const [agents, setAgents] = useState([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [message, setMessage] = useState(null);

  // New agent form
  const [newAgent, setNewAgent] = useState({ name: '', email: '', password: '', role: 'agent', color: '#3B82F6' });
  const [showNewAgent, setShowNewAgent] = useState(false);

  useEffect(() => {
    loadSettings();
    loadAgents();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.getSettings();
      setMeta(data.meta);
      setSource(data.source);
    } catch {}
  };

  const loadAgents = async () => {
    try {
      const data = await api.getSettingsAgents();
      setAgents(data);
    } catch {}
  };

  const saveMeta = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.updateSettings(meta);
      setMessage({ type: 'success', text: 'Configuración guardada correctamente' });
      loadSettings();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
    setSaving(false);
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testConnection();
      setTestResult(res);
    } catch (err) {
      setTestResult({ ok: false, message: err.message });
    }
    setTesting(false);
  };

  const createAgent = async () => {
    try {
      await api.createAgent(newAgent);
      setNewAgent({ name: '', email: '', password: '', role: 'agent', color: '#3B82F6' });
      setShowNewAgent(false);
      loadAgents();
      setMessage({ type: 'success', text: 'Agente creado' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const deleteAgent = async (id, name) => {
    if (!confirm(`¿Eliminar al agente ${name}?`)) return;
    try {
      await api.deleteSettingsAgent(id);
      loadAgents();
      setMessage({ type: 'success', text: 'Agente eliminado' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const tabs = [
    { id: 'meta', label: 'WhatsApp API', icon: '📱' },
    { id: 'agents', label: 'Agentes', icon: '👥' },
    { id: 'webhook', label: 'Webhook', icon: '🔗' },
  ];

  return (
    <div className="flex-1 flex flex-col h-screen bg-wa-darker">
      {/* Header */}
      <div className="px-6 py-4 bg-wa-dark border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-wa-muted hover:text-white transition">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-white text-lg font-semibold">Configuración</h1>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar tabs */}
        <div className="w-56 bg-wa-dark border-r border-white/5 py-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setMessage(null); }}
              className={`w-full text-left px-5 py-3 text-sm flex items-center gap-3 transition ${
                tab === t.id ? 'bg-wa-panel text-white' : 'text-wa-muted hover:text-white hover:bg-wa-panel/50'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 max-w-2xl">
          {/* Status message */}
          {message && (
            <div className={`mb-6 px-4 py-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              {message.text}
            </div>
          )}

          {/* META API TAB */}
          {tab === 'meta' && (
            <div>
              <h2 className="text-white text-lg font-semibold mb-1">WhatsApp Cloud API</h2>
              <p className="text-wa-muted text-sm mb-6">Configura los credenciales de Meta para enviar y recibir mensajes.</p>

              <div className="space-y-5">
                <Field
                  label="Access Token"
                  sublabel={source.meta_access_token === 'env' ? '(configurado via variable de entorno)' : ''}
                  value={meta.meta_access_token}
                  onChange={(v) => setMeta({ ...meta, meta_access_token: v })}
                  placeholder="EAAxxxxxxx..."
                  type="password"
                />
                <Field
                  label="Phone Number ID"
                  sublabel={source.meta_phone_number_id === 'env' ? '(configurado via variable de entorno)' : ''}
                  value={meta.meta_phone_number_id}
                  onChange={(v) => setMeta({ ...meta, meta_phone_number_id: v })}
                  placeholder="123456789012345"
                />
                <Field
                  label="WhatsApp Business Account ID (WABA)"
                  sublabel={source.meta_waba_id === 'env' ? '(configurado via variable de entorno)' : ''}
                  value={meta.meta_waba_id}
                  onChange={(v) => setMeta({ ...meta, meta_waba_id: v })}
                  placeholder="123456789012345"
                />
                <Field
                  label="Verify Token (para el webhook)"
                  value={meta.meta_verify_token}
                  onChange={(v) => setMeta({ ...meta, meta_verify_token: v })}
                  placeholder="mi-token-secreto"
                />
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={saveMeta}
                  disabled={saving}
                  className="px-5 py-2.5 bg-wa-green text-white text-sm font-medium rounded-lg hover:bg-wa-green/90 transition disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar configuración'}
                </button>
                <button
                  onClick={testConnection}
                  disabled={testing}
                  className="px-5 py-2.5 bg-wa-input text-wa-light text-sm font-medium rounded-lg hover:bg-wa-panel transition disabled:opacity-50"
                >
                  {testing ? 'Probando...' : '🔌 Probar conexión'}
                </button>
              </div>

              {testResult && (
                <div className={`mt-4 px-4 py-3 rounded-lg text-sm ${
                  testResult.ok
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}>
                  {testResult.ok ? '✅' : '❌'} {testResult.message}
                </div>
              )}

              <div className="mt-8 p-4 bg-wa-panel/50 rounded-lg border border-white/5">
                <h3 className="text-wa-light text-sm font-medium mb-2">¿Dónde encuentro estos datos?</h3>
                <ol className="text-wa-muted text-sm space-y-1 list-decimal list-inside">
                  <li>Ve a <span className="text-wa-light">developers.facebook.com</span> → Tu app</li>
                  <li><span className="text-wa-light">WhatsApp → API Setup</span> para el Phone Number ID y token</li>
                  <li><span className="text-wa-light">WhatsApp → API Setup</span> para el WABA ID (aparece arriba)</li>
                  <li>El Verify Token lo eliges tú (tiene que coincidir con el del webhook)</li>
                </ol>
              </div>
            </div>
          )}

          {/* AGENTS TAB */}
          {tab === 'agents' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-white text-lg font-semibold mb-1">Agentes</h2>
                  <p className="text-wa-muted text-sm">Gestiona quién puede acceder al inbox.</p>
                </div>
                <button
                  onClick={() => setShowNewAgent(!showNewAgent)}
                  className="px-4 py-2 bg-wa-green text-white text-sm font-medium rounded-lg hover:bg-wa-green/90 transition"
                >
                  + Nuevo agente
                </button>
              </div>

              {/* New agent form */}
              {showNewAgent && (
                <div className="mb-6 p-4 bg-wa-panel rounded-xl border border-white/5">
                  <h3 className="text-white text-sm font-medium mb-4">Nuevo agente</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Nombre" value={newAgent.name} onChange={(v) => setNewAgent({ ...newAgent, name: v })} placeholder="Alberto" />
                    <Field label="Email" value={newAgent.email} onChange={(v) => setNewAgent({ ...newAgent, email: v })} placeholder="alberto@empresa.com" />
                    <Field label="Contraseña" value={newAgent.password} onChange={(v) => setNewAgent({ ...newAgent, password: v })} placeholder="••••••" type="password" />
                    <div>
                      <label className="text-wa-muted text-xs uppercase tracking-wide block mb-1.5">Rol</label>
                      <select
                        value={newAgent.role}
                        onChange={(e) => setNewAgent({ ...newAgent, role: e.target.value })}
                        className="w-full bg-wa-input text-wa-light text-sm px-3 py-2.5 rounded-lg focus:outline-none"
                      >
                        <option value="agent">Agente</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="text-wa-muted text-xs uppercase tracking-wide block mb-1.5">Color</label>
                    <div className="flex gap-2">
                      {AGENT_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setNewAgent({ ...newAgent, color: c })}
                          className={`w-8 h-8 rounded-full transition ${newAgent.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-wa-panel' : 'hover:scale-110'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={createAgent} className="px-4 py-2 bg-wa-green text-white text-sm rounded-lg hover:bg-wa-green/90">
                      Crear
                    </button>
                    <button onClick={() => setShowNewAgent(false)} className="px-4 py-2 bg-wa-input text-wa-muted text-sm rounded-lg hover:text-white">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Agent list */}
              <div className="space-y-2">
                {agents.map((a) => (
                  <div key={a.id} className="flex items-center justify-between px-4 py-3 bg-wa-panel rounded-xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold" style={{ backgroundColor: a.color }}>
                        {a.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-wa-light text-sm font-medium flex items-center gap-2">
                          {a.name}
                          {a.is_online && <span className="w-2 h-2 bg-wa-green rounded-full" />}
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-wa-input text-wa-muted">{a.role}</span>
                        </div>
                        <div className="text-wa-muted text-xs">{a.email}</div>
                      </div>
                    </div>
                    {a.id !== agent.id && (
                      <button
                        onClick={() => deleteAgent(a.id, a.name)}
                        className="text-wa-muted hover:text-red-400 transition p-1"
                        title="Eliminar"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WEBHOOK TAB */}
          {tab === 'webhook' && (
            <div>
              <h2 className="text-white text-lg font-semibold mb-1">Webhook</h2>
              <p className="text-wa-muted text-sm mb-6">Configura el webhook en Meta Developers para recibir mensajes.</p>

              <div className="p-5 bg-wa-panel rounded-xl border border-white/5 mb-6">
                <h3 className="text-wa-light text-sm font-medium mb-3">Pasos para configurar el webhook:</h3>
                <ol className="text-wa-muted text-sm space-y-3 list-decimal list-inside">
                  <li>
                    Ve a <span className="text-wa-light">developers.facebook.com</span> → Tu App → WhatsApp → Configuration
                  </li>
                  <li>
                    En <span className="text-wa-light">Callback URL</span>, pon:
                    <div className="mt-1.5 flex items-center gap-2">
                      <code className="bg-wa-darker px-3 py-1.5 rounded text-wa-green text-xs font-mono">
                        https://TU-DOMINIO/webhook
                      </code>
                      <button
                        onClick={() => {
                          const url = window.location.origin + '/webhook';
                          navigator.clipboard.writeText(url);
                          setMessage({ type: 'success', text: `URL copiada: ${url}` });
                        }}
                        className="text-wa-muted hover:text-white text-xs px-2 py-1 bg-wa-input rounded"
                      >
                        📋 Copiar
                      </button>
                    </div>
                  </li>
                  <li>
                    En <span className="text-wa-light">Verify Token</span>, pon el mismo que has configurado arriba en WhatsApp API
                  </li>
                  <li>
                    En <span className="text-wa-light">Webhook Fields</span>, suscríbete a: <span className="text-wa-light">messages</span>
                  </li>
                </ol>
              </div>

              <div className="p-4 bg-amber-500/5 rounded-xl border border-amber-500/20">
                <div className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">⚠️</span>
                  <div className="text-sm">
                    <p className="text-amber-300 font-medium">Importante</p>
                    <p className="text-wa-muted mt-1">
                      Para que el webhook funcione, tu app necesita ser accesible desde internet con HTTPS.
                      Si estás probando en local, puedes usar <span className="text-wa-light">ngrok</span> para crear un túnel temporal.
                    </p>
                    <code className="block mt-2 bg-wa-darker px-3 py-1.5 rounded text-wa-muted text-xs font-mono">
                      ngrok http 8080
                    </code>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, sublabel, value, onChange, placeholder, type = 'text' }) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <label className="text-wa-muted text-xs uppercase tracking-wide block mb-1.5">
        {label}
        {sublabel && <span className="text-wa-muted/50 normal-case ml-1">{sublabel}</span>}
      </label>
      <div className="relative">
        <input
          type={type === 'password' && !show ? 'password' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-wa-input text-wa-light text-sm px-3 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-wa-green/50 placeholder:text-wa-muted/50"
        />
        {type === 'password' && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-2.5 text-wa-muted hover:text-white text-xs"
          >
            {show ? '🙈' : '👁️'}
          </button>
        )}
      </div>
    </div>
  );
}
