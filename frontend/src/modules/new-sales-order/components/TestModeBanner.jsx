import React from 'react';
import {
  NEW_SALES_ORDER_ALLOW_SAP_WRITES,
  NEW_SALES_ORDER_TEST_BANNER,
  NEW_SALES_ORDER_WARNING,
} from '../newSalesOrderConstants';

export default function TestModeBanner() {
  return (
    <section className="new-sales-order-page__test-banner" role="status" aria-label="New Sales Order test mode">
      <div className="new-sales-order-page__test-badge">{NEW_SALES_ORDER_TEST_BANNER}</div>
      <p>{NEW_SALES_ORDER_WARNING}</p>
      {NEW_SALES_ORDER_ALLOW_SAP_WRITES ? (
        <small>The frontend write flag is enabled, but this phase deliberately exposes no SAP posting action.</small>
      ) : null}
    </section>
  );
}
