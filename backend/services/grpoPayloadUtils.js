const { applyUdfValues } = require('./udfPayloadUtils');

const hasValue = (value) => (
  value !== undefined &&
  value !== null &&
  String(value).trim() !== ''
);

const normalizeUdfKey = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^U_/, '')
    .replace(/[^A-Z0-9]+/g, '');

const findUdfValue = (values = {}, aliases = []) => {
  const tokens = new Set(
    aliases.map(normalizeUdfKey)
  );

  const matchedEntry = Object.entries(values || {}).find(
    ([key, value]) =>
      tokens.has(normalizeUdfKey(key)) &&
      hasValue(value)
  );

  return matchedEntry ? matchedEntry[1] : undefined;
};

const removeMatchingUdfAliases = (
  values,
  aliases,
  exactTargetKey
) => {
  const tokens = new Set(
    aliases.map(normalizeUdfKey)
  );

  Object.keys(values).forEach((key) => {
    if (
      key !== exactTargetKey &&
      tokens.has(normalizeUdfKey(key))
    ) {
      delete values[key];
    }
  });
};

const setExactNumericUdf = ({
  values,
  directValue,
  aliases,
  targetKey,
  label,
}) => {
  const sourceValue = hasValue(directValue)
    ? directValue
    : findUdfValue(values, aliases);

  if (!hasValue(sourceValue)) {
    return;
  }

  const numericValue = Number(sourceValue);

  if (!Number.isFinite(numericValue)) {
    throw new Error(
      `${label} must contain a valid numeric value.`
    );
  }

  removeMatchingUdfAliases(
    values,
    aliases,
    targetKey
  );

  values[targetKey] = numericValue;
};

const buildGRPOLineUdfs = (line = {}) => {
  const values = {
    ...(line.udf || {}),
  };

  setExactNumericUdf({
    values,
    directValue: line.grossWt,
    aliases: [
      'U_GrossWt',
      'U_GROSSWT',
      'U_Gross_Wt',
      'U_GrossWeight',
    ],
    targetKey: 'U_GrossWt',
    label: 'Gross Weight',
  });

  setExactNumericUdf({
    values,
    directValue: line.totalPackage,
    aliases: [
      'U_TotalPackage',
      'U_TOTALPACKAGE',
      'U_Total_Package',
      'U_TotalPackge',
    ],
    targetKey: 'U_TotalPackage',
    label: 'Total Package',
  });

  return values;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const hasBaseDocumentLink = (line = {}) => (
  hasValue(line.baseEntry) &&
  hasValue(line.baseType) &&
  hasValue(line.baseLine)
);

/**
 * Build a GRPO line from the current form state.
 *
 * Base document references tell SAP which PO line is being received, but they
 * must not replace values the user changed after copying the PO. Therefore the
 * editable destination values are included for both copied and manual lines.
 */
const buildGRPODocumentLine = (
  line = {},
  lineUdfDefinitionsByKey = null,
) => {
  const hasBaseDoc = hasBaseDocumentLink(line);
  const unitPrice = toNumber(line.unitPrice, 0);
  const documentLine = {
    ItemCode: String(line.itemNo || '').trim(),
    ItemDescription: String(line.itemDescription || ''),
    Quantity: toNumber(line.quantity, 0),
    UnitPrice: unitPrice,
    Price: unitPrice,
    DiscountPercent: hasValue(line.stdDiscount)
      ? toNumber(line.stdDiscount, 0)
      : (hasBaseDoc ? 0 : undefined),
    TaxCode: hasValue(line.taxCode) ? String(line.taxCode).trim() : undefined,
    WarehouseCode: String(line.whse || '').trim(),
    UoMCode: hasValue(line.uomCode) ? String(line.uomCode).trim() : undefined,
    CommissionPercent: hasValue(line.commPercent)
      ? toNumber(line.commPercent, 0)
      : (hasBaseDoc ? 0 : undefined),
  };

  if (hasBaseDoc) {
    documentLine.BaseEntry = Number(line.baseEntry);
    documentLine.BaseType = Number(line.baseType);
    documentLine.BaseLine = Number(line.baseLine);
  }

  if (line.batchManaged && Array.isArray(line.batches) && line.batches.length > 0) {
    documentLine.BatchNumbers = line.batches.map((batch) => {
      const documentBatch = {
        BatchNumber: String(batch.batchNumber || '').trim(),
        Quantity: toNumber(batch.quantity, 0),
      };
      const supplierLotNo = String(batch.supplierLotNo || '').trim();
      if (supplierLotNo) {
        documentBatch.ManufacturerSerialNumber = supplierLotNo;
      }
      return documentBatch;
    });
  }

 const lineUdfValues = buildGRPOLineUdfs(line);

applyUdfValues(
  documentLine,
  lineUdfValues,
  null,
  lineUdfDefinitionsByKey
);

return documentLine;
};

module.exports = {
  buildGRPODocumentLine,
  buildGRPOLineUdfs,
  hasBaseDocumentLink,
};
