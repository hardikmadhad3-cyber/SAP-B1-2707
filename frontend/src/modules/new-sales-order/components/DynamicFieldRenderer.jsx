import React from 'react';
import DynamicCheckboxField from './DynamicCheckboxField';
import DynamicDateField from './DynamicDateField';
import DynamicLookupField from './DynamicLookupField';
import DynamicNumberField from './DynamicNumberField';
import DynamicSelectField from './DynamicSelectField';
import DynamicTextField from './DynamicTextField';
import DynamicTextareaField from './DynamicTextareaField';
import ItemLookupField from './ItemLookupField';

const componentIdPart = (value) => String(value || '').replace(/[^a-zA-Z0-9_-]+/g, '-');

export default function DynamicFieldRenderer({ field, idPrefix = 'nso', ...props }) {
  const renderer = String(field?.renderer || field?.type || 'text').trim().toLowerCase();
  const id = props.id || `${componentIdPart(idPrefix)}-${componentIdPart(field?.stateKey || field?.sapField || field?.id)}`;
  const common = { ...props, field, id };

  switch (renderer) {
    case 'item-lookup':
      return <ItemLookupField {...common} />;
    case 'lookup':
      return <DynamicLookupField {...common} />;
    case 'select':
      return <DynamicSelectField {...common} />;
    case 'number':
    case 'integer':
      return <DynamicNumberField {...common} />;
    case 'date':
    case 'datetime':
      return <DynamicDateField {...common} />;
    case 'checkbox':
    case 'boolean':
      return <DynamicCheckboxField {...common} />;
    case 'textarea':
    case 'memo':
      return <DynamicTextareaField {...common} />;
    default:
      return <DynamicTextField {...common} />;
  }
}
