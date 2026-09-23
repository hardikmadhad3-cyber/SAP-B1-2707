const axios = require('axios');

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';

const graphUrl = (suffix) =>
  `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}${suffix}`;

const sendText = async (to, body) => {
  await axios.post(
    graphUrl('/messages'),
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' } },
  );
};

const sendButtonMenu = async (to, bodyText, buttons) => {
  await axios.post(
    graphUrl('/messages'),
    {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons.map(({ id, title }) => ({ type: 'reply', reply: { id, title } })),
        },
      },
    },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' } },
  );
};

const uploadMedia = async (buffer, filename, mimeType) => {
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('file', new Blob([buffer], { type: mimeType }), filename);

  const response = await fetch(graphUrl('/media'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
    body: form,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Failed to upload media to WhatsApp.');
  }
  return data.id;
};

const sendDocument = async (to, mediaId, filename, caption = '') => {
  await axios.post(
    graphUrl('/messages'),
    {
      messaging_product: 'whatsapp',
      to,
      type: 'document',
      document: {
        id: mediaId,
        filename,
        ...(caption ? { caption } : {}),
      },
    },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' } },
  );
};

const sendPdf = async (to, buffer, filename, caption = '') => {
  const mediaId = await uploadMedia(buffer, filename, 'application/pdf');
  await sendDocument(to, mediaId, filename, caption);
};

module.exports = { sendText, sendButtonMenu, sendPdf };
