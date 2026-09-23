import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  getWhatsAppStats,
  listConversations,
  getConversationMessages,
  sendConversationReply,
  updateConversationStatus,
  updateCustomerCardCode,
  sendDocumentPdfToWhatsApp,
} from '../../api/whatsappApi';
import { getBP } from '../../api/businessPartnerApi';
import { fetchARInvoiceList } from '../../api/arInvoiceApi';
import './styles/whatsapp-dashboard.css';

const POLL_INTERVAL_MS = 15000;

const STATUS_OPTIONS = ['open', 'pending', 'closed'];
const DEFAULT_SEND_PHONE = '7801829449';

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(`${value.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
};

const messagePreview = (row) => {
  if (!row) return '';
  if (row.last_message_type === 'button_reply') {
    try {
      const parsed = JSON.parse(row.last_message_body || '{}');
      return parsed.title || 'Button reply';
    } catch {
      return 'Button reply';
    }
  }
  return row.last_message_body || '';
};

export default function WhatsAppDashboard() {
  const [stats, setStats] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [cardCodeInput, setCardCodeInput] = useState('');
  const [insights, setInsights] = useState(null);
  const [insightsError, setInsightsError] = useState('');
  const [arInvoices, setArInvoices] = useState([]);
  const [arInvoicesLoading, setArInvoicesLoading] = useState(false);
  const [sendPhone, setSendPhone] = useState(DEFAULT_SEND_PHONE);
  const [sendingDocEntry, setSendingDocEntry] = useState(null);
  const messagesEndRef = useRef(null);

  const selectedConversation = conversations.find((c) => c.id === selectedId) || null;

  const refreshConversations = useCallback(async () => {
    try {
      const rows = await listConversations(statusFilter);
      setConversations(rows);
    } catch {
      // silent — next poll retries
    }
  }, [statusFilter]);

  const refreshStats = useCallback(async () => {
    try {
      setStats(await getWhatsAppStats());
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    refreshConversations();
    refreshStats();
    const interval = setInterval(() => {
      refreshConversations();
      refreshStats();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshConversations, refreshStats]);

  const refreshMessages = useCallback(async (conversationId) => {
    if (!conversationId) return;
    try {
      const rows = await getConversationMessages(conversationId);
      setMessages(rows);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    refreshMessages(selectedId);
    const interval = setInterval(() => refreshMessages(selectedId), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [selectedId, refreshMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setCardCodeInput(selectedConversation?.card_code || '');
    setInsights(null);
    setInsightsError('');
    setArInvoices([]);

    if (selectedConversation?.card_code) {
      getBP(selectedConversation.card_code)
        .then(setInsights)
        .catch((err) => setInsightsError(err?.response?.data?.message || 'Could not load SAP customer data.'));

      setArInvoicesLoading(true);
      fetchARInvoiceList({ customerCode: selectedConversation.card_code, pageSize: 10 })
        .then((response) => setArInvoices(response.data?.ar_invoices || []))
        .catch(() => setArInvoices([]))
        .finally(() => setArInvoicesLoading(false));
    }
  }, [selectedConversation?.id, selectedConversation?.card_code]);

  const handleSendInvoice = async (invoice) => {
    setSendingDocEntry(invoice.doc_entry);
    try {
      await sendDocumentPdfToWhatsApp({
        documentType: 'arInvoice',
        docEntry: invoice.doc_entry,
        docNum: invoice.doc_num,
        cardCode: selectedConversation?.card_code,
        phoneNumber: sendPhone,
      });
      window.alert(`Invoice ${invoice.doc_num} sent to +${sendPhone.length === 10 ? '91' : ''}${sendPhone}.`);
      await refreshConversations();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Failed to send invoice PDF.');
    } finally {
      setSendingDocEntry(null);
    }
  };

  const handleSelectConversation = (id) => {
    setSelectedId(id);
    setReplyText('');
  };

  const handleSendReply = async () => {
    const body = replyText.trim();
    if (!body || !selectedId) return;
    setSending(true);
    try {
      await sendConversationReply(selectedId, body);
      setReplyText('');
      await refreshMessages(selectedId);
      await refreshConversations();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Failed to send reply.');
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (event) => {
    const status = event.target.value;
    if (!selectedId) return;
    try {
      await updateConversationStatus(selectedId, status);
      await refreshConversations();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Failed to update status.');
    }
  };

  const handleSaveCardCode = async (event) => {
    event.preventDefault();
    if (!selectedConversation?.customer_id) return;
    try {
      await updateCustomerCardCode(selectedConversation.customer_id, cardCodeInput.trim());
      await refreshConversations();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Failed to save Card Code.');
    }
  };

  return (
    <div className="wa-page">
      <div className="wa-stats">
        <div className="wa-stat-card">
          <div className="wa-stat-card__label">Total Conversations</div>
          <div className="wa-stat-card__value">{stats?.total_conversations ?? '—'}</div>
        </div>
        <div className="wa-stat-card">
          <div className="wa-stat-card__label">Open</div>
          <div className="wa-stat-card__value">{stats?.open_conversations ?? '—'}</div>
        </div>
        <div className="wa-stat-card">
          <div className="wa-stat-card__label">Pending</div>
          <div className="wa-stat-card__value">{stats?.pending_conversations ?? '—'}</div>
        </div>
        <div className="wa-stat-card">
          <div className="wa-stat-card__label">Total Messages</div>
          <div className="wa-stat-card__value">{stats?.total_messages ?? '—'}</div>
        </div>
      </div>

      <div className="wa-layout">
        <div className="wa-panel">
          <div className="wa-panel__header">
            Conversations
            <select
              className="wa-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ marginLeft: 'auto' }}
            >
              <option value="">All</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="wa-panel__body">
            {conversations.length === 0 && <div className="wa-empty">No conversations yet.</div>}
            {conversations.map((c) => (
              <div
                key={c.id}
                className={`wa-convo ${c.id === selectedId ? 'wa-convo--active' : ''}`}
                onClick={() => handleSelectConversation(c.id)}
              >
                <div className="wa-convo__top">
                  <span className="wa-convo__name">{c.display_name || c.phone_number}</span>
                  <span className="wa-convo__time">{formatTime(c.last_message_at || c.created_at)}</span>
                </div>
                <div className="wa-convo__preview">{messagePreview(c)}</div>
                <span className={`wa-badge wa-badge--${c.status}`}>{c.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="wa-panel">
          <div className="wa-panel__header">
            {selectedConversation ? (selectedConversation.display_name || selectedConversation.phone_number) : 'Select a conversation'}
            {selectedConversation && (
              <select
                className="wa-status-filter"
                value={selectedConversation.status}
                onChange={handleStatusChange}
                style={{ marginLeft: 'auto' }}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
          </div>
          <div className="wa-chat">
            <div className="wa-chat__messages">
              {!selectedConversation && <div className="wa-empty">Pick a conversation on the left to view messages.</div>}
              {messages.map((m) => (
                <div key={m.id} className={`wa-bubble wa-bubble--${m.direction}`}>
                  {m.message_type === 'text' ? m.body : `[${m.message_type}] ${m.body || ''}`}
                  <span className="wa-bubble__meta">
                    {m.is_bot ? 'Bot' : m.direction === 'outbound' ? 'Agent' : ''} · {formatTime(m.created_at)}
                  </span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            {selectedConversation && (
              <div className="wa-reply-box">
                <textarea
                  placeholder="Type a reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                />
                <button
                  type="button"
                  className="qc-btn qc-btn--primary"
                  disabled={sending || !replyText.trim()}
                  onClick={handleSendReply}
                >
                  Send
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="wa-panel">
          <div className="wa-panel__header">SAP Insights</div>
          <div className="wa-panel__body">
            {!selectedConversation && <div className="wa-empty">No conversation selected.</div>}
            {selectedConversation && (
              <>
                <div className="wa-insights__section">
                  <div className="wa-insights__label">Customer</div>
                  <div className="wa-insights__row"><span>Name</span><span>{selectedConversation.display_name || '—'}</span></div>
                  <div className="wa-insights__row"><span>Phone</span><span>{selectedConversation.phone_number}</span></div>
                </div>
                <div className="wa-insights__section">
                  <div className="wa-insights__label">SAP Card Code</div>
                  <form className="wa-cardcode-form" onSubmit={handleSaveCardCode}>
                    <input
                      value={cardCodeInput}
                      onChange={(e) => setCardCodeInput(e.target.value)}
                      placeholder="e.g. C0001"
                    />
                    <button type="submit" className="qc-btn">Save</button>
                  </form>
                </div>
                {insightsError && <div className="wa-insights__section" style={{ color: 'var(--sap-danger)', fontSize: 12 }}>{insightsError}</div>}
                {insights && (
                  <div className="wa-insights__section">
                    <div className="wa-insights__label">Business Partner</div>
                    <div className="wa-insights__row"><span>Name</span><span>{insights.CardName}</span></div>
                    <div className="wa-insights__row"><span>Balance</span><span>{insights.CurrentAccountBalance}</span></div>
                    <div className="wa-insights__row"><span>Credit Line</span><span>{insights.CreditLine}</span></div>
                  </div>
                )}
                {selectedConversation.card_code && (
                  <div className="wa-insights__section">
                    <div className="wa-insights__label">Send To (WhatsApp Number)</div>
                    <input
                      className="wa-send-phone"
                      value={sendPhone}
                      onChange={(e) => setSendPhone(e.target.value)}
                      placeholder="e.g. 7801829449"
                    />
                    <div className="wa-insights__label" style={{ marginTop: 10 }}>A/R Invoices</div>
                    {arInvoicesLoading && <div className="wa-empty" style={{ padding: 8 }}>Loading invoices...</div>}
                    {!arInvoicesLoading && arInvoices.length === 0 && (
                      <div className="wa-empty" style={{ padding: 8 }}>No A/R invoices found for this customer.</div>
                    )}
                    {arInvoices.map((invoice) => (
                      <div key={invoice.doc_entry} className="wa-invoice-row">
                        <div>
                          <div className="wa-invoice-row__num">INV {invoice.doc_num}</div>
                          <div className="wa-invoice-row__meta">{invoice.posting_date?.slice(0, 10)} · {invoice.total_amount} {invoice.currency}</div>
                        </div>
                        <button
                          type="button"
                          className="qc-btn qc-btn--primary"
                          disabled={sendingDocEntry === invoice.doc_entry}
                          onClick={() => handleSendInvoice(invoice)}
                        >
                          {sendingDocEntry === invoice.doc_entry ? 'Sending...' : 'Send PDF'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
