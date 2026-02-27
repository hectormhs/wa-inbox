const BASE = '';

function getToken() {
  return localStorage.getItem('wa_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('wa_token');
    localStorage.removeItem('wa_agent');
    window.location.reload();
    throw new Error('Sesión expirada');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error');
  return data;
}

export const api = {
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/api/auth/me'),
  register: (data) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  getConversations: (status = 'open', search = '') =>
    request(`/api/conversations?status=${status}&search=${encodeURIComponent(search)}`),
  getConversation: (id) => request(`/api/conversations/${id}`),
  assignAgent: (id, agentId) => request(`/api/conversations/${id}/assign`, { method: 'PATCH', body: JSON.stringify({ agent_id: agentId }) }),
  setStatus: (id, status) => request(`/api/conversations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  markRead: (id) => request(`/api/conversations/${id}/read`, { method: 'PATCH' }),

  getMessages: (convId) => request(`/api/messages/${convId}`),
  sendMessage: (convId, content) => request(`/api/messages/${convId}/send`, { method: 'POST', body: JSON.stringify({ content }) }),
  sendTemplate: (convId, templateName, language, components) =>
    request(`/api/messages/${convId}/template`, { method: 'POST', body: JSON.stringify({ template_name: templateName, language, components }) }),
  sendNewTemplate: (phone, templateName, language, components, contactName) =>
    request('/api/messages/new/template', { method: 'POST', body: JSON.stringify({ phone, template_name: templateName, language, components, contact_name: contactName }) }),
  addNote: (convId, content) => request(`/api/messages/${convId}/note`, { method: 'POST', body: JSON.stringify({ content }) }),
  sendMedia: async (convId, file, caption) => {
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);
    if (caption) formData.append('caption', caption);
    const res = await fetch(`${BASE}/api/messages/${convId}/media`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    });
    if (res.status === 401) {
      localStorage.removeItem('wa_token');
      localStorage.removeItem('wa_agent');
      window.location.reload();
      throw new Error('Sesión expirada');
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    return data;
  },

  getAgents: () => request('/api/agents'),

  getTemplates: () => request('/api/templates'),
  syncTemplates: () => request('/api/templates/sync', { method: 'POST' }),

  // Settings
  getSettings: () => request('/api/settings'),
  updateSettings: (data) => request('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),
  testConnection: () => request('/api/settings/test-connection', { method: 'POST' }),
  getSettingsAgents: () => request('/api/settings/agents'),
  createAgent: (data) => request('/api/settings/agents', { method: 'POST', body: JSON.stringify(data) }),
  updateAgent: (id, data) => request(`/api/settings/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSettingsAgent: (id) => request(`/api/settings/agents/${id}`, { method: 'DELETE' }),
};

export function getApiBase() { return window.location.origin; }
