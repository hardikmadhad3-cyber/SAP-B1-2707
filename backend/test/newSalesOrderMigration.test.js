const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const schemaPath = path.resolve(__dirname, '../db/auth-schema.sqlite.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

test('dummy-draft schema migration is additive, idempotent, and preserves existing rows', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(schemaSql);
    database.prepare(`
      INSERT INTO Companies (CompanyName, DbName)
      VALUES ('Sentinel Company', 'SENTINEL_DB')
    `).run();
    database.prepare(`
      INSERT INTO new_sales_order_dummy_drafts (
        dummyDocumentNumber, companyId, companyDb, userCode, schemaVersion,
        formDataJson, generatedPayloadJson, validationStatus
      ) VALUES (
        'NSO-TEST-999999', 1, 'SENTINEL_DB', 'sentinel-user', 'v1',
        '{}', '{}', 'validated'
      )
    `).run();

    database.exec(schemaSql);

    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM Companies').get().count, 1);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM new_sales_order_dummy_drafts').get().count, 1);
    const columns = database.prepare('PRAGMA table_info(new_sales_order_dummy_drafts)').all().map((column) => column.name);
    assert.deepEqual(columns, [
      'id', 'dummyDocumentNumber', 'companyId', 'companyDb', 'userCode', 'schemaVersion',
      'formDataJson', 'generatedPayloadJson', 'validationStatus', 'createdAt', 'updatedAt',
    ]);
    const indexes = database.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'new_sales_order_dummy_drafts'").all();
    assert.ok(indexes.some((row) => row.name === 'IX_new_sales_order_dummy_drafts_scope'));
    assert.ok(indexes.some((row) => row.name === 'UX_new_sales_order_dummy_drafts_number'));
  } finally {
    database.close();
  }
});
