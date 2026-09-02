import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchAdminFieldConfiguration,
  previewAdminCustomLookup,
  saveAdminCustomLookup,
  saveAdminFieldConfiguration,
} from '../../api/adminPanelApi';
import './TransactionFieldConfiguration.css';

const TRANSACTIONS = Object.freeze([
  { value: 'SALES_ORDER', label: 'Sales Order' },
  { value: 'SALES_QUOTATION', label: 'Sales Quotation' },
  { value: 'DELIVERY', label: 'Delivery' },
  { value: 'AR_INVOICE', label: 'A/R Invoice' },
  { value: 'AR_CREDIT_MEMO', label: 'A/R Credit Memo' },
  { value: 'PURCHASE_REQUEST', label: 'Purchase Request' },
  { value: 'PURCHASE_QUOTATION', label: 'Purchase Quotation' },
  { value: 'PURCHASE_ORDER', label: 'Purchase Order' },
  { value: 'GRPO', label: 'Goods Receipt PO' },
  { value: 'AP_INVOICE', label: 'A/P Invoice' },
  { value: 'AP_CREDIT_MEMO', label: 'A/P Credit Memo' },
  { value: 'SERVICE_AR_INVOICE', label: 'Service A/R Invoice' },
  { value: 'SERVICE_AR_CREDIT_MEMO', label: 'Service A/R Credit Memo' },
  { value: 'SERVICE_AP_INVOICE', label: 'Service A/P Invoice' },
  { value: 'SERVICE_AP_CREDIT_MEMO', label: 'Service A/P Credit Memo' },
]);

const getErrorMessage = (error, fallback) => error?.response?.data?.message
  || error?.response?.data?.detail || error?.message || fallback;
const buildDraft = (fields = []) => Object.fromEntries(fields.map((field) => [field.id, field.configuredLookupSource || '']));
const buildAssignments = (draft = {}) => Object.entries(draft).filter(([, source]) => Boolean(source))
  .map(([fieldId, lookupSource]) => ({ fieldId, lookupSource }))
  .sort((left, right) => left.fieldId.localeCompare(right.fieldId));
const assignmentKey = (draft = {}) => JSON.stringify(buildAssignments(draft));

const CustomLookupEditor = ({ companyId, configuration, onSaved }) => {
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('');
  const [queryText, setQueryText] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(null);
  const customLookups = configuration?.customLookups || [];

  useEffect(() => {
    setSelectedId(''); setName(''); setQueryText(''); setPreview(null); setMessage(''); setStatus('idle');
  }, [companyId]);

  const selectLookup = (value) => {
    setSelectedId(value); setPreview(null); setMessage('');
    const selected = customLookups.find((lookup) => String(lookup.id) === value);
    setName(selected?.name || ''); setQueryText(selected?.queryText || '');
  };

  const payload = () => ({
    companyId, id: selectedId ? Number(selectedId) : null, name: name.trim(), queryText: queryText.trim(),
  });

  const runPreview = async () => {
    try {
      setStatus('previewing'); setMessage(''); setPreview(null);
      const result = await previewAdminCustomLookup(payload());
      setPreview(result); setStatus('idle'); setMessage(`${result.rowCount} rows returned. No 50-row display limit is applied.`);
    } catch (error) {
      setStatus('error'); setMessage(getErrorMessage(error, 'Unable to run the custom lookup query.'));
    }
  };

  const saveLookup = async () => {
    try {
      setStatus('saving'); setMessage('');
      const result = await saveAdminCustomLookup(payload());
      setSelectedId(String(result.customLookup.id));
      setStatus('idle'); setMessage('Custom lookup saved and ready for field assignment.');
      onSaved(result.customLookup);
    } catch (error) {
      setStatus('error'); setMessage(getErrorMessage(error, 'Unable to save the custom lookup.'));
    }
  };

  const busy = status === 'previewing' || status === 'saving';
  return (
    <section className="transaction-field-config__custom">
      <div className="transaction-field-config__custom-heading">
        <div><h2>Custom Lookup Query</h2><p>Use one read-only query with <code>value</code> and <code>label</code> aliases. <code>description</code> is optional.</p></div>
        <select aria-label="Saved custom lookup" value={selectedId} onChange={(event) => selectLookup(event.target.value)} disabled={busy}>
          <option value="">New custom lookup</option>
          {customLookups.map((lookup) => <option key={lookup.id} value={lookup.id}>{lookup.name}</option>)}
        </select>
      </div>
      <div className="transaction-field-config__custom-form">
        <label>Lookup name<input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} placeholder="Active inventory items" disabled={busy} /></label>
        <label className="is-query">{configuration.dialect === 'hana' ? 'SAP HANA query' : 'SQL Server query'}
          <textarea value={queryText} onChange={(event) => setQueryText(event.target.value)} disabled={busy}
            placeholder={configuration.dialect === 'hana'
              ? 'SELECT "ItemCode" AS "value", "ItemName" AS "label" FROM "OITM" ORDER BY "ItemCode"'
              : 'SELECT [ItemCode] AS [value], [ItemName] AS [label] FROM [OITM] ORDER BY [ItemCode]'}
          />
        </label>
      </div>
      <div className="transaction-field-config__custom-actions">
        <span className={status === 'error' ? 'is-error' : ''}>{message || 'INSERT, UPDATE, DELETE, DDL, comments, and multiple statements are blocked.'}</span>
        <button type="button" onClick={runPreview} disabled={busy || !name.trim() || !queryText.trim()}>{status === 'previewing' ? 'Running...' : 'Run Lookup'}</button>
        <button type="button" className="is-primary" onClick={saveLookup} disabled={busy || !name.trim() || !queryText.trim()}>{status === 'saving' ? 'Saving...' : 'Save Custom Lookup'}</button>
      </div>
      {preview ? (
        <div className="transaction-field-config__preview">
          <table><thead><tr>{preview.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
            <tbody>{preview.rows.map((row, index) => <tr key={index}>{preview.columns.map((column) => <td key={column}>{String(row[column] ?? '')}</td>)}</tr>)}</tbody>
          </table>
          {!preview.rows.length ? <div className="transaction-field-config__state">The query completed successfully with no rows.</div> : null}
        </div>
      ) : null}
    </section>
  );
};

const ConfigurationTable = ({ configuration, dirty, draft, message, onSave, setDraft, status }) => {
  const lookupBySource = new Map((configuration.lookupSources || []).map((lookup) => [lookup.source, lookup]));
  return <>
    <div className="transaction-field-config__table-wrap"><table className="transaction-field-config__table">
      <thead><tr><th>Order</th><th>Label</th><th>State key</th><th>SAP field</th><th>DB field</th><th>Type</th><th>Lookup</th></tr></thead>
      <tbody>{configuration.lineFields.map((field) => {
        const allowed = new Set(field.allowedLookupSources || []);
        const defaultLabel = field.defaultLookupSource ? lookupBySource.get(field.defaultLookupSource)?.label || field.defaultLookupSource : 'Plain input';
        return <tr key={field.id} className={field.readOnly ? 'is-read-only' : ''}>
          <td>{field.order}</td><td>{field.label}</td><td>{field.stateKey}</td><td>{field.sapField}</td><td>{field.databaseField}</td><td>{field.type}</td>
          <td><select aria-label={`${field.label} lookup`} value={draft[field.id] || ''} disabled={field.readOnly || status === 'saving'}
            onChange={(event) => setDraft((current) => ({ ...current, [field.id]: event.target.value }))}>
            <option value="">SAP default - {defaultLabel}</option>
            {(configuration.lookupSources || []).filter((lookup) => allowed.has(lookup.source)).map((lookup) => <option key={lookup.source} value={lookup.source}>{lookup.label}</option>)}
          </select></td>
        </tr>;
      })}</tbody>
    </table></div>
    <footer className="transaction-field-config__footer">
      <span className={status === 'error' ? 'transaction-field-config__message is-error' : 'transaction-field-config__message'}>{message || 'Clearing a selection restores the SAP-derived default.'}</span>
      <button type="button" disabled={!dirty || status === 'saving'} onClick={onSave}>{status === 'saving' ? 'Saving...' : 'Save Configuration'}</button>
    </footer>
  </>;
};

function TransactionFieldConfiguration() {
  const [companyId, setCompanyId] = useState('');
  const [documentType, setDocumentType] = useState('SALES_ORDER');
  const [configuration, setConfiguration] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [draft, setDraft] = useState({});
  const [savedDraftKey, setSavedDraftKey] = useState('[]');
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const requestRef = useRef(null);
  const dirty = useMemo(() => assignmentKey(draft) !== savedDraftKey, [draft, savedDraftKey]);

  useEffect(() => {
    requestRef.current?.abort();
    const controller = new AbortController(); requestRef.current = controller; setStatus('loading'); setMessage('');
    fetchAdminFieldConfiguration({ companyId, documentType, signal: controller.signal }).then((response) => {
      const nextDraft = buildDraft(response.lineFields);
      setConfiguration(response); setCompanies(response.companies || []); setCompanyId(String(response.companyId));
      setDraft(nextDraft); setSavedDraftKey(assignmentKey(nextDraft)); setStatus('ready');
    }).catch((error) => {
      if (error?.code === 'ERR_CANCELED') return;
      setConfiguration(null); setStatus('error'); setMessage(getErrorMessage(error, 'Unable to load transaction field configuration.'));
    }).finally(() => { if (requestRef.current === controller) requestRef.current = null; });
    return () => controller.abort();
  }, [companyId, documentType]);

  const changeScope = (setter, value) => {
    if (dirty && !window.confirm('Discard unsaved field assignments?')) return;
    setter(value);
  };
  const save = async () => {
    try {
      setStatus('saving'); setMessage('');
      const response = await saveAdminFieldConfiguration({ companyId: Number(companyId), documentType, schemaVersion: configuration.schemaVersion, assignments: buildAssignments(draft) });
      const nextDraft = buildDraft(response.lineFields); setConfiguration(response); setDraft(nextDraft); setSavedDraftKey(assignmentKey(nextDraft)); setStatus('ready');
      setMessage('Lookup configuration saved. Reload the transaction page to use the changes.');
    } catch (error) { setStatus('error'); setMessage(getErrorMessage(error, 'Unable to save transaction field configuration.')); }
  };
  const addCustomLookup = (lookup) => setConfiguration((current) => ({
    ...current,
    customLookups: [...(current.customLookups || []).filter((item) => item.id !== lookup.id), lookup].sort((a, b) => a.name.localeCompare(b.name)),
    lookupSources: [...(current.lookupSources || []).filter((item) => item.source !== lookup.source), { source: lookup.source, label: `Custom - ${lookup.name}`, custom: true }],
    lineFields: current.lineFields.map((field) => field.readOnly ? field : ({ ...field, allowedLookupSources: [...new Set([...(field.allowedLookupSources || []), lookup.source])] })),
  }));

  return <main className="transaction-field-config" data-testid="transaction-field-configuration">
    <section className="transaction-field-config__card">
      <div className="transaction-field-config__toolbar">
        <label>Company<select aria-label="Company" value={companyId} disabled={status === 'loading' || status === 'saving'} onChange={(event) => changeScope(setCompanyId, event.target.value)}>
          {companies.map((company) => <option key={company.companyId} value={company.companyId}>{company.companyName || company.dbName} ({company.dialect === 'hana' ? 'HANA' : 'SQL Server'})</option>)}
        </select></label>
        <label>Transaction<select value={documentType} disabled={status === 'loading' || status === 'saving'} onChange={(event) => changeScope(setDocumentType, event.target.value)}>
          {TRANSACTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select></label>
        <div className="transaction-field-config__context">{configuration ? <span>{configuration.lineTable}: {configuration.lineFields.length} fields</span> : null}{dirty ? <span className="is-dirty">Unsaved changes</span> : null}</div>
      </div>
      {status === 'loading' ? <div className="transaction-field-config__state">Loading company line fields...</div> : null}
      {status === 'error' && !configuration ? <div className="transaction-field-config__alert is-error">{message}</div> : null}
      {configuration ? <>
        <CustomLookupEditor companyId={Number(companyId)} configuration={configuration} onSaved={addCustomLookup} />
        <ConfigurationTable configuration={configuration} dirty={dirty} draft={draft} message={message} onSave={save} setDraft={setDraft} status={status} />
      </> : null}
    </section>
  </main>;
}

export default TransactionFieldConfiguration;
