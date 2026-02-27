import axios from 'axios';

const META_API = 'https://graph.facebook.com/v21.0';

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

export async function sendTextMessage(to, text) {
  const phoneId = process.env.META_PHONE_NUMBER_ID;
  const res = await axios.post(
    `${META_API}/${phoneId}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    },
    { headers: getHeaders() }
  );
  return res.data;
}

export async function sendTemplateMessage(to, templateName, language = 'es', components = []) {
  const phoneId = process.env.META_PHONE_NUMBER_ID;
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
    },
  };
  if (components.length > 0) {
    payload.template.components = components;
  }
  const res = await axios.post(`${META_API}/${phoneId}/messages`, payload, { headers: getHeaders() });
  return res.data;
}

export async function uploadMediaToMeta(fileBuffer, mimeType, filename) {
  const phoneId = process.env.META_PHONE_NUMBER_ID;
  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer], { type: mimeType }), filename);
  formData.append('type', mimeType);
  formData.append('messaging_product', 'whatsapp');

  const res = await fetch(`${META_API}/${phoneId}/media`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
    },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Media upload failed');
  return data.id;
}

export async function sendMediaMessage(to, type, mediaId, caption, filename) {
  const phoneId = process.env.META_PHONE_NUMBER_ID;
  const mediaPayload = { id: mediaId };
  if (caption && type !== 'audio') mediaPayload.caption = caption;
  if (type === 'document' && filename) mediaPayload.filename = filename;

  const res = await axios.post(
    `${META_API}/${phoneId}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type,
      [type]: mediaPayload,
    },
    { headers: getHeaders() }
  );
  return res.data;
}

export async function markAsRead(messageId) {
  const phoneId = process.env.META_PHONE_NUMBER_ID;
  await axios.post(
    `${META_API}/${phoneId}/messages`,
    {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    },
    { headers: getHeaders() }
  );
}

export async function getMediaUrl(mediaId) {
  const res = await axios.get(`${META_API}/${mediaId}`, { headers: getHeaders() });
  return res.data.url;
}

export async function downloadMedia(url) {
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}` },
    responseType: 'arraybuffer',
  });
  return res.data;
}

export async function fetchTemplates() {
  const wabaid = process.env.META_WABA_ID;
  const res = await axios.get(`${META_API}/${wabaid}/message_templates?limit=100`, { headers: getHeaders() });
  return res.data.data || [];
}
