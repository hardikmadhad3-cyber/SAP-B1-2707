import React, { useCallback, useEffect, useMemo, useState } from 'react';

const displayValue = (value, type) => {
  if (value === null || value === undefined) return '';
  if (type === 'date') return String(value).replace('T', ' ').replace(/\.000Z$/, '');
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch (_error) { return String(value); }
  }
  return String(value);
};

export default function CompanyQueryContentTable({ formSettings = {}, context = {} }) {
  const layout = formSettings.__companyQueryLayout;
  const contextKey = useMemo(() => JSON.stringify(context || {}), [context]);
  const [reload, setReload] = useState(0);
  const [state, setState] = useState({ loading: true, error: '', columns: [], rows: [], truncated: false });

  const load = useCallback(() => setReload((value) => value + 1), []);

  useEffect(() => {
    if (!layout?.isPublished || !layout?.formKey) return undefined;
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true, error: '' }));
    // Keep the API client lazy: ordinary editable Content-table tests and
    // pages never need to initialize the network layer.
    const { runCompanyFormQuery } = require('../../api/formSettingsApi');
    runCompanyFormQuery(layout.formKey, JSON.parse(contextKey), { signal: controller.signal })
      .then((payload) => setState({
        loading: false,
        error: '',
        columns: payload.columns || [],
        rows: payload.rows || [],
        truncated: Boolean(payload.truncated),
      }))
      .catch((error) => {
        if (error?.name === 'CanceledError') return;
        setState({
          loading: false,
          error: error?.response?.data?.message || 'The published Content query could not be loaded.',
          columns: layout.columns || [],
          rows: [],
          truncated: false,
        });
      });
    return () => controller.abort();
  }, [contextKey, layout?.formKey, layout?.isPublished, layout?.version, reload]);

  if (state.loading) {
    return <div className="so-alert so-alert--success">Loading published Content view...</div>;
  }
  if (state.error) {
    return (
      <div className="so-alert so-alert--error">
        <span>{state.error}</span>
        <button type="button" className="so-btn" onClick={load} style={{ marginLeft: 10 }}>Retry</button>
      </div>
    );
  }

  return (
    <div className="so-grid-wrap company-query-content" aria-label="Published read-only Content view">
      <div className="admin-panel-help-text" style={{ padding: '6px 8px' }}>
        Published company view - read only
        {state.truncated ? ' (first 500 rows)' : ''}
      </div>
      <table className="so-grid">
        <thead>
          <tr>{state.columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {state.rows.length ? state.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {state.columns.map((column) => (
                <td key={column.key} className={column.type === 'number' ? 'so-grid__cell--num' : undefined}>
                  {displayValue(row[column.key], column.type)}
                </td>
              ))}
            </tr>
          )) : (
            <tr><td colSpan={Math.max(1, state.columns.length)}>No rows returned.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
