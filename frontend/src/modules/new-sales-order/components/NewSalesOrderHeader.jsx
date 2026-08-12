import React from 'react';
import DynamicFieldRenderer from './DynamicFieldRenderer';
import {
  getNewSalesOrderFieldKey,
  readNewSalesOrderFieldValue,
} from '../newSalesOrderState';

const visibleFields = (fields = []) => fields
  .filter((field) => field.visible !== false)
  .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));

export default function NewSalesOrderHeader({
  fields,
  record,
  errors = {},
  lookups = {},
  onChange,
  onRequestLookup,
}) {
  const renderedFields = visibleFields(fields);
  return (
    <section className="new-sales-order-page__card" aria-labelledby="new-sales-order-header-title">
      <div className="new-sales-order-page__section-heading">
        <div>
          <h2 id="new-sales-order-header-title">Document Header</h2>
          <p>Fields and defaults are generated from the active company schema.</p>
        </div>
      </div>
      {renderedFields.length ? (
        <div className="new-sales-order-page__header-grid">
          {renderedFields.map((field) => {
            const key = getNewSalesOrderFieldKey(field);
            const lookupState = lookups[field.id] || lookups[key] || {};
            return (
              <DynamicFieldRenderer
                key={field.id || key}
                field={field}
                idPrefix="nso-header"
                value={readNewSalesOrderFieldValue(record, field)}
                error={errors[key]}
                loading={lookupState.loading}
                options={lookupState.items || field.options}
                lookupError={lookupState.error}
                page={lookupState.page}
                hasMore={lookupState.hasMore}
                onChange={(value) => onChange?.(field, value)}
                onRequestOptions={(q, page) => onRequestLookup?.(field, record, q, page)}
              />
            );
          })}
        </div>
      ) : (
        <div className="new-sales-order-page__empty">No visible ORDR header fields were returned.</div>
      )}
    </section>
  );
}
