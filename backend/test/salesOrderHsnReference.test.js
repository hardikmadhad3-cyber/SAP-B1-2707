'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../services/dbService');

test('Sales Order item details load the visible HSN code from OCHP', async (t) => {
  const originalQuery = db.query;
  let capturedSql = '';
  t.after(() => {
    db.query = originalQuery;
  });

  db.query = async (sql) => {
    capturedSql = sql;
    return {
      recordset: [{
        ItemCode: 'ITEM-1',
        ItemName: 'Test Item',
        HSNCode: '5208',
      }],
    };
  };

  delete require.cache[require.resolve('../services/salesOrderDbService')];
  const salesOrderDbService = require('../services/salesOrderDbService');
  const item = await salesOrderDbService.getItemDetails('ITEM-1');

  assert.match(capturedSql, /LEFT JOIN OCHP CHP ON CHP\.AbsEntry = T0\.ChapterID/i);
  assert.match(capturedSql, /CHP\.ChapterID[\s\S]+AS HSNCode/i);
  assert.equal(item.HSNCode, '5208');
  assert.equal(item.SWW, '5208');
});
