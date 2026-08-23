'use strict';

const NUMBER_SQL_TYPES = new Set([
  'bigint', 'decimal', 'dec', 'double', 'float', 'int', 'integer', 'numeric',
  'real', 'smallint', 'smallmoney', 'tinyint', 'money', 'smalldecimal',
]);

const hasValue = (value) => (
  value !== undefined
  && value !== null
  && !(typeof value === 'string' && value.trim() === '')
);

const compact = (value) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const firstPresent = (...values) => values.find(hasValue);

const getCaseInsensitiveValue = (source, key) => {
  if (!source || typeof source !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];
  const matchedKey = Object.keys(source).find((candidate) => compact(candidate) === compact(key));
  return matchedKey ? source[matchedKey] : undefined;
};

const getLineValue = (line = {}, aliases = []) => {
  for (const alias of aliases) {
    const direct = getCaseInsensitiveValue(line, alias);
    if (hasValue(direct)) return direct;
    const canonical = getCaseInsensitiveValue(line.values, alias);
    if (hasValue(canonical)) return canonical;
  }
  return undefined;
};

const normalizeFieldMetadata = (fieldMetadata = {}) => Object.entries(fieldMetadata || {}).reduce(
  (normalized, [columnName, details]) => {
    const key = String(columnName || '').trim();
    if (!key) return normalized;
    normalized.set(compact(key), {
      columnName: key,
      dataType: typeof details === 'string'
        ? details.toLowerCase()
        : String(details?.dataType || details?.databaseType || '').trim().toLowerCase(),
    });
    return normalized;
  },
  new Map(),
);

const resolvePhysicalField = (metadata, candidates = []) => {
  for (const candidate of candidates) {
    const field = metadata.get(compact(candidate));
    if (field) return field;
  }
  return null;
};

const toNumber = (value) => {
  if (!hasValue(value)) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const toInteger = (value) => {
  const number = toNumber(value);
  return Number.isInteger(number) ? number : undefined;
};

const toSapYesNo = (value) => {
  if (!hasValue(value)) return undefined;
  if (value === true || value === 1) return 'tYES';
  if (value === false || value === 0) return 'tNO';
  const normalized = String(value).trim().toUpperCase();
  if (['Y', 'YES', 'TRUE', '1', 'TYES'].includes(normalized)) return 'tYES';
  if (['N', 'NO', 'FALSE', '0', 'TNO'].includes(normalized)) return 'tNO';
  return undefined;
};

const toDate = (value) => {
  if (!hasValue(value)) return undefined;
  const normalized = String(value).trim().split('T')[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : undefined;
};

const toStringValue = (value) => (hasValue(value) ? String(value).trim() : undefined);

const coerceValue = (value, kind, physicalField) => {
  if (kind === 'number') return toNumber(value);
  if (kind === 'integer') return toInteger(value);
  if (kind === 'yesno') return toSapYesNo(value);
  if (kind === 'date') return toDate(value);
  if (NUMBER_SQL_TYPES.has(String(physicalField?.dataType || '').toLowerCase())) return toNumber(value);
  return toStringValue(value);
};

const STANDARD_LINE_FIELD_MAPPINGS = Object.freeze([
  { serviceLayerField: 'ItemCode', physicalFields: ['ItemCode'], inputFields: ['itemNo', 'ItemCode'], kind: 'string', structural: true },
  { serviceLayerField: 'ItemDescription', physicalFields: ['Dscription'], inputFields: ['itemDescription', 'ItemDescription', 'Dscription'], kind: 'string', fallback: true },
  { serviceLayerField: 'Quantity', physicalFields: ['Quantity'], inputFields: ['quantity', 'Quantity'], kind: 'number', structural: true },
  { serviceLayerField: 'UnitPrice', physicalFields: ['Price', 'PriceBefDi'], inputFields: ['unitPrice', 'UnitPrice', 'Price'], kind: 'number', structural: true },
  { serviceLayerField: 'WarehouseCode', physicalFields: ['WhsCode'], inputFields: ['whse', 'warehouse', 'warehouseCode', 'WarehouseCode', 'WhsCode'], kind: 'string', fallback: true },
  { serviceLayerField: 'TaxCode', physicalFields: ['VatGroup', 'TaxCode'], inputFields: ['taxCode', 'TaxCode', 'VatGroup'], kind: 'string', fallback: true },
  { serviceLayerField: 'DiscountPercent', physicalFields: ['DiscPrcnt'], inputFields: ['stdDiscount', 'discountPercent', 'DiscountPercent', 'DiscPrcnt'], kind: 'number', fallback: true },
  { serviceLayerField: 'CostingCode', physicalFields: ['OcrCode'], inputFields: ['distRule', 'distributionRule', 'CostingCode', 'OcrCode'], kind: 'string', fallback: true },
  { serviceLayerField: 'CostingCode2', physicalFields: ['OcrCode2'], inputFields: ['distRule2', 'CostingCode2', 'OcrCode2'], kind: 'string' },
  { serviceLayerField: 'CostingCode3', physicalFields: ['OcrCode3'], inputFields: ['distRule3', 'CostingCode3', 'OcrCode3'], kind: 'string' },
  { serviceLayerField: 'CostingCode4', physicalFields: ['OcrCode4'], inputFields: ['distRule4', 'CostingCode4', 'OcrCode4'], kind: 'string' },
  { serviceLayerField: 'CostingCode5', physicalFields: ['OcrCode5'], inputFields: ['distRule5', 'CostingCode5', 'OcrCode5'], kind: 'string' },
  { serviceLayerField: 'COGSCostingCode', physicalFields: ['CogsOcrCod'], inputFields: ['cogsDistRule', 'COGSCostingCode', 'CogsOcrCod'], kind: 'string' },
  { serviceLayerField: 'COGSCostingCode2', physicalFields: ['CogsOcrCo2'], inputFields: ['cogsDistRule2', 'COGSCostingCode2', 'CogsOcrCo2'], kind: 'string' },
  { serviceLayerField: 'COGSCostingCode3', physicalFields: ['CogsOcrCo3'], inputFields: ['cogsDistRule3', 'COGSCostingCode3', 'CogsOcrCo3'], kind: 'string' },
  { serviceLayerField: 'COGSCostingCode4', physicalFields: ['CogsOcrCo4'], inputFields: ['cogsDistRule4', 'COGSCostingCode4', 'CogsOcrCo4'], kind: 'string' },
  { serviceLayerField: 'COGSCostingCode5', physicalFields: ['CogsOcrCo5'], inputFields: ['cogsDistRule5', 'COGSCostingCode5', 'CogsOcrCo5'], kind: 'string' },
  { serviceLayerField: 'AccountCode', physicalFields: ['AcctCode'], inputFields: ['glAccount', 'accountCode', 'AccountCode', 'AcctCode'], kind: 'string' },
  { serviceLayerField: 'FreeText', physicalFields: ['FreeTxt', 'FreeText'], inputFields: ['freeText', 'FreeText', 'FreeTxt'], kind: 'string', fallback: true },
  { serviceLayerField: 'ShipDate', physicalFields: ['ShipDate'], inputFields: ['lineDeliveryDate', 'deliveryDate', 'ShipDate', 'quotedDate'], kind: 'date', fallback: true },
  { serviceLayerField: 'RequiredDate', physicalFields: ['ReqDate', 'RequiredDate'], inputFields: ['requiredDate', 'RequiredDate', 'ReqDate'], kind: 'date' },
  { serviceLayerField: 'ShippingMethod', physicalFields: ['TrnsCode'], inputFields: ['lineShippingType', 'shippingType', 'ShippingMethod', 'TrnsCode'], kind: 'integer' },
  { serviceLayerField: 'TaxOnly', physicalFields: ['TaxOnly'], inputFields: ['taxLiable', 'TaxLiable', 'TaxOnly'], kind: 'yesno' },
  { serviceLayerField: 'WTLiable', physicalFields: ['WtLiable'], inputFields: ['wTaxLiable', 'wtaxLiable', 'WTaxLiable', 'WTLiable'], kind: 'yesno' },
  { serviceLayerField: 'AgreementNo', physicalFields: ['AgrNo'], inputFields: ['blanketAgreementNo', 'agreementNo', 'AgreementNo', 'AgrNo'], kind: 'integer' },
  { serviceLayerField: 'AgreementRowNumber', physicalFields: ['AgrLnNum'], inputFields: ['blanketAgreementLine', 'agreementRowNumber', 'AgreementRowNumber', 'AgrLnNum'], kind: 'integer' },
  { serviceLayerField: 'CommissionPercent', physicalFields: ['CommPercent', 'Commission'], inputFields: ['commPercent', 'commissionPercent', 'CommissionPercent'], kind: 'number' },
  { serviceLayerField: 'WithoutInventoryMovement', physicalFields: ['NoInvtryMv'], inputFields: ['withoutQtyPosting', 'withoutInventoryMovement', 'WithoutInventoryMovement', 'NoInvtryMv'], kind: 'yesno' },
  { serviceLayerField: 'LocationCode', physicalFields: ['LocCode'], inputFields: ['loc', 'locCode', 'locationCode', 'LocationCode', 'LocCode'], kind: 'integer' },
  { serviceLayerField: 'CountryOrg', physicalFields: ['CountryOrg'], inputFields: ['countryOfOrigin', 'CountryOrg'], kind: 'string' },
]);

const supportsMapping = (mapping, metadata) => (
  mapping.structural
  || Boolean(resolvePhysicalField(metadata, mapping.physicalFields))
  || (metadata.size === 0 && mapping.fallback === true)
);

const addBaseDocumentFields = (target, line = {}) => {
  const baseType = getLineValue(line, ['baseType', 'BaseType']);
  const baseEntry = getLineValue(line, ['baseEntry', 'BaseEntry']);
  const baseLine = getLineValue(line, ['baseLine', 'BaseLine']);
  if (![baseType, baseEntry, baseLine].every(hasValue)) return target;
  const normalized = [baseType, baseEntry, baseLine].map(toInteger);
  if (normalized.some((value) => value === undefined)) return target;
  [target.BaseType, target.BaseEntry, target.BaseLine] = normalized;
  return target;
};

const buildMetadataValidatedStandardLine = async ({
  line = {},
  fieldMetadata = {},
  includeLineNum = false,
  includeItemCode = true,
  includeBaseDocument = true,
  defaultDiscountPercent,
  resolveUomEntry,
  resolveHsnEntry,
  resolveSacEntry,
} = {}) => {
  const metadata = normalizeFieldMetadata(fieldMetadata);
  const target = {};

  if (includeLineNum) {
    const lineNum = toInteger(getLineValue(line, ['lineNum', 'lineNumber', 'LineNum']));
    if (lineNum !== undefined) target.LineNum = lineNum;
  }

  for (const mapping of STANDARD_LINE_FIELD_MAPPINGS) {
    if (!includeItemCode && mapping.serviceLayerField === 'ItemCode') continue;
    if (!supportsMapping(mapping, metadata)) continue;
    const value = getLineValue(line, mapping.inputFields);
    const physicalField = resolvePhysicalField(metadata, mapping.physicalFields);
    let normalized = coerceValue(value, mapping.kind, physicalField);
    if (
      normalized === undefined
      && mapping.serviceLayerField === 'DiscountPercent'
      && hasValue(defaultDiscountPercent)
    ) {
      normalized = coerceValue(defaultDiscountPercent, mapping.kind, physicalField);
    }
    if (normalized !== undefined) target[mapping.serviceLayerField] = normalized;
  }

  const rawUomEntry = getLineValue(line, ['uomEntry', 'UoMEntry']);
  const rawUomCode = getLineValue(line, ['uomCode', 'UoMCode', 'unitMsr']);
  const rawUomValue = firstPresent(rawUomEntry, rawUomCode);
  const supportsUomEntry = Boolean(resolvePhysicalField(metadata, ['UomEntry']));
  const supportsUomCode = Boolean(resolvePhysicalField(metadata, ['UomCode', 'unitMsr'])) || metadata.size === 0;
  const explicitUomEntry = toInteger(rawUomEntry);
  if (supportsUomEntry && explicitUomEntry !== undefined) {
    target.UoMEntry = explicitUomEntry;
  } else if (hasValue(rawUomValue) && supportsUomEntry && typeof resolveUomEntry === 'function') {
    const itemCode = getLineValue(line, ['itemNo', 'ItemCode']);
    const entry = toInteger(await resolveUomEntry(itemCode, rawUomValue));
    if (entry !== undefined) target.UoMEntry = entry;
  }
  if (!Object.prototype.hasOwnProperty.call(target, 'UoMEntry') && hasValue(rawUomCode) && supportsUomCode) {
    target.UoMCode = String(rawUomCode).trim();
  }

  const resolvedFields = [
    {
      targetField: 'HSNEntry',
      physicalFields: ['HsnEntry'],
      directEntryFields: ['hsnEntry', 'HSNEntry'],
      codeFields: ['hsnCode', 'HSNCode'],
      resolver: resolveHsnEntry,
    },
    {
      targetField: 'SACEntry',
      physicalFields: ['SACEntry', 'SacEntry'],
      directEntryFields: ['sacEntry', 'SACEntry'],
      codeFields: ['sacCode', 'SACCode'],
      resolver: resolveSacEntry,
    },
  ];
  for (const mapping of resolvedFields) {
    if (!resolvePhysicalField(metadata, mapping.physicalFields)) continue;
    const directEntry = toInteger(getLineValue(line, mapping.directEntryFields));
    if (directEntry !== undefined) {
      target[mapping.targetField] = directEntry;
      continue;
    }
    const value = getLineValue(line, mapping.codeFields);
    if (!hasValue(value) || typeof mapping.resolver !== 'function') continue;
    const resolved = await mapping.resolver(value);
    const entry = toInteger(resolved);
    if (entry !== undefined) target[mapping.targetField] = entry;
  }

  if (includeBaseDocument) addBaseDocumentFields(target, line);
  return target;
};

const intersectPhysicalUdfKeys = (allowedUdfKeys = new Set(), fieldMetadata = {}) => {
  const metadata = normalizeFieldMetadata(fieldMetadata);
  if (metadata.size === 0) return new Set();
  const physicalUdfTokens = new Set(
    [...metadata.values()]
      .map((field) => field.columnName)
      .filter((field) => String(field).toUpperCase().startsWith('U_'))
      .map(compact),
  );
  return new Set(
    [...(allowedUdfKeys || [])].filter((key) => physicalUdfTokens.has(compact(key))),
  );
};

const filterMetadataValidatedUdfs = (
  values = {},
  allowedUdfKeys = new Set(),
  fieldMetadata = {},
) => {
  const allowedPhysicalKeys = intersectPhysicalUdfKeys(allowedUdfKeys, fieldMetadata);
  const keyByToken = new Map([...allowedPhysicalKeys].map((key) => [compact(key), key]));
  return Object.entries(values || {}).reduce((filtered, [rawKey, value]) => {
    const key = keyByToken.get(compact(rawKey));
    if (key) filtered[key] = value;
    return filtered;
  }, {});
};

const filterMetadataValidatedUdfDefinitions = (definitionsByKey = new Map(), fieldMetadata = {}) => {
  const definitions = definitionsByKey instanceof Map
    ? definitionsByKey
    : new Map(Object.entries(definitionsByKey || {}));
  const physicalKeys = intersectPhysicalUdfKeys(new Set(definitions.keys()), fieldMetadata);
  return new Map(
    [...definitions.entries()].filter(([key]) => physicalKeys.has(key)),
  );
};

const assignMappedUdfValue = (target = {}, key, value, normalize = (entry) => entry) => {
  if (!key) return target;
  if (hasValue(value)) target[key] = normalize(value);
  return target;
};

const compactDocumentLinePayload = (values = {}, { preserveNullUdfs = false } = {}) => (
  Object.entries(values || {}).reduce((payload, [key, value]) => {
    if (value === undefined || value === '') return payload;
    if (value === null && !(preserveNullUdfs && String(key).toUpperCase().startsWith('U_'))) {
      return payload;
    }
    payload[key] = value;
    return payload;
  }, {})
);

const resolveMetadataUdfKey = (definitionsOrKeys = new Set(), aliases = []) => {
  const keys = definitionsOrKeys instanceof Map
    ? [...definitionsOrKeys.keys()]
    : [...(definitionsOrKeys || [])];
  const keyByToken = new Map(keys.map((key) => [compact(key), key]));
  for (const alias of aliases || []) {
    const matched = keyByToken.get(compact(alias));
    if (matched) return matched;
  }
  return '';
};

module.exports = {
  STANDARD_LINE_FIELD_MAPPINGS,
  addBaseDocumentFields,
  assignMappedUdfValue,
  buildMetadataValidatedStandardLine,
  compactDocumentLinePayload,
  filterMetadataValidatedUdfDefinitions,
  filterMetadataValidatedUdfs,
  getLineValue,
  hasValue,
  intersectPhysicalUdfKeys,
  normalizeFieldMetadata,
  resolveMetadataUdfKey,
  resolvePhysicalField,
  toSapYesNo,
};
