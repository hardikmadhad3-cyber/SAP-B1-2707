import React from 'react';
import DynamicFieldFrame from './DynamicFieldFrame';

export const getNewSalesOrderNumberStep = (field = {}) => {
  if (field.step !== undefined && field.step !== null && String(field.step).trim()) return String(field.step);
  const scale = Math.max(0, Number(field.scale) || 0);
  return scale > 0 ? `0.${'0'.repeat(scale - 1)}1` : '1';
};

const isAllowedNumericText = (value, integerOnly) => (
  integerOnly ? /^-?\d*$/.test(value) : /^-?\d*(?:\.\d*)?$/.test(value)
);

export default function DynamicNumberField({ field, value = '', onChange, error, loading, showLabel, compact, id }) {
  const disabled = field?.editable === false || field?.readOnly;
  const integerOnly = String(field?.type || field?.renderer || '').toLowerCase() === 'integer';
  return (
    <DynamicFieldFrame field={field} controlId={id} error={error} loading={loading} showLabel={showLabel} compact={compact}>
      <input
        id={id}
        className="new-sales-order-page__input new-sales-order-page__input--number"
        type="number"
        inputMode={integerOnly ? 'numeric' : 'decimal'}
        value={value ?? ''}
        step={getNewSalesOrderNumberStep(field)}
        min={field?.minimum ?? undefined}
        max={field?.maximum ?? undefined}
        required={Boolean(field?.required)}
        disabled={Boolean(disabled)}
        readOnly={Boolean(field?.readOnly)}
        aria-invalid={Boolean(error)}
        onKeyDown={(event) => {
          if (['e', 'E', '+'].includes(event.key) || (integerOnly && event.key === '.')) event.preventDefault();
        }}
        onChange={(event) => {
          const next = event.target.value;
          if (isAllowedNumericText(next, integerOnly)) onChange?.(next);
        }}
      />
    </DynamicFieldFrame>
  );
}
