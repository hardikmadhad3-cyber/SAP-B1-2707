import React, { useEffect, useMemo, useState } from 'react';
import {
  listWhatsAppDocumentTypes,
  listMessageTemplates,
  saveMessageTemplate,
  deleteMessageTemplate,
} from '../../api/whatsappApi';
import './styles/whatsapp-configuration.css';

const PLACEHOLDERS = [
  { key: 'documentLabel', hint: 'e.g. A/R Invoice' },
  { key: 'docNum', hint: 'Document number' },
  { key: 'docEntry', hint: 'Internal document key' },
  { key: 'cardCode', hint: 'Customer/Vendor code' },
  { key: 'cardName', hint: 'Customer/Vendor name' },
];

const DEFAULT_TEMPLATE_BODY =
  'Dear {{cardName}},\n\nPlease find attached your {{documentLabel}} #{{docNum}}.\n\nThank you for your business.';

export default function WhatsAppConfiguration() {
  const [documentTypes, setDocumentTypes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('');
  const [templateBody, setTemplateBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const templateByType = useMemo(
    () => Object.fromEntries(templates.map((t) => [t.document_type, t])),
    [templates],
  );

  const refresh = () => {
    setLoading(true);
    Promise.all([listWhatsAppDocumentTypes(), listMessageTemplates()])
      .then(([types, templateRows]) => {
        setDocumentTypes(types);
        setTemplates(templateRows);
      })
      .catch(() => setMessage({ type: 'error', text: 'Failed to load WhatsApp configuration.' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const selectType = (key) => {
    setSelectedType(key);
    setMessage(null);
    const existing = templateByType[key];
    setTemplateBody(existing ? existing.template_body : DEFAULT_TEMPLATE_BODY);
  };

  const insertPlaceholder = (key) => {
    setTemplateBody((current) => `${current}{{${key}}}`);
  };

  const handleSave = async () => {
    if (!selectedType || !templateBody.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      await saveMessageTemplate(selectedType, templateBody.trim());
      setMessage({ type: 'success', text: 'Template saved.' });
      refresh();
    } catch (err) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to save template.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedType || !templateByType[selectedType]) return;
    if (!window.confirm('Remove this template? The PDF will be sent without a caption for this document type.')) return;
    setSaving(true);
    try {
      await deleteMessageTemplate(selectedType);
      setTemplateBody(DEFAULT_TEMPLATE_BODY);
      setMessage({ type: 'success', text: 'Template removed.' });
      refresh();
    } catch (err) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to remove template.' });
    } finally {
      setSaving(false);
    }
  };

  const selectedLabel = documentTypes.find((d) => d.key === selectedType)?.label || '';

  return (
    <div className="wac-page">
      <div className="wac-toolbar">
        <span className="wac-toolbar__title">WhatsApp Configuration</span>
        <span className="wac-toolbar__subtitle">
          Assign a message template per transaction type. It's used as the caption sent
          alongside the PDF when "Send WhatsApp" is clicked on that transaction's print toolbar.
        </span>
      </div>

      <div className="wac-layout">
        <div className="wac-panel wac-panel--list">
          <div className="wac-panel__header">Transaction Types</div>
          <div className="wac-panel__body">
            {loading && <div className="wac-empty">Loading...</div>}
            {!loading && documentTypes.map((docType) => {
              const hasTemplate = Boolean(templateByType[docType.key]);
              return (
                <div
                  key={docType.key}
                  className={`wac-row ${selectedType === docType.key ? 'wac-row--active' : ''}`}
                  onClick={() => selectType(docType.key)}
                >
                  <span className="wac-row__label">{docType.label}</span>
                  <span className={`wac-pill ${hasTemplate ? 'wac-pill--configured' : 'wac-pill--empty'}`}>
                    {hasTemplate ? 'Configured' : 'Not set'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="wac-panel wac-panel--editor">
          <div className="wac-panel__header">{selectedLabel || 'Select a transaction type'}</div>
          <div className="wac-panel__body wac-editor">
            {!selectedType && <div className="wac-empty">Choose a transaction type on the left to configure its WhatsApp message.</div>}
            {selectedType && (
              <>
                <label className="wac-field-label" htmlFor="wac-template-body">Message Template</label>
                <textarea
                  id="wac-template-body"
                  className="wac-textarea"
                  value={templateBody}
                  onChange={(e) => setTemplateBody(e.target.value)}
                  rows={8}
                  placeholder="Type the message that will be sent as the document caption..."
                />

                <div className="wac-placeholders">
                  <div className="wac-field-label">Insert Placeholder</div>
                  <div className="wac-placeholders__list">
                    {PLACEHOLDERS.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        className="wac-chip"
                        title={p.hint}
                        onClick={() => insertPlaceholder(p.key)}
                      >
                        {`{{${p.key}}}`}
                      </button>
                    ))}
                  </div>
                </div>

                {message && (
                  <div className={`wac-alert wac-alert--${message.type}`}>{message.text}</div>
                )}

                <div className="wac-actions">
                  <button type="button" className="qc-btn qc-btn--primary" onClick={handleSave} disabled={saving || !templateBody.trim()}>
                    {saving ? 'Saving...' : 'Save Template'}
                  </button>
                  {templateByType[selectedType] && (
                    <button type="button" className="qc-btn qc-btn--danger" onClick={handleDelete} disabled={saving}>
                      Remove Template
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
