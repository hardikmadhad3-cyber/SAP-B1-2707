import React from 'react';
import NewSalesOrderLineTable from './NewSalesOrderLineTable';

export default function NewSalesOrderContentsTab({ onAddLine, ...tableProps }) {
  return (
    <section className="new-sales-order-page__tab-panel" role="tabpanel" aria-label="Contents">
      <div className="new-sales-order-page__section-heading">
        <div>
          <h2>Document Lines</h2>
          <p>Line columns are generated from live RDR1 and UDF metadata.</p>
        </div>
        <button type="button" className="new-sales-order-page__button" onClick={onAddLine}>Add Line</button>
      </div>
      {tableProps.fields?.length ? (
        <NewSalesOrderLineTable {...tableProps} />
      ) : (
        <div className="new-sales-order-page__empty">No visible RDR1 line fields were returned.</div>
      )}
    </section>
  );
}
