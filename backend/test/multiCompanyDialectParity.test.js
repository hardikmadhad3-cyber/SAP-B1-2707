'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const hanaDb = require('../db/hanaDb');
const { columnType } = require('../services/companyFormQueryService');
const {
  createNewSalesOrderMetadataRepository,
} = require('../modules/newSalesOrder/newSalesOrderMetadataRepository');
const { PURCHASE_ORDER_DOCUMENT } = require('../modules/newSalesOrder/newSalesOrderConstants');

// getColumnInfo() as the HANA driver reports a SAP B1 line table.
const HANA_COLUMN_INFO = [
  { columnName: 'DocEntry', typeName: 'INT', length: 10, scale: 0, nullable: false },
  { columnName: 'Price', typeName: 'DECIMAL', length: 19, scale: 6, nullable: true },
  { columnName: 'Quantity', typeName: 'DECIMAL', length: 19, scale: 6, nullable: true },
  { columnName: 'Dscription', typeName: 'NVARCHAR', length: 200, nullable: true },
  { columnName: 'ShipDate', typeName: 'SECONDDATE', nullable: true },
  { columnName: 'DocTime', typeName: 'TIMESTAMP', nullable: true },
];

test('HANA result sets expose column metadata in the shape mssql reports', () => {
  const { columns } = hanaDb.buildColumnMetadata(HANA_COLUMN_INFO);

  assert.equal(columns.Price.name, 'Price');
  assert.equal(columns.Price.type.declaration, 'decimal');
  assert.equal(columns.Price.scale, 6);
  assert.equal(columns.Price.nullable, true);
  assert.equal(columns.DocEntry.nullable, false);
  assert.equal(columns.DocEntry.index, 0);
});

test('HANA numeric columns are coerced to numbers like the SQL Server driver returns them', () => {
  const { numericColumns } = hanaDb.buildColumnMetadata(HANA_COLUMN_INFO);
  const row = hanaDb.normalizeRowValues({
    DocEntry: 42,
    Price: '1234.560000',
    Quantity: '2.000000',
    Dscription: '1234.56',
    ShipDate: '2026-09-20',
  }, numericColumns);

  assert.equal(row.Price, 1234.56);
  assert.equal(row.Quantity, 2);
  // A text column that merely looks numeric must keep its string value.
  assert.equal(row.Dscription, '1234.56');
  assert.ok(row.ShipDate instanceof Date);
});

test('a decimal too large for a double keeps its exact text rather than rounding', () => {
  assert.equal(hanaDb.normalizeNumericValue('12345678901234567890.5'), '12345678901234567890.5');
  assert.equal(hanaDb.normalizeNumericValue('1234.56'), 1234.56);
  assert.equal(hanaDb.normalizeNumericValue('not a number'), 'not a number');
  assert.equal(hanaDb.normalizeNumericValue(''), '');
});

test('a published column is typed identically on SQL Server and HANA', () => {
  const cases = [
    ['a price column', { type: { declaration: 'decimal(19,6)' } }, { type: { declaration: 'decimal' } }, 'number'],
    ['an integer column', { type: { declaration: 'int' } }, { type: { declaration: 'int' } }, 'number'],
    ['a posting date', { type: { declaration: 'datetime' } }, { type: { declaration: 'seconddate' } }, 'date'],
    ['a timestamp', { type: { declaration: 'datetime2' } }, { type: { declaration: 'timestamp' } }, 'date'],
    ['a description', { type: { declaration: 'nvarchar' } }, { type: { declaration: 'nvarchar' } }, 'text'],
  ];

  for (const [label, sqlServer, hana, expected] of cases) {
    // No sample value: an empty preview must not change the published type.
    assert.equal(columnType(sqlServer, undefined), expected, `SQL Server ${label}`);
    assert.equal(columnType(hana, undefined), expected, `HANA ${label}`);
  }
});

const layoutRow = (overrides = {}) => ({
  tableName: 'POR1',
  columnUid: '5',
  fieldName: 'Price',
  columnTitle: 'Unit Price',
  visible: 1,
  editable: 1,
  columnOrder: 5,
  width: 120,
  dataType: 'price',
  isUdf: 0,
  source: 'live',
  updatedAt: '2026-09-20 10:00:00',
  ...overrides,
});

const createAuthDbStub = (rows) => ({
  calls: [],
  async queryRows(sql, params) {
    this.calls.push({ sql, params });
    if (/GROUP BY userCode/i.test(sql)) {
      const owners = rows
        .filter((row) => row.companyId === params.companyId)
        .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
      return owners.length ? [{ userCode: owners[0].userCode }] : [];
    }
    return rows
      .filter((row) => row.companyId === params.companyId)
      .filter((row) => row.userCode.toUpperCase() === String(params.userCode).toUpperCase())
      .map((row) => row.column);
  },
});

const createRepository = (authDb) => createNewSalesOrderMetadataRepository({
  authDb,
  readOnlyDb: { select: async () => [], getDialect: async () => 'sqlserver' },
});

test('an imported layout is scoped to the company, not to the database name', async () => {
  const authDb = createAuthDbStub([
    { companyId: 1, userCode: 'manager', updatedAt: '2026-09-20', column: layoutRow() },
    { companyId: 2, userCode: 'manager', updatedAt: '2026-09-20', column: layoutRow({ fieldName: 'DiscPrcnt', columnTitle: 'Discount %' }) },
  ]);
  const repository = createRepository(authDb);

  const companyOne = await repository.getLayoutRows(
    { companyId: 1, companyDb: 'SBODEMO', userCode: 'manager' }, PURCHASE_ORDER_DOCUMENT,
  );
  const companyTwo = await repository.getLayoutRows(
    { companyId: 2, companyDb: 'SBODEMO', userCode: 'manager' }, PURCHASE_ORDER_DOCUMENT,
  );

  assert.deepEqual(companyOne.map((row) => row.fieldName), ['Price']);
  assert.deepEqual(companyTwo.map((row) => row.fieldName), ['DiscPrcnt']);
});

test('a user without their own layout inherits the company most recently synchronised one', async () => {
  const authDb = createAuthDbStub([
    { companyId: 1, userCode: 'manager', updatedAt: '2026-09-01', column: layoutRow({ columnTitle: 'Older' }) },
    { companyId: 1, userCode: 'sapadmin', updatedAt: '2026-09-19', column: layoutRow({ columnTitle: 'Newest' }) },
  ]);
  const repository = createRepository(authDb);

  const rows = await repository.getLayoutRows(
    { companyId: 1, companyDb: 'SBODEMO', userCode: 'someone-else' }, PURCHASE_ORDER_DOCUMENT,
  );

  assert.deepEqual(rows.map((row) => row.columnTitle), ['Newest']);
});

test('a company with no imported layout at all returns no rows rather than another company one', async () => {
  const authDb = createAuthDbStub([
    { companyId: 1, userCode: 'manager', updatedAt: '2026-09-20', column: layoutRow() },
  ]);
  const repository = createRepository(authDb);

  assert.deepEqual(
    await repository.getLayoutRows({ companyId: 9, companyDb: 'OTHERDB', userCode: 'manager' }, PURCHASE_ORDER_DOCUMENT),
    [],
  );
});
