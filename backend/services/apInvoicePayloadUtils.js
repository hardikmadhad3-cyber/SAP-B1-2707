const { buildDocumentLineUdfValues } = require('./documentLineUdfPayloadUtils');

const hasValue = (value) => (
  value !== undefined &&
  value !== null &&
  String(value).trim() !== ''
);

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toOptionalNumber = (value) => {
  if (!hasValue(value)) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toSapYesNo = (value) => {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (['Y', 'YES', 'TRUE', '1', 'TYES'].includes(normalized)) return 'tYES';
  if (['N', 'NO', 'FALSE', '0', 'TNO'].includes(normalized)) return 'tNO';
  return undefined;
};

const hasBaseDocumentLink = (line = {}) => (
  hasValue(line.baseEntry) &&
  hasValue(line.baseType) &&
  hasValue(line.baseLine)
);

const isTruthyFlag = (value) => (
  value === true || value === 1 || ['Y', 'YES', 'TRUE', '1'].includes(String(value ?? '').trim().toUpperCase())
);

const getEditableUomValue = (line = {}, manualUom = false) => {
  if (manualUom || isTruthyFlag(line.uomNameEdited)) {
    return line.uomName ?? line.UoMName ?? line.UomName ?? line.UnitMsr ?? line.unitMsr;
  }
  return line.uomCode || line.UoMCode || line.UomCode || line.uomName || line.UoMName || line.UomName || line.UnitMsr || line.unitMsr;
};

const getPositiveUomEntry = (line = {}) => {
  const entry = Number(line.uomEntry ?? line.UoMEntry);
  return Number.isInteger(entry) && entry > 0 ? entry : null;
};

const usesManualUom = (line = {}) => {
  const entry = Number(line.uomEntry ?? line.UoMEntry);
  return (
    isTruthyFlag(line.uomNameEdited) ||
    (Number.isInteger(entry) && entry < 0) ||
    (hasValue(line.uomName) && !hasValue(line.uomCode))
  );
};

/**
 * Builds an A/P Invoice line from the destination form state.
 *
 * A GRPO link remains on the line for document flow and open-quantity handling,
 * while values edited after Copy To/Copy From are explicitly sent to SAP.
 */
const buildAPInvoiceDocumentLine = (
  line = {},
  allowedLineUdfs = null,
  lineUdfDefinitionsByKey = null,
) => {
  const hasBaseDoc = hasBaseDocumentLink(line);
  const unitPrice = toNumber(line.unitPrice, 0);
  const manualUom = usesManualUom(line);
  const uomValue = getEditableUomValue(line, manualUom);
  const uomEntry = getPositiveUomEntry(line);
  const documentLine = {
    ...(hasBaseDoc ? {} : { ItemCode: String(line.itemNo || '').trim() }),
    ItemDescription: String(line.itemDescription || ''),
    Quantity: toNumber(line.quantity, 0),
    UnitPrice: unitPrice,
    Price: unitPrice,
    DiscountPercent: hasValue(line.stdDiscount)
      ? toNumber(line.stdDiscount, 0)
      : (hasBaseDoc ? 0 : undefined),
    TaxCode: hasValue(line.taxCode) ? String(line.taxCode).trim() : undefined,
    ...(manualUom
      ? { MeasureUnit: hasValue(uomValue) ? String(uomValue).trim() : undefined }
      : (uomEntry
        ? { UoMEntry: uomEntry }
        : { UoMCode: hasValue(uomValue) ? String(uomValue).trim() : undefined })),
    WarehouseCode: String(line.whse || '').trim(),
    ...(hasValue(line.requiredDate) ? { RequiredDate: String(line.requiredDate).split('T')[0] } : {}),
    ...(hasValue(line.noOfPackages ?? line.NoOfPackages ?? line.PackageQuantity ?? line.PackQty)
      ? { PackageQuantity: toNumber(line.noOfPackages ?? line.NoOfPackages ?? line.PackageQuantity ?? line.PackQty, 0) }
      : {}),
  };

  const withholdingTaxLiable = toSapYesNo(line.wtaxLiable ?? line.wTaxLiable);
  if (withholdingTaxLiable) {
    documentLine.WTLiable = withholdingTaxLiable;
  }
  if (hasValue(line.glAccount)) {
    documentLine.AccountCode = String(line.glAccount).trim();
  }
  if (hasValue(line.distRule)) {
    documentLine.CostingCode = String(line.distRule).trim();
  }
  if (hasValue(line.countryOfOrigin)) {
    documentLine.CountryOrg = String(line.countryOfOrigin).trim();
  }

  const locationCode = toOptionalNumber(line.loc);
  if (locationCode !== undefined) {
    documentLine.LocationCode = locationCode;
  }
  const agreementNo = toOptionalNumber(line.blanketAgreementNo);
  if (agreementNo !== undefined) {
    documentLine.AgreementNo = agreementNo;
  }

  if (hasBaseDoc) {
    documentLine.BaseEntry = Number(line.baseEntry);
    documentLine.BaseType = Number(line.baseType);
    documentLine.BaseLine = Number(line.baseLine);
  }

  const baseType = Number(line.baseType ?? line.BaseType);
  if (
    baseType !== 20 &&
    isTruthyFlag(line.batchManaged ?? line.BatchManaged) &&
    Array.isArray(line.batches) &&
    line.batches.length
  ) {
    documentLine.BatchNumbers = line.batches
      .map((batch) => ({
        BatchNumber: String(batch.batchNumber || batch.BatchNumber || batch.BatchNum || '').trim(),
        Quantity: toNumber(batch.quantity ?? batch.Quantity, 0),
        ...(hasValue(batch.supplierLotNo ?? batch.ManufacturerSerialNumber)
          ? { ManufacturerSerialNumber: String(batch.supplierLotNo ?? batch.ManufacturerSerialNumber).trim() }
          : {}),
      }))
      .filter((batch) => batch.BatchNumber && batch.Quantity > 0);
  }

  // Both shapes a matrix column can write into are collected here: live
  // SAP-driven columns land on line.udf, mapped columns on the line itself.
  Object.assign(documentLine, buildDocumentLineUdfValues(line, {
    definitions: lineUdfDefinitionsByKey,
    allowedKeys: allowedLineUdfs,
  }));
  return documentLine;
};

module.exports = {
  buildAPInvoiceDocumentLine,
  hasBaseDocumentLink,
};
