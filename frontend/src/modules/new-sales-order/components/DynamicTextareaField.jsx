import React from 'react';
import DynamicFieldFrame from './DynamicFieldFrame';

export default function DynamicTextareaField({ field, value = '', onChange, error, loading, showLabel, compact, id }) {
  const disabled = field?.editable === false || field?.readOnly;
  return (
    <DynamicFieldFrame field={field} controlId={id} error={error} loading={loading} showLabel={showLabel} compact={compact}>
      <textarea
        id={id}
        className="new-sales-order-page__textarea"
        value={value ?? ''}
        required={Boolean(field?.required)}
        disabled={Boolean(disabled)}
        readOnly={Boolean(field?.readOnly)}
        maxLength={Number(field?.maxLength) > 0 ? Number(field.maxLength) : undefined}
        rows={compact ? 2 : 3}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </DynamicFieldFrame>
  );
}
