import React, { useMemo } from 'react';
import { readNewSalesOrderFieldValue } from '../newSalesOrderState';
import { isNewSalesOrderLineEmpty } from '../newSalesOrderValidation';

const findField = (fields, candidates) => fields.find((field) => {
  const keys = [field.sapField, field.databaseField, field.stateKey].map((value) => String(value || '').toUpperCase());
  return candidates.some((candidate) => keys.includes(candidate));
});

export default function NewSalesOrderSummary({ schema, formData }) {
  const summary = useMemo(() => {
    const fields = schema?.lineFields || [];
    const quantityField = findField(fields, ['QUANTITY']);
    const priceField = findField(fields, ['UNITPRICE', 'PRICE']);
    const populated = (formData?.lines || []).filter((line) => !isNewSalesOrderLineEmpty(line));
    return populated.reduce((totals, line) => {
      const quantity = Number(quantityField ? readNewSalesOrderFieldValue(line, quantityField) : 0);
      const price = Number(priceField ? readNewSalesOrderFieldValue(line, priceField) : 0);
      const safeQuantity = Number.isFinite(quantity) ? quantity : 0;
      const safePrice = Number.isFinite(price) ? price : 0;
      return {
        lines: totals.lines + 1,
        quantity: totals.quantity + safeQuantity,
        subtotal: totals.subtotal + (safeQuantity * safePrice),
      };
    }, { lines: 0, quantity: 0, subtotal: 0 });
  }, [formData?.lines, schema?.lineFields]);

  return (
    <aside className="new-sales-order-page__summary" aria-label="Dummy totals summary">
      <h2>Dummy Totals</h2>
      <dl>
        <div><dt>Populated lines</dt><dd>{summary.lines}</dd></div>
        <div><dt>Total quantity</dt><dd>{summary.quantity.toLocaleString()}</dd></div>
        <div><dt>Estimated subtotal</dt><dd>{summary.subtotal.toFixed(2)}</dd></div>
      </dl>
      <small>Preview only. SAP pricing, freight, tax and rounding are not executed.</small>
    </aside>
  );
}
