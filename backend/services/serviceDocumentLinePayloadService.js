const parseNumber = (value, fallback = 0) => {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const optionalString = (value) => {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : undefined;
};

const optionalNumber = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const yesNo = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return ['y', 'yes', 'true', '1', 'tyes'].includes(normalized) ? 'tYES' : 'tNO';
};

const buildStandardServiceLinePayload = (line = {}) => {
  const quantity = parseNumber(line.sQty, 0) > 0 ? parseNumber(line.sQty) : 1;
  const unitPrice = parseNumber(line.unitPrice, 0) > 0
    ? parseNumber(line.unitPrice)
    : parseNumber(line.totalLC, 0) / quantity;

  const payload = {
    AccountCode: String(line.glAccount || '').trim(),
    ItemDescription: String(line.description || '').trim(),
    Quantity: quantity,
    UnitPrice: unitPrice,
    DiscountPercent: parseNumber(line.discountPercent),
    TaxCode: optionalString(line.taxCode),
    CostingCode: optionalString(line.distRule),
    WTLiable: yesNo(line.wtaxLiable),
  };

  ['2', '3', '4', '5'].forEach((dimension) => {
    const value = optionalString(line[`distRule${dimension}`]);
    if (value !== undefined) payload[`CostingCode${dimension}`] = value;
  });

  const projectCode = optionalString(line.projectCode || line.project);
  if (projectCode !== undefined) payload.ProjectCode = projectCode;

  const agreementNo = optionalNumber(line.blanketAgreementNo || line.agreementNo);
  if (agreementNo !== undefined) payload.AgreementNo = agreementNo;

  const baseType = optionalNumber(line.baseType);
  const baseEntry = optionalNumber(line.baseEntry);
  const baseLine = optionalNumber(line.baseLine);
  if (baseType !== undefined && baseEntry !== undefined && baseLine !== undefined) {
    payload.BaseType = baseType;
    payload.BaseEntry = baseEntry;
    payload.BaseLine = baseLine;
  }

  return payload;
};

module.exports = { buildStandardServiceLinePayload };
