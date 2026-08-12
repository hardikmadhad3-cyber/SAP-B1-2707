const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  createNewSalesOrderDummyRepository,
  formatDummyDocumentNumber,
} = require('../modules/newSalesOrder/newSalesOrderDummyRepository');
const { createSqliteAuthDbTestAdapter } = require('./helpers/sqliteAuthDbTestAdapter');

const schemaSql = fs.readFileSync(path.resolve(__dirname, '../db/auth-schema.sqlite.sql'), 'utf8');

test('saves sequential local-only dummy drafts and reloads JSON within company/user scope', async () => {
  const adapter = createSqliteAuthDbTestAdapter(schemaSql);
  try {
    await adapter.authDb.query(`
      INSERT INTO Companies (CompanyName, DbName)
      VALUES (@companyName, @dbName)
    `, { companyName: 'Dummy Company A', dbName: 'DUMMY_COMPANY_A' });
    const repository = createNewSalesOrderDummyRepository({ authDb: adapter.authDb });
    const input = {
      companyId: 1,
      companyDb: 'DUMMY_COMPANY_A',
      userCode: 'tester-a',
      schemaVersion: 'schema-a-v1',
      formData: { header: { values: { cardCode: 'C00001' }, udf: {} }, lines: [] },
      generatedPayload: { CardCode: 'C00001', DocumentLines: [] },
      validationStatus: 'validated',
    };

    const first = await repository.saveDummyDraft(input);
    const second = await repository.saveDummyDraft(input);
    assert.equal(first.dummyDocumentNumber, 'NSO-TEST-000001');
    assert.equal(second.dummyDocumentNumber, 'NSO-TEST-000002');
    assert.deepEqual(first.formData, input.formData);
    assert.deepEqual(first.generatedPayload, input.generatedPayload);
    assert.equal(first.companyDb, 'DUMMY_COMPANY_A');
    assert.equal(first.validationStatus, 'validated');

    const loaded = await repository.findDummyDraftForScope({ id: first.id, companyId: 1, userCode: 'tester-a' });
    const hiddenFromOtherUser = await repository.findDummyDraftForScope({ id: first.id, companyId: 1, userCode: 'tester-b' });
    assert.equal(loaded.dummyDocumentNumber, first.dummyDocumentNumber);
    assert.equal(hiddenFromOtherUser, null);
    assert.equal(adapter.database.prepare('SELECT COUNT(*) AS count FROM new_sales_order_dummy_drafts').get().count, 2);
  } finally {
    adapter.close();
  }
});

test('formats a stable local dummy number and rejects invalid ids', () => {
  assert.equal(formatDummyDocumentNumber(42), 'NSO-TEST-000042');
  assert.throws(() => formatDummyDocumentNumber(0));
});
