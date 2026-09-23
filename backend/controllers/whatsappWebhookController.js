const crypto = require('crypto');
const whatsappDb = require('../services/whatsappDbService');

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const hasValidWebhookSignature = (req) => {
  const appSecret = String(process.env.WHATSAPP_APP_SECRET || '').trim();
  const signature = String(req.get?.('x-hub-signature-256') || '').trim();
  if (!appSecret || !signature.startsWith('sha256=') || !Buffer.isBuffer(req.rawBody)) return false;
  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex')}`;
  return safeEqual(signature, expected);
};

const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = String(process.env.WHATSAPP_VERIFY_TOKEN || '').trim();
  if (mode === 'subscribe' && verifyToken && safeEqual(token, verifyToken)) {
    console.log('[WHATSAPP_WEBHOOK] verified');
    return res.status(200).send(challenge);
  }
  return res.status(403).end();
};

const upsertCustomer = (phoneNumber, displayName) => {
  const existing = whatsappDb.queryOne(
    `SELECT * FROM whatsapp_customers WHERE phone_number = @phone_number`,
    { phone_number: phoneNumber },
  );

  if (existing) {
    if (displayName && displayName !== existing.display_name) {
      whatsappDb.execute(
        `UPDATE whatsapp_customers SET display_name = @display_name, updated_at = CURRENT_TIMESTAMP WHERE id = @id`,
        { id: existing.id, display_name: displayName },
      );
    }
    return existing.id;
  }

  const result = whatsappDb.execute(
    `INSERT INTO whatsapp_customers (phone_number, display_name) VALUES (@phone_number, @display_name)`,
    { phone_number: phoneNumber, display_name: displayName || null },
  );
  return result.lastInsertRowid;
};

const getOrCreateOpenConversation = (customerId) => {
  const existing = whatsappDb.queryOne(
    `SELECT * FROM whatsapp_conversations WHERE customer_id = @customer_id AND status != 'closed' ORDER BY id DESC LIMIT 1`,
    { customer_id: customerId },
  );
  if (existing) return existing.id;

  const result = whatsappDb.execute(
    `INSERT INTO whatsapp_conversations (customer_id, status) VALUES (@customer_id, 'open')`,
    { customer_id: customerId },
  );
  return result.lastInsertRowid;
};

const insertMessage = ({ conversationId, direction, messageType, body, wamid, sentByUserId = null, isBot = false }) => {
  whatsappDb.execute(
    `INSERT INTO whatsapp_messages (conversation_id, direction, message_type, body, wamid, sent_by_user_id, is_bot)
     VALUES (@conversation_id, @direction, @message_type, @body, @wamid, @sent_by_user_id, @is_bot)`,
    {
      conversation_id: conversationId,
      direction,
      message_type: messageType,
      body: body ?? null,
      wamid: wamid ?? null,
      sent_by_user_id: sentByUserId,
      is_bot: isBot ? 1 : 0,
    },
  );

  whatsappDb.execute(
    `UPDATE whatsapp_conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = @id`,
    { id: conversationId },
  );
};

const extractIncomingMessageBody = (message) => {
  if (message.type === 'text') {
    return { messageType: 'text', body: message.text?.body || '' };
  }
  if (message.type === 'interactive' && message.interactive?.type === 'button_reply') {
    return {
      messageType: 'button_reply',
      body: JSON.stringify(message.interactive.button_reply),
    };
  }
  return { messageType: message.type || 'unknown', body: JSON.stringify(message) };
};

const receiveWebhook = (req, res) => {
  if (!hasValidWebhookSignature(req)) {
    return res.status(403).end();
  }

  const companyId = Number(process.env.WHATSAPP_COMPANY_ID);
  const expectedPhoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const value = req.body?.entry?.[0]?.changes?.[0]?.value;
  const receivedPhoneNumberId = String(value?.metadata?.phone_number_id || '').trim();
  if (!Number.isInteger(companyId) || companyId <= 0 || !expectedPhoneNumberId) {
    console.error('[WHATSAPP_WEBHOOK] WHATSAPP_COMPANY_ID and WHATSAPP_PHONE_NUMBER_ID are required.');
    return res.status(503).end();
  }
  if (!safeEqual(receivedPhoneNumberId, expectedPhoneNumberId)) {
    return res.status(403).end();
  }

  req.whatsappCompanyId = companyId;
  res.status(200).end();

  try {
    const messages = value?.messages;
    if (!messages || !messages.length) return;

    const contactsByWaId = Object.fromEntries(
      (value?.contacts || []).map((contact) => [contact.wa_id, contact.profile?.name || '']),
    );

    for (const message of messages) {
      const phoneNumber = message.from;
      const displayName = contactsByWaId[phoneNumber] || '';
      const customerId = upsertCustomer(phoneNumber, displayName);
      const conversationId = getOrCreateOpenConversation(customerId);
      const { messageType, body } = extractIncomingMessageBody(message);

      insertMessage({
        conversationId,
        direction: 'inbound',
        messageType,
        body,
        wamid: message.id,
      });
    }
  } catch (error) {
    console.error('[WHATSAPP_WEBHOOK] Failed to persist inbound message:', error.message);
  }
};

module.exports = {
  verifyWebhook,
  receiveWebhook,
  upsertCustomer,
  getOrCreateOpenConversation,
  insertMessage,
  hasValidWebhookSignature,
};
