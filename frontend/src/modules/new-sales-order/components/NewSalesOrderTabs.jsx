import React from 'react';
import { NEW_SALES_ORDER_TABS } from '../newSalesOrderConstants';

export default function NewSalesOrderTabs({ activeTab, onChange }) {
  return (
    <div className="new-sales-order-page__tabs" role="tablist" aria-label="New Sales Order sections">
      {NEW_SALES_ORDER_TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={activeTab === tab}
          className={activeTab === tab ? 'is-active' : ''}
          onClick={() => onChange?.(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
