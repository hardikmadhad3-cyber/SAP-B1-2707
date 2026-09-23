import apiClient from './client';

const BASE = '/whatsapp';

export const getWhatsAppStats = () => apiClient.get(`${BASE}/stats`).then((r) => r.data);

export const listConversations = (status = '') =>
  apiClient.get(`${BASE}/conversations`, { params: { status } }).then((r) => r.data);

export const getConversationMessages = (conversationId) =>
  apiClient.get(`${BASE}/conversations/${conversationId}/messages`).then((r) => r.data);

export const sendConversationReply = (conversationId, body) =>
  apiClient.post(`${BASE}/conversations/${conversationId}/reply`, { body }).then((r) => r.data);

export const updateConversationStatus = (conversationId, status) =>
  apiClient.patch(`${BASE}/conversations/${conversationId}/status`, { status }).then((r) => r.data);

export const updateCustomerCardCode = (customerId, cardCode) =>
  apiClient.patch(`${BASE}/customers/${customerId}`, { card_code: cardCode }).then((r) => r.data);

export const sendDocumentPdfToWhatsApp = ({
  documentType,
  docEntry,
  docNum,
  series,
  cardCode,
  docCode,
  schema,
  reportParameters,
  phoneNumber,
}) =>
  apiClient.post(`${BASE}/send-document`, {
    documentType,
    docEntry,
    docNum,
    series,
    cardCode,
    docCode,
    schema,
    reportParameters,
    phoneNumber,
  }).then((r) => r.data);

export const listWhatsAppDocumentTypes = () => apiClient.get(`${BASE}/document-types`).then((r) => r.data);

export const listMessageTemplates = () => apiClient.get(`${BASE}/message-templates`).then((r) => r.data);

export const saveMessageTemplate = (documentType, templateBody) =>
  apiClient.put(`${BASE}/message-templates/${documentType}`, { template_body: templateBody }).then((r) => r.data);

export const deleteMessageTemplate = (documentType) =>
  apiClient.delete(`${BASE}/message-templates/${documentType}`).then((r) => r.data);
