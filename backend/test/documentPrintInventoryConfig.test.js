'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { getDocumentPrintConfig } = require('../services/documentPrintLayoutService');

const INVENTORY_PRINT_CONFIGS = [
  {
    key: 'goodsReceipt',
    aliases: ['goods-receipt', 'goodsreceipt', 'inventory-goods-receipt', 'ign', '59'],
    expected: {
      label: 'Goods Receipt',
      objectType: '59',
      typeCode: 'IGN2',
      tableName: 'OIGN',
      filePrefix: 'goods-receipt',
    },
  },
  {
    key: 'goodsIssue',
    aliases: ['goods-issue', 'goodsissue', 'inventory-goods-issue', 'ige', '60'],
    expected: {
      label: 'Goods Issue',
      objectType: '60',
      typeCode: 'IGE2',
      tableName: 'OIGE',
      filePrefix: 'goods-issue',
    },
  },
  {
    key: 'inventoryTransferRequest',
    aliases: ['inventory-transfer-request', 'inventorytransferrequest', 'transfer-request', 'wtq', '1250000001'],
    expected: {
      label: 'Inventory Transfer Request',
      objectType: '1250000001',
      typeCode: 'WTQ2',
      tableName: 'OWTQ',
      filePrefix: 'inventory-transfer-request',
    },
  },
  {
    key: 'inventoryTransfer',
    aliases: ['inventory-transfer', 'inventorytransfer', 'stock-transfer', 'wtr', '67'],
    expected: {
      label: 'Inventory Transfer',
      objectType: '67',
      typeCode: 'WTR2',
      tableName: 'OWTR',
      filePrefix: 'inventory-transfer',
    },
  },
];

INVENTORY_PRINT_CONFIGS.forEach(({ key, aliases, expected }) => {
  test(`resolves the ${expected.label} print configuration and aliases`, () => {
    [key, ...aliases].forEach((documentType) => {
      const config = getDocumentPrintConfig(documentType);
      assert.equal(config.key, key);
      Object.entries(expected).forEach(([field, value]) => {
        assert.equal(config[field], value);
      });
    });
  });
});
