import React from 'react';

export default function DynamicFieldFrame({
  field,
  controlId,
  error,
  loading = false,
  showLabel = true,
  compact = false,
  children,
}) {
  const width = Number(field?.width);
  const style = Number.isFinite(width) && width > 0 ? { '--nso-field-width': `${width}px` } : undefined;
  return (
    <div
      className={`new-sales-order-page__field${compact ? ' is-compact' : ''}${error ? ' has-error' : ''}`}
      style={style}
      title={field?.tooltip || field?.label || ''}
    >
      {showLabel ? (
        <label className="new-sales-order-page__field-label" htmlFor={controlId}>
          {field?.label || field?.stateKey || field?.sapField}
          {field?.required ? <span aria-hidden="true"> *</span> : null}
        </label>
      ) : null}
      <div className="new-sales-order-page__field-control">
        {children}
        {loading ? <span className="new-sales-order-page__field-loading">Loading…</span> : null}
      </div>
      {error ? <div className="new-sales-order-page__field-error" role="alert">{error}</div> : null}
    </div>
  );
}
