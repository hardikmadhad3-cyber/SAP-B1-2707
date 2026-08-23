'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const odbc = require('../db/odbc');
const dbService = require('../services/dbService');

test('exposes the active-company context required by shared database utilities', () => {
  assert.equal(typeof odbc.query, 'function');
  assert.equal(odbc.resolveDatabaseName, dbService.resolveDatabaseName);
  assert.equal(odbc.getDialect, dbService.getDialect);
  assert.equal(odbc.resolveSqlConnectionConfig, dbService.resolveSqlConnectionConfig);
});
