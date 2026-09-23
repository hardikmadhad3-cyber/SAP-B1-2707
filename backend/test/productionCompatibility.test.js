'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSql, bindParams } = require('../db/hanaDb');
const bomController = require('../controllers/bomController');
const masterDataDbService = require('../services/masterDataDbService');
const productionOrderService = require('../services/productionOrderService');
const issueService = require('../services/issueForProductionService');
const receiptService = require('../services/receiptFromProductionService');
const sapService = require('../services/sapService');
const { endpoints } = require('../services/documentSeriesWriteValidation');
const productionDbService = require('../services/productionDbService');
const dbService = require('../services/dbService');

test('BOM payload preserves item, resource, route-stage and text lines without hard-coded defaults', () => {
  const payload = bomController._private._buildPayload({
    TreeCode: 'FG-1',
    TreeType: 'iProductionTree',
    Quantity: 1,
    ProductTreeLines: [
      { ItemCode: 'RM-1', ItemType: 'pit_Item', Quantity: 2, Warehouse: 'MAIN', StageID: 3 },
      { ItemCode: 'RES-1', ItemType: 'pit_Resource', Quantity: 0.5, RouteSequence: 4 },
      { ItemType: 'pit_Text', LineText: 'Inspection step' },
    ],
  });

  assert.equal('Warehouse' in payload, false);
  assert.equal('PriceList' in payload, false);
  assert.equal(payload.ProductTreeLines[0].StageID, 3);
  assert.equal(payload.ProductTreeLines[1].ItemType, 'pit_Resource');
  assert.equal(payload.ProductTreeLines[1].StageID, 4);
  assert.equal(payload.ProductTreeLines[2].LineText, 'Inspection step');
  assert.equal('ItemCode' in payload.ProductTreeLines[2], false);
});

test('BOM validation rejects an indirect circular reference', async () => {
  const original = masterDataDbService.getBOM;
  const trees = {
    B: { ProductTreeLines: [{ ItemCode: 'C', ItemType: 'pit_Item' }] },
    C: { ProductTreeLines: [{ ItemCode: 'A', ItemType: 'pit_Item' }] },
  };
  masterDataDbService.getBOM = async (code) => trees[code] || null;
  try {
    await assert.rejects(
      bomController._private._assertNoCircularReferences('A', [{ ItemCode: 'B', ItemType: 'pit_Item' }]),
      (error) => error.statusCode === 400 && /A -> B -> C -> A/.test(error.message),
    );
  } finally {
    masterDataDbService.getBOM = original;
  }
});

test('production-order payloads preserve standard, special, disassembly and text semantics', () => {
  for (const type of ['bopotStandard', 'bopotSpecial', 'bopotDisassemble']) {
    const payload = productionOrderService._private._buildPayload({
      item_code: 'FG-1', planned_qty: 3, due_date: '2026-09-30', posting_date: '2026-09-12',
      warehouse: 'MAIN', type, status: 'boposReleased',
      lines: [
        { item_code: 'RM-1', planned_qty: 6, component_type: 'pit_Item', issue_method: 'im_Manual' },
        { item_code: 'RES-1', planned_qty: 1, component_type: 'pit_Resource', issue_method: 'im_Backflush' },
        { line_text: 'QA', planned_qty: 1, component_type: 'pit_Text' },
      ],
    }, true);
    assert.equal(payload.ProductionOrderType, type);
    assert.equal(payload.ProductionOrderStatus, 'boposPlanned');
    assert.equal(payload.ProductionOrderLines[1].ItemType, 'pit_Resource');
    assert.equal(payload.ProductionOrderLines[2].LineText, 'QA');
  }
});

test('production transitions enforce state and send the Service Layer ETag', async () => {
  const original = sapService.request;
  const calls = [];
  sapService.request = async (config) => {
    calls.push(config);
    if (config.method === 'GET') return { data: { ProductionOrderStatus: 'boposPlanned' }, headers: { etag: 'W/"42"' } };
    return { data: {} };
  };
  try {
    await productionOrderService._private.transitionProductionOrder(42, ['boposPlanned'], 'boposReleased');
    assert.equal(calls[1].headers['If-Match'], 'W/"42"');
    assert.equal(calls[1].data.ProductionOrderStatus, 'boposReleased');
    await assert.rejects(
      productionOrderService._private.transitionProductionOrder(42, ['boposReleased'], 'boposClosed'),
      (error) => error.statusCode === 409,
    );
  } finally {
    sapService.request = original;
  }
});

test('issue payload links batches and bins and rejects fractional serial issues', () => {
  const body = {
    prod_order_entry: 7, posting_date: '2026-09-12', branch: 2,
    lines: [{
      item_code: 'RM-B', issue_qty: 2, warehouse: 'MAIN', base_line: 1,
      manage_batch: true, batch_numbers: [{ batch_number: 'B1', quantity: 2 }],
      enable_bin_locations: true,
      bin_allocations: [{ bin_abs: 10, quantity: 2, serial_batch_base_line: 0 }],
    }],
  };
  issueService._private._validate(body);
  const line = issueService._private._buildPayload(body).DocumentLines[0];
  assert.equal(line.BaseEntry, 7);
  assert.equal(line.DocumentLinesBinAllocations[0].SerialAndBatchNumbersBaseLine, 0);
  assert.throws(() => issueService._private._validate({
    ...body,
    lines: [{ item_code: 'RM-S', issue_qty: 1.5, warehouse: 'MAIN', manage_serial: true, serial_numbers: [{ serial_number: 'S1' }] }],
  }), /whole-number/);
});

test('receipt payload uses native complete/reject enums and no unverified custom fields', () => {
  const payload = receiptService._private._buildPayload({
    prod_order_entry: 7, posting_date: '2026-09-12', branch: 2,
    lines: [
      { item_code: 'FG-1', quantity: 1, warehouse: 'MAIN', base_entry: 7, base_line: 0, trans_type: 'Complete' },
      { item_code: 'BP-1', quantity: 1, warehouse: 'MAIN', base_entry: 7, base_line: 2, trans_type: 'Reject', by_product: true },
    ],
  });
  assert.equal(payload.DocumentLines[0].TransactionType, 'botrntComplete');
  assert.equal(payload.DocumentLines[1].TransactionType, 'botrntReject');
  assert.equal('ItemCode' in payload.DocumentLines[0], false);
  for (const line of payload.DocumentLines) {
    assert.equal(Object.keys(line).some((key) => key.startsWith('U_')), false);
  }
});

test('production write endpoints share series validation and representative SQL normalizes for HANA', () => {
  assert.equal(endpoints.ProductionOrders, '202');
  assert.equal(endpoints.InventoryGenExits, '60');
  assert.equal(endpoints.InventoryGenEntries, '59');

  const sql = `SELECT TOP 500 I.ItemCode, ISNULL(W.BinActivat, 'N') AS BinActivat
    FROM OITM I INNER JOIN OWHS W ON W.WhsCode = @warehouse
    WHERE I.ItemCode = @itemCode`;
  const hanaSql = normalizeSql(sql);
  const bound = bindParams(hanaSql, { warehouse: 'MAIN', itemCode: 'FG-1' });
  assert.doesNotMatch(hanaSql, /\bTOP\b|\bISNULL\s*\(/i);
  assert.doesNotMatch(bound.sql, /@warehouse|@itemCode/i);
  assert.match(hanaSql, /LIMIT 500/i);
  assert.deepEqual(bound.values, ['MAIN', 'FG-1']);
});

test('production metadata columns remain company-scoped and cached independently', async () => {
  const originalResolve = dbService.resolveSqlConnectionConfig;
  const originalQuery = dbService.query;
  let company = 'COMPANY_A';
  const calls = [];
  dbService.resolveSqlConnectionConfig = async () => ({
    dialect: 'sqlserver', server: 'sap-host', database: company,
  });
  dbService.query = async (_sql, params) => {
    calls.push({ company, table: params.tableName });
    return { recordset: [{ COLUMN_NAME: company === 'COMPANY_A' ? 'A_ONLY' : 'B_ONLY' }] };
  };
  try {
    company = 'COMPANY_A';
    const a = await productionDbService.getTableColumns('TEST_PRODUCTION_META');
    company = 'COMPANY_B';
    const b = await productionDbService.getTableColumns('TEST_PRODUCTION_META');
    company = 'COMPANY_A';
    const aCached = await productionDbService.getTableColumns('TEST_PRODUCTION_META');
    assert.equal(a.has('A_ONLY'), true);
    assert.equal(aCached.has('B_ONLY'), false);
    assert.equal(b.has('B_ONLY'), true);
    assert.equal(calls.length, 2);
  } finally {
    dbService.resolveSqlConnectionConfig = originalResolve;
    dbService.query = originalQuery;
  }
});
