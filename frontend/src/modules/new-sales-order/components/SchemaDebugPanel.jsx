import React from 'react';

const DebugFieldTable = ({ title, fields = [] }) => (
  <div className="new-sales-order-page__debug-section">
    <h3>{title} ({fields.length})</h3>
    <div className="new-sales-order-page__debug-table-wrap">
      <table className="new-sales-order-page__debug-table">
        <thead>
          <tr>
            <th>Order</th><th>Label</th><th>State key</th><th>SAP field</th><th>DB field</th>
            <th>Type</th><th>Renderer</th><th>Storage</th><th>Precision</th><th>Scale</th>
            <th>Lookup</th><th>Required</th><th>Editable</th><th>Visible</th><th>Options</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field.id || `${field.tableName}.${field.sapField}`}>
              <td>{field.order}</td><td>{field.label}</td><td>{field.stateKey}</td><td>{field.sapField}</td>
              <td>{field.databaseField}</td><td>{field.type}</td><td>{field.renderer}</td><td>{field.storage}</td>
              <td>{field.precision ?? ''}</td><td>{field.scale ?? ''}</td>
              <td>{field.lookup?.source || field.lookupSource || ''}</td><td>{String(Boolean(field.required))}</td>
              <td>{String(field.editable !== false)}</td><td>{String(field.visible !== false)}</td><td>{field.options?.length || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default function SchemaDebugPanel({ open, onToggle, schema, identity, payload }) {
  return (
    <section className="new-sales-order-page__debug">
      <button type="button" className="new-sales-order-page__button" onClick={onToggle} aria-expanded={open}>
        {open ? 'Hide Schema Debug' : 'Schema Debug'}
      </button>
      {open ? (
        <div className="new-sales-order-page__debug-body">
          <h2>Schema Debug</h2>
          <dl className="new-sales-order-page__debug-meta">
            <div><dt>Company</dt><dd>{schema?.companyName || identity?.companyDb || 'Unavailable'}</dd></div>
            <div><dt>Company ID</dt><dd>{schema?.companyId ?? identity?.companyId ?? ''}</dd></div>
            <div><dt>Database</dt><dd>{schema?.companyDb || identity?.companyDb || ''}</dd></div>
            <div><dt>User code</dt><dd>{schema?.userCode || identity?.userCode || ''}</dd></div>
            <div><dt>Object type</dt><dd>{schema?.objectType || ''}</dd></div>
            <div><dt>Schema version</dt><dd>{schema?.schemaVersion || ''}</dd></div>
          </dl>
          <DebugFieldTable title="ORDR Header Fields" fields={schema?.headerFields} />
          <DebugFieldTable title="RDR1 Line Fields" fields={schema?.lineFields} />
          <div className="new-sales-order-page__debug-section">
            <h3>Generated Dummy Payload</h3>
            <pre>{JSON.stringify(payload || {}, null, 2)}</pre>
          </div>
        </div>
      ) : null}
    </section>
  );
}
