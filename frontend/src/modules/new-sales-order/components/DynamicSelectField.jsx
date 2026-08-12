import React from 'react';
import DynamicFieldFrame from './DynamicFieldFrame';

const normalizeOption = (option) => (typeof option === 'object'
  ? { value: String(option?.value ?? ''), label: String(option?.label ?? option?.description ?? option?.value ?? '') }
  : { value: String(option ?? ''), label: String(option ?? '') });

export default function DynamicSelectField({ field, value = '', onChange, error, loading, showLabel, compact, id, options }) {
  const disabled = field?.editable === false || field?.readOnly;
  const resolvedOptions = (options || field?.options || []).map(normalizeOption);
  return (
    <DynamicFieldFrame field={field} controlId={id} error={error} loading={loading} showLabel={showLabel} compact={compact}>
      <select
        id={id}
        className="new-sales-order-page__select"
        value={value ?? ''}
        required={Boolean(field?.required)}
        disabled={Boolean(disabled)}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange?.(event.target.value)}
      >
        <option value="">Select</option>
        {resolvedOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </DynamicFieldFrame>
  );
}
