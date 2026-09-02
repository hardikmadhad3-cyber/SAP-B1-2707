'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createSqliteAuthDbTestAdapter } = require('./helpers/sqliteAuthDbTestAdapter');
const {
  createSalesDocumentCustomLookupService,
  normalizeInput,
} = require('../modules/salesDocumentSchema/salesDocumentCustomLookupService');
const { createNewSalesOrderLookupService } = require('../modules/newSalesOrder/newSalesOrderLookupService');
const { createSalesDocumentCustomLookupRepository } = require('../modules/salesDocumentSchema/salesDocumentCustomLookupRepository');

const context = { userId: 7, companyId: 2, companyDb: 'TEST_DB', dbDialect: 'hana' };
const schemaSql = fs.readFileSync(path.resolve(__dirname, '../db/auth-schema.sqlite.sql'), 'utf8');

test('custom lookup repository persists definitions in one company only', async () => {
  const adapter = createSqliteAuthDbTestAdapter(schemaSql);
  try {
    await adapter.authDb.query("INSERT INTO Companies (CompanyName, DbName) VALUES ('A', 'A_DB')");
    await adapter.authDb.query("INSERT INTO Companies (CompanyName, DbName) VALUES ('B', 'B_DB')");
    await adapter.authDb.query("INSERT INTO Users (Username, PasswordHash) VALUES ('admin', 'hash')");
    const repository = createSalesDocumentCustomLookupRepository({ authDb: adapter.authDb });
    const saved = await repository.save({ companyId: 1, lookupName: 'Items', queryText: 'SELECT 1 AS value, 1 AS label', userId: 1 });
    assert.equal(saved.LookupName, 'Items');
    assert.equal((await repository.list(1)).length, 1);
    assert.equal((await repository.list(2)).length, 0);
    assert.equal(await repository.findById(2, saved.CustomLookupId), null);
  } finally {
    adapter.close();
  }
});

test('accepts SQL Server and HANA lookup aliases and blocks write-capable queries', () => {
  assert.equal(normalizeInput({ name: 'SQL', queryText: 'SELECT 1 AS [value], 2 AS [label]' }).name, 'SQL');
  assert.equal(normalizeInput({ name: 'HANA', queryText: 'SELECT 1 AS "value", 2 AS "label" FROM DUMMY' }).name, 'HANA');
  assert.throws(
    () => normalizeInput({ name: 'Unsafe', queryText: 'DELETE FROM OITM' }),
    (error) => error.code === 'UNSAFE_CUSTOM_LOOKUP_QUERY',
  );
  assert.throws(
    () => normalizeInput({ name: 'Missing aliases', queryText: 'SELECT ItemCode FROM OITM' }),
    (error) => error.code === 'CUSTOM_LOOKUP_ALIASES_REQUIRED',
  );
});

test('Admin preview returns the complete result without a 50-row cap', async () => {
  const rows = Array.from({ length: 137 }, (_, index) => ({ value: `I${index}`, label: `Item ${index}` }));
  const service = createSalesDocumentCustomLookupService({
    customLookups: { list: async () => [], save: async () => null },
    readOnlyDb: { select: async () => rows },
  });
  const result = await service.preview(context, { name: 'All items', queryText: 'SELECT ItemCode AS value, ItemName AS label FROM OITM' });
  assert.equal(result.rowCount, 137);
  assert.equal(result.rows.length, 137);
});

test('runtime custom lookup resolves only within the authenticated company and remains pageable', async () => {
  const calls = [];
  const service = createNewSalesOrderLookupService({
    metadata: { getDialect: async () => 'hana' },
    schemas: {},
    customLookups: {
      findById: async (companyId, lookupId) => {
        calls.push([companyId, lookupId]);
        return companyId === 2 ? { QueryText: 'SELECT 1 AS "value", 1 AS "label" FROM DUMMY' } : null;
      },
    },
    readOnlyDb: {
      select: async () => Array.from({ length: 105 }, (_, index) => ({ value: String(index), label: `Row ${index}` })),
    },
  });
  const first = await service.getLookup(context, 'custom:9', { page: 1, limit: 100 });
  const second = await service.getLookup(context, 'custom:9', { page: 2, limit: 100 });
  assert.equal(first.items.length, 100);
  assert.equal(first.hasMore, true);
  assert.equal(second.items.length, 5);
  assert.equal(second.hasMore, false);
  assert.deepEqual(calls, [[2, 9], [2, 9]]);
});
