'use strict';

const INTEGER_DATABASE_TYPES = new Set([
  'bigint',
  'int',
  'integer',
  'smallint',
  'tinyint',
]);

const NUMBER_DATABASE_TYPES = new Set([
  'decimal',
  'dec',
  'double',
  'fixed',
  'float',
  'money',
  'numeric',
  'real',
  'smalldecimal',
  'smallmoney',
]);

const DATE_DATABASE_TYPES = new Set(['date']);
const DATETIME_DATABASE_TYPES = new Set([
  'datetime',
  'datetime2',
  'datetimeoffset',
  'seconddate',
  'smalldatetime',
  'timestamp',
]);
const BOOLEAN_DATABASE_TYPES = new Set(['bit', 'bool', 'boolean']);
const LONG_TEXT_DATABASE_TYPES = new Set([
  'clob',
  'longtext',
  'memo',
  'nclob',
  'text',
]);

const TRUE_VALUES = new Set(['1', 'TRUE', 'TYES', 'Y', 'YES']);
const FALSE_VALUES = new Set(['0', 'FALSE', 'N', 'NO', 'TNO']);

const text = (value) => String(value ?? '').trim();
const upper = (value) => text(value).toUpperCase();

const finiteInteger = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
};

const normalizeOptions = (options = []) => (Array.isArray(options) ? options : [])
  .map((option) => {
    if (option && typeof option === 'object') {
      const value = option.value ?? option.FldValue ?? option.fldValue;
      if (value === null || value === undefined || text(value) === '') return null;
      return {
        value: String(value),
        label: text(option.label ?? option.Descr ?? option.description ?? value) || String(value),
        ...(text(option.description) ? { description: text(option.description) } : {}),
      };
    }
    return text(option) ? { value: String(option), label: String(option) } : null;
  })
  .filter(Boolean);

const isYesNoOptions = (options = []) => {
  const normalized = normalizeOptions(options).map((option) => upper(option.value));
  return normalized.length === 2
    && normalized.some((value) => TRUE_VALUES.has(value))
    && normalized.some((value) => FALSE_VALUES.has(value))
    && normalized.every((value) => TRUE_VALUES.has(value) || FALSE_VALUES.has(value));
};

const getStep = (scale) => {
  const normalizedScale = finiteInteger(scale);
  if (!normalizedScale) return '1';
  return `0.${'0'.repeat(normalizedScale - 1)}1`;
};

const decimalMaximum = (precision, scale) => {
  const normalizedPrecision = finiteInteger(precision);
  const normalizedScale = finiteInteger(scale) ?? 0;
  if (!normalizedPrecision || normalizedScale > normalizedPrecision || normalizedPrecision > 38) return null;
  const integerDigits = normalizedPrecision - normalizedScale;
  const integerPart = integerDigits > 0 ? '9'.repeat(integerDigits) : '0';
  return normalizedScale > 0
    ? `${integerPart}.${'9'.repeat(normalizedScale)}`
    : integerPart;
};

const normalizeDatabaseType = (value) => text(value)
  .toLowerCase()
  .replace(/\s*\(.+$/, '');

const mapSapUdfType = ({ typeId, subType, scale }) => {
  const type = upper(typeId);
  const subtype = upper(subType).replace(/^ST_/, '');

  if (['D', 'DATE'].includes(type) || ['D', 'DATE'].includes(subtype)) return 'date';
  if (['T', 'TIME'].includes(subtype)) return 'datetime';
  if (['M', 'MEMO'].includes(type) || ['A', 'ADDRESS', 'TEXT'].includes(subtype)) return 'textarea';
  if (['N', 'NUMERIC', 'INTEGER'].includes(type)) {
    return (finiteInteger(scale) ?? 0) === 0 ? 'integer' : 'number';
  }
  if (['B', 'FLOAT', 'PRICE', 'QUANTITY', 'RATE', 'SUM'].includes(type)
      || ['P', 'PRICE', 'Q', 'QUANTITY', 'R', 'RATE', 'S', 'SUM'].includes(subtype)) {
    return 'number';
  }
  return '';
};

const mapDatabaseType = ({ databaseType, maxLength, scale }) => {
  const normalized = normalizeDatabaseType(databaseType);
  if (BOOLEAN_DATABASE_TYPES.has(normalized)) return 'checkbox';
  if (INTEGER_DATABASE_TYPES.has(normalized)) return 'integer';
  if (NUMBER_DATABASE_TYPES.has(normalized)) {
    return (finiteInteger(scale) ?? 0) === 0 && !['float', 'real', 'double'].includes(normalized)
      ? 'integer'
      : 'number';
  }
  if (DATE_DATABASE_TYPES.has(normalized)) return 'date';
  if (DATETIME_DATABASE_TYPES.has(normalized)) return 'datetime';
  if (LONG_TEXT_DATABASE_TYPES.has(normalized)) return 'textarea';
  const length = Number(maxLength);
  if (Number.isFinite(length) && (length < 0 || length > 254)) return 'textarea';
  return 'text';
};

const rendererForType = (type) => {
  if (['number', 'integer', 'date', 'datetime', 'checkbox', 'select', 'lookup', 'textarea'].includes(type)) {
    return type;
  }
  return 'text';
};

const mapFieldType = (metadata = {}, semantic = {}) => {
  const options = normalizeOptions(metadata.options);
  const semanticRenderer = text(semantic.renderer);
  const linked = text(metadata.linkedTable || metadata.lookupTable || metadata.relUDO || metadata.relUdo);

  let type;
  let renderer;
  if (semanticRenderer === 'item-lookup') {
    type = 'lookup';
    renderer = 'item-lookup';
  } else if (semanticRenderer === 'lookup' || linked) {
    type = 'lookup';
    renderer = 'lookup';
  } else if (isYesNoOptions(options) || BOOLEAN_DATABASE_TYPES.has(normalizeDatabaseType(metadata.databaseType))) {
    type = 'checkbox';
    renderer = 'checkbox';
  } else if (options.length) {
    type = 'select';
    renderer = 'select';
  } else {
    type = text(semantic.type)
      || mapSapUdfType(metadata)
      || mapDatabaseType(metadata);
    renderer = semanticRenderer || rendererForType(type);
  }

  const precision = finiteInteger(metadata.precision ?? metadata.numericPrecision);
  let scale = finiteInteger(metadata.scale ?? metadata.numericScale);
  if (type === 'integer') scale = 0;
  const maximum = ['number', 'integer'].includes(type) ? decimalMaximum(precision, scale) : null;

  return {
    type,
    renderer,
    ...(precision !== null && ['number', 'integer'].includes(type) ? { precision } : {}),
    ...(scale !== null && ['number', 'integer'].includes(type) ? { scale } : {}),
    ...(['number', 'integer'].includes(type) ? { step: getStep(scale) } : {}),
    ...(maximum !== null ? { minimum: `-${maximum}`, maximum } : {}),
    options,
  };
};

module.exports = {
  getStep,
  isYesNoOptions,
  mapDatabaseType,
  mapFieldType,
  mapSapUdfType,
  normalizeDatabaseType,
  normalizeOptions,
};
