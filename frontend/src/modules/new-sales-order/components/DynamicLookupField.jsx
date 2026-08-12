import React, { useEffect, useMemo, useState } from 'react';
import DynamicFieldFrame from './DynamicFieldFrame';

const normalizeOption = (option) => ({
  ...(typeof option === 'object' ? option : {}),
  value: String(typeof option === 'object' ? option?.value ?? '' : option ?? ''),
  label: String(typeof option === 'object' ? option?.label ?? option?.description ?? option?.value ?? '' : option ?? ''),
  description: String(typeof option === 'object' ? option?.description ?? '' : ''),
});

export default function DynamicLookupField({
  field,
  value = '',
  onChange,
  onSelect,
  error,
  loading,
  showLabel,
  compact,
  id,
  options = [],
  lookupError = '',
  page = 1,
  hasMore = false,
  onRequestOptions,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const disabled = field?.editable === false || field?.readOnly;
  const normalizedOptions = useMemo(() => options.map(normalizeOption), [options]);

  useEffect(() => {
    setOpen(false);
    setQuery('');
  }, [field?.id]);

  const requestOptions = (nextPage = 1) => {
    setOpen(true);
    onRequestOptions?.(query, nextPage);
  };

  return (
    <DynamicFieldFrame field={field} controlId={id} error={error || lookupError} loading={loading} showLabel={showLabel} compact={compact}>
      <div className="new-sales-order-page__lookup">
        <input
          id={id}
          className="new-sales-order-page__input"
          type="text"
          value={value ?? ''}
          required={Boolean(field?.required)}
          disabled={Boolean(disabled)}
          readOnly={Boolean(field?.readOnly)}
          aria-invalid={Boolean(error || lookupError)}
          onChange={(event) => onChange?.(event.target.value)}
        />
        <button
          type="button"
          className="new-sales-order-page__lookup-button"
          disabled={Boolean(disabled)}
          aria-label={`Open ${field?.label || 'field'} lookup`}
          onClick={() => requestOptions(1)}
        >
          {'\u2026'}
        </button>
        {open ? (
          <div className="new-sales-order-page__lookup-popover" role="dialog" aria-label={`${field?.label || 'Field'} lookup`}>
            <div className="new-sales-order-page__lookup-search">
              <input
                type="search"
                value={query}
                placeholder="Search code or description"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    requestOptions(1);
                  }
                  if (event.key === 'Escape') setOpen(false);
                }}
              />
              <button type="button" onClick={() => requestOptions(1)} disabled={loading}>Search</button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close lookup">{'\u00D7'}</button>
            </div>
            <div className="new-sales-order-page__lookup-results">
              {loading ? <div className="new-sales-order-page__lookup-empty">Loading values{'\u2026'}</div> : null}
              {!loading && !normalizedOptions.length ? <div className="new-sales-order-page__lookup-empty">No values found.</div> : null}
              {!loading && normalizedOptions.map((option) => (
                <button
                  type="button"
                  className="new-sales-order-page__lookup-option"
                  key={`${option.value}:${option.label}`}
                  onClick={() => {
                    onChange?.(option.value);
                    onSelect?.(option);
                    setOpen(false);
                  }}
                >
                  <strong>{option.value}</strong>
                  <span>{option.label}</span>
                  {option.description && option.description !== option.label ? <small>{option.description}</small> : null}
                </button>
              ))}
            </div>
            {hasMore ? (
              <button type="button" className="new-sales-order-page__lookup-more" onClick={() => requestOptions(page + 1)} disabled={loading}>
                Load more
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </DynamicFieldFrame>
  );
}
