import React from 'react';
import PrintLayoutToolbar from './PrintLayoutToolbar';

const DEFAULT_SCHEMA = process.env.REACT_APP_SAP_REPORT_SCHEMA || '';

const INVENTORY_PRINT_DOCUMENTS = {
  goodsReceipt: {
    documentType: 'goodsReceipt',
    documentLabel: 'Goods Receipt',
  },
  goodsIssue: {
    documentType: 'goodsIssue',
    documentLabel: 'Goods Issue',
  },
  inventoryTransferRequest: {
    documentType: 'inventoryTransferRequest',
    documentLabel: 'Inventory Transfer Request',
  },
  inventoryTransfer: {
    documentType: 'inventoryTransfer',
    documentLabel: 'Inventory Transfer',
  },
};

function InventoryPrintLayoutActions({
  documentKey,
  docEntry,
  docNumber,
  series,
  cardCode,
  disabled = false,
  defaultSchema = DEFAULT_SCHEMA,
  onSuccess,
  onError,
}) {
  const config = INVENTORY_PRINT_DOCUMENTS[documentKey];

  if (!config) {
    return null;
  }

  return (
    <PrintLayoutToolbar
      documentType={config.documentType}
      documentLabel={config.documentLabel}
      docEntry={docEntry}
      docNumber={docNumber}
      series={series}
      cardCode={cardCode}
      disabled={disabled}
      defaultSchema={defaultSchema}
      classPrefix="po"
      onSuccess={onSuccess}
      onError={onError}
    />
  );
}

export default InventoryPrintLayoutActions;
