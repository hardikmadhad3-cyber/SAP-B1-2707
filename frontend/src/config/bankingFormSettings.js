export const INCOMING_PAYMENTS_FORM_SETTINGS_STORAGE_KEY = 'sapb1.incomingPayments.formSettings.v1';
export const OUTGOING_PAYMENTS_FORM_SETTINGS_STORAGE_KEY = 'sapb1.outgoingPayments.formSettings.v1';
export const JOURNAL_ENTRY_FORM_SETTINGS_STORAGE_KEY = 'sapb1.journalEntry.formSettings.v1';

const buildVisibilitySettings = (definitions = []) =>
  definitions.reduce((acc, field) => {
    acc[field.key] = {
      visible: field.visible !== false,
      active: field.active !== false,
    };
    return acc;
  }, {});

const createDefaultFormSettings = (matrixColumns = []) => ({
  headerUdfs: {},
  matrixColumns: buildVisibilitySettings(matrixColumns),
  rowUdfs: {},
});

const mergeNestedSettings = (defaults, saved = {}) =>
  Object.keys(defaults).reduce((acc, groupKey) => {
    acc[groupKey] = {
      ...defaults[groupKey],
      ...(saved[groupKey] || {}),
    };
    return acc;
  }, {});

export const readSavedBankingFormSettings = (matrixColumns = [], storageKey) => {
  const defaults = createDefaultFormSettings(matrixColumns);

  if (!storageKey || typeof window === 'undefined' || !window.localStorage) {
    return defaults;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaults;
    return mergeNestedSettings(defaults, JSON.parse(raw));
  } catch (_error) {
    return defaults;
  }
};

export const PAYMENT_INVOICE_COLUMNS = [
  { key: 'selected', label: 'Selected', minWidth: 72 },
  { key: 'documentNo', label: 'Document No.', minWidth: 104 },
  { key: 'installment', label: 'Installment', minWidth: 86 },
  { key: 'documentType', label: 'Document Type', minWidth: 112 },
  { key: 'date', label: 'Date', minWidth: 88 },
  { key: 'dueDate', label: 'Due Date', minWidth: 88 },
  { key: 'marker', label: '*', minWidth: 42 },
  { key: 'overdueDays', label: 'Overdue Days', minWidth: 92 },
  { key: 'total', label: 'Total', minWidth: 112 },
  { key: 'wTaxAmount', label: 'WTax Amount', minWidth: 112 },
  { key: 'balanceDue', label: 'Balance Due', minWidth: 108 },
  { key: 'blocked', label: 'Blocked', minWidth: 70 },
  { key: 'cashDiscountPercent', label: 'Cash Discount %', minWidth: 128 },
  { key: 'totalRoundingAmount', label: 'Total Rounding Amount', minWidth: 168 },
  { key: 'totalPayment', label: 'Total Payment', minWidth: 132 },
  { key: 'distributionRule', label: 'Distr. Rule', minWidth: 120 },
  { key: 'paymentOrderRun', label: 'Payment Order Run', minWidth: 132 },
  { key: 'branch', label: 'Branch', minWidth: 132 },
  { key: 'blanketAgreement', label: 'Blanket Agreement', minWidth: 148 },
];

export const PAYMENT_ACCOUNT_COLUMNS = [
  { key: 'accountRowNumber', label: 'Account #', minWidth: 44 },
  { key: 'accountCode', label: 'G/L Account', minWidth: 150 },
  { key: 'accountName', label: 'Account Name', minWidth: 260 },
  { key: 'accountRemarks', label: 'Doc. Remarks', minWidth: 240 },
  { key: 'accountAmount', label: 'Amount', minWidth: 170 },
  { key: 'accountDistributionRule', label: 'Distr. Rule', minWidth: 140 },
  { key: 'accountLocation', label: 'Loc.', minWidth: 120 },
];

export const PAYMENT_FORM_SETTINGS_COLUMNS = [
  ...PAYMENT_INVOICE_COLUMNS,
  ...PAYMENT_ACCOUNT_COLUMNS,
];

export const JOURNAL_ENTRY_COLUMNS = [
  { key: 'rowNumber', label: '#', minWidth: 38 },
  { key: 'accountCode', label: 'G/L Acct/BP Code', minWidth: 150 },
  { key: 'accountName', label: 'G/L Acct/BP Name', minWidth: 390 },
  { key: 'debit', label: 'Debit', minWidth: 118 },
  { key: 'credit', label: 'Credit', minWidth: 118 },
  { key: 'remarks', label: 'Remarks Template', minWidth: 150 },
  { key: 'taxCode', label: 'Tax Code', minWidth: 78 },
  { key: 'federalTaxId', label: 'Federal Tax ID', minWidth: 110 },
  { key: 'taxAmount', label: 'Tax Amount', minWidth: 112 },
  { key: 'receiptNumber', label: 'Receipt Number', minWidth: 110 },
  { key: 'grossValue', label: 'Gross Value', minWidth: 110 },
  { key: 'primaryFormItem', label: 'Primary Form Item', minWidth: 130 },
  { key: 'materialType', label: 'Material Type', minWidth: 96 },
  { key: 'gstComponent', label: 'GST/CENVAT Component', minWidth: 170 },
  { key: 'distRule', label: 'Distr. Rule', minWidth: 104 },
  { key: 'location', label: 'Loc.', minWidth: 90 },
];
