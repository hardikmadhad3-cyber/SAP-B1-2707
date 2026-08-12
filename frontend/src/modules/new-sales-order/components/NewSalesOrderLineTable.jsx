import React from 'react';
import DynamicFieldRenderer from './DynamicFieldRenderer';
import {
  getNewSalesOrderFieldKey,
  readNewSalesOrderFieldValue,
} from '../newSalesOrderState';

const getVisibleLineFields = (fields = []) => fields
  .filter((field) => field.visible !== false)
  .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));

export default function NewSalesOrderLineTable({
  fields,
  lines,
  errors = {},
  lookups = {},
  onChange,
  onRemove,
  onRequestLookup,
  onLookupSelect,
}) {
  const columns = getVisibleLineFields(fields);
  return (
    <div className="new-sales-order-page__line-table-wrap">
      <table className="new-sales-order-page__line-table">
        <thead>
          <tr>
            <th className="new-sales-order-page__line-number">#</th>
            {columns.map((field) => (
              <th
                key={field.id || getNewSalesOrderFieldKey(field)}
                style={Number(field.width) > 0 ? { minWidth: `${Number(field.width)}px` } : undefined}
                title={field.tooltip || field.label || ''}
              >
                {field.label || getNewSalesOrderFieldKey(field)}{field.required ? ' *' : ''}
              </th>
            ))}
            <th className="new-sales-order-page__line-action">Action</th>
          </tr>
        </thead>
        <tbody>
          {(lines || []).map((line, index) => {
            const lineErrors = errors[line.localLineId] || errors[index] || {};
            return (
              <tr key={line.localLineId}>
                <td className="new-sales-order-page__line-number">{index + 1}</td>
                {columns.map((field) => {
                  const key = getNewSalesOrderFieldKey(field);
                  const lookupKey = `${line.localLineId}:${field.id || key}`;
                  const lookupState = lookups[lookupKey] || lookups[field.id] || lookups[key] || {};
                  return (
                    <td key={field.id || key}>
                      <DynamicFieldRenderer
                        field={field}
                        idPrefix={`nso-line-${line.localLineId}`}
                        value={readNewSalesOrderFieldValue(line, field)}
                        error={lineErrors[key]}
                        loading={lookupState.loading}
                        options={lookupState.items || field.options}
                        lookupError={lookupState.error}
                        page={lookupState.page}
                        hasMore={lookupState.hasMore}
                        showLabel={false}
                        compact
                        onChange={(value) => onChange?.(line.localLineId, field, value)}
                        onSelect={(option) => onLookupSelect?.(line.localLineId, field, option)}
                        onRequestOptions={(q, page) => onRequestLookup?.(field, line, q, page, line.localLineId)}
                      />
                    </td>
                  );
                })}
                <td className="new-sales-order-page__line-action">
                  <button type="button" onClick={() => onRemove?.(line.localLineId)} aria-label={`Remove line ${index + 1}`}>
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
