'use strict';

const text = (value) => String(value ?? '').trim();
const isTrue = (value) => ['1', 'Y', 'YES', 'TRUE', 'TYES'].includes(text(value).toUpperCase());
const dateOnly = (value) => {
  if (value instanceof Date) value = Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  const result = text(value).split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(`${result}T00:00:00Z`))
      || new Date(`${result}T00:00:00Z`).toISOString().slice(0, 10) !== result) {
    const error = new Error('A valid posting date (YYYY-MM-DD) is required to load document series.');
    error.statusCode = 400;
    throw error;
  }
  return result;
};
const dedupeSeriesRows = (rows = []) => {
  const unique = new Map();
  for (const row of rows) if (text(row?.Series) && !unique.has(text(row.Series))) unique.set(text(row.Series), row);
  return [...unique.values()];
};

// Eligibility is established by the database resolver. This compatibility helper
// must never guess a fiscal year or reduce a list to the default/selected series.
const selectSapEligibleSeries = (rows = [], targetDate) => dedupeSeriesRows(rows).filter((row) => {
  if (isTrue(row.Locked) || row.Eligible === false) return false;
  if (row.IsCurrentPeriod != null && !isTrue(row.IsCurrentPeriod)) return false;
  if (targetDate && row.FromDate && row.ToDate) {
    const date = dateOnly(targetDate);
    return date >= dateOnly(row.FromDate) && date <= dateOnly(row.ToDate);
  }
  return true;
});

const chooseDefaultSeries = (rows, userDefaults = [], companyDefaults = []) => {
  for (const defaults of [userDefaults, companyDefaults]) {
    const matches = rows.filter((row) => defaults.some((value) => text(value) === text(row.Series)));
    if (matches.length === 1) return matches[0].Series;
  }
  // An out-of-period default cannot be used. Fall back to configuration order
  // (the SAP series key), not a label that can put CAN ahead of normal invoices.
  return [...rows].sort((a, b) => Number(a.Series) - Number(b.Series))[0]?.Series ?? null;
};

// Item/service (DocType) does not create a separate numbering object.
const normalizeDocumentSubType = (value = '--') => {
  const subType = text(value) || '--';
  const aliases = { bod_None: '--', bod_InvoiceExempt: 'IE', bod_DebitMemo: 'DN', bod_Bill: 'IB', bod_ExemptBill: 'EB', bod_PurchaseDebitMemo: 'DM', bod_ExportInvoice: 'IX', bod_GSTTaxInvoice: 'GA', bod_GSTDebitMemo: 'GD' };
  if (aliases[subType]) return aliases[subType];
  if (/^(--|[A-Z]{1,2})$/.test(subType)) return subType;
  const error = new Error('Unsupported SAP document subtype.');
  error.statusCode = 400;
  throw error;
};

module.exports = { text, isTrue, dateOnly, dedupeSeriesRows, selectSapEligibleSeries, chooseDefaultSeries, normalizeDocumentSubType };

// SAP India uses GA/GD/-- series for GST tax invoice/debit memo/bill of supply.
// Exact native values and standard UI values only; never match series labels.
const gstSeriesSubType = (value) => {
 const key = text(value).toLowerCase().replace(/[ _-]/g, '');
 const map = { ga:'GA', gsttaxinvoice:'GA', gsttrantypgsttaxinvoice:'GA', gd:'GD', gstdebitmemo:'GD', gsttrantypgstdebitmemo:'GD', billofsupply:'--', gsttrantypbillofsupply:'--' };
 return map[key] || 'GA';
};
module.exports.gstSeriesSubType = gstSeriesSubType;
