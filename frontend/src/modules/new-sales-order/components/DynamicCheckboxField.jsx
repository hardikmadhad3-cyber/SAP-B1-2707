import React from 'react';
import DynamicFieldFrame from './DynamicFieldFrame';

const checkedValue = (value) => value === true || ['Y', 'YES', 'TRUE', '1', 'TYES'].includes(String(value || '').trim().toUpperCase());

export default function DynamicCheckboxField({ field, value = false, onChange, error, loading, showLabel, compact, id }) {
  const disabled = field?.editable === false || field?.readOnly;
  return (
    <DynamicFieldFrame field={field} controlId={id} error={error} loading={loading} showLabel={showLabel} compact={compact}>
      <label className="new-sales-order-page__checkbox-control" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checkedValue(value)}
          disabled={Boolean(disabled)}
          aria-invalid={Boolean(error)}
          onChange={(event) => onChange?.(event.target.checked)}
        />
        <span>{checkedValue(value) ? 'Yes' : 'No'}</span>
      </label>
    </DynamicFieldFrame>
  );
}
