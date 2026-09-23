// SAP can retain gross GST on a line while reverse charge excludes it from
// the amount payable to the supplier. Keep the code; apply authority metadata.
export const getDocumentLinePayableTax = ({ taxableAmount = 0, tax = {}, savedTaxAmount } = {}) => {
  const grossRate = Number(tax?.Rate) || 0;
  const payableRate = tax?.PayableRate == null ? grossRate : Number(tax.PayableRate);
  const safePayableRate = Number.isFinite(payableRate) ? payableRate : grossRate;
  const saved = String(savedTaxAmount ?? '').trim();
  if (saved && Number.isFinite(Number(saved))) {
    return grossRate ? Number(saved) * safePayableRate / grossRate : Number(saved);
  }
  return (Number(taxableAmount) || 0) * safePayableRate / 100;
};
