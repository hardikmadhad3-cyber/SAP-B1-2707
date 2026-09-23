const toNumberOrUndefined = (value) => {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const buildDocumentAdditionalExpenses = (freightCharges = []) =>
  (Array.isArray(freightCharges) ? freightCharges : [])
    .map((charge) => {
      const expenseCode = toNumberOrUndefined(charge?.expnsCode ?? charge?.ExpnsCode ?? charge?.ExpenseCode);
      const lineTotal = toNumberOrUndefined(
        charge?.netAmount ??
        charge?.LineTotal ??
        charge?.NetAmount
      );
      const taxCode = String(charge?.taxCode ?? charge?.TaxCode ?? '').trim();

      if (expenseCode === undefined) {
        return undefined;
      }

      if (lineTotal === undefined || lineTotal === 0) {
        return undefined;
      }

      // Lookup/default rows are not document expenses. Actual charges require
      // the selected company's tax code, including negative charges.
      if (!taxCode) {
        const name = charge?.expnsName || charge?.ExpnsName || expenseCode;
        const error = new Error("Tax code is required for freight '" + name + "'. Open Freight Charges and select the applicable company tax code.");
        error.status = 400;
        error.code = 'FREIGHT_TAX_CODE_REQUIRED';
        throw error;
      }
      return {
        ExpenseCode: expenseCode,
        LineTotal: lineTotal,
        TaxCode: taxCode,
      };
    })
    .filter(Boolean);

module.exports = {
  buildDocumentAdditionalExpenses,
};
