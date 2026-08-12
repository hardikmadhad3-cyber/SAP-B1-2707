import React from 'react';
import DynamicFieldFrame from './DynamicFieldFrame';

export default function DynamicDateField({ field, value = '', onChange, error, loading, showLabel, compact, id }) {
  const disabled = field?.editable === false || field?.readOnly;
  return (
    <DynamicFieldFrame field={field} controlId={id} error={error} loading={loading} showLabel={showLabel} compact={compact}>
      <input
        id={id}
        className="new-sales-order-page__input"
        type="date"
        value={String(value || '').split('T')[0]}
        required={Boolean(field?.required)}
        disabled={Boolean(disabled)}
        readOnly={Boolean(field?.readOnly)}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </DynamicFieldFrame>
  );
}
