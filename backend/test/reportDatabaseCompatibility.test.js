const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');
const { normalizeSql, bindParams } = require('../db/hanaDb');
const context = require('../services/requestContextService');

function load(file, dependencies, extra = '') {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../services', file), 'utf8') + extra, {
    module, exports: module.exports, console,
    require(name) { if (!(name in dependencies)) throw new Error('Unexpected dependency: ' + name); return dependencies[name]; },
  });
  return module.exports;
}

test('HANA metadata includes table and view columns in the current company schema', () => {
  const sql = normalizeSql('SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName');
  assert.match(sql, /"?SYS"?\.TABLE_COLUMNS/);
  assert.match(sql, /"?SYS"?\.VIEW_COLUMNS/);
  assert.equal((sql.match(/SCHEMA_NAME = CURRENT_SCHEMA/g) || []).length, 2);
  assert.deepEqual(bindParams(sql, { tableName: 'OINM' }).values, ['OINM']);
  const tables = normalizeSql('SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @tableName');
  assert.match(tables, /"?SYS"?\.VIEWS/);
});

test('HANA numeric checks handle nested expressions containing string literals', () => {
  const sql = normalizeSql("SELECT ISNUMERIC(CAST(ISNULL(NULLIF(H.Branch, ''), H.BPLId) AS NVARCHAR(50))) AS IsNumber FROM OPRQ H");
  assert.doesNotMatch(sql, /ISNUMERIC\(/);
  assert.match(sql, /LIKE_REGEXPR/);
  assert.match(sql, /NULLIF\(H\."Branch", ''\)/);
  assert.match(normalizeSql("SELECT 'ISNUMERIC(' AS Label FROM OPRQ"), /'ISNUMERIC\('/);
});

test('latest-stage join keeps one row per opportunity and retains opportunities without stages', () => {
  const { buildLatestStageJoin } = load('opportunitiesForecastDbService.js', {
    './dbService': {}, './reportMetadataService': {},
  }, '\nmodule.exports.buildLatestStageJoin = buildLatestStageJoin;');
  const join = buildLatestStageJoin({ opr1Line: 'Line', opr1OppId: 'OpprId', oppId: 'OpprId' });
  const sql = 'SELECT opp.OpprId, lastStageLine.StageKey FROM OOPR opp ' + join + ' ORDER BY opp.OpprId';
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE OOPR (OpprId INTEGER); CREATE TABLE OPR1 (OpprId INTEGER, Line INTEGER, StageKey INTEGER); INSERT INTO OOPR VALUES (1),(2),(3); INSERT INTO OPR1 VALUES (1,0,10),(1,1,20),(2,0,30);');
    for (const query of [sql, normalizeSql(sql)]) {
      assert.deepEqual(db.prepare(query).all().map(row => [row.OpprId, row.StageKey]), [[1,20],[2,30],[3,null]]);
    }
  } finally { db.close(); }
});

test('report metadata cache isolates connections, concurrent requests, and schema changes', async () => {
  let calls = 0;
  const service = load('reportMetadataService.js', {
    './requestContextService': context,
    './dbService': {
      resolveSqlConnectionConfig: async (options = {}) => ({ dialect: options.dialect || 'hana', server: options.server || context.getRequestContext().req.server, database: 'SAME_NAME', user: 'reader' }),
      query: async (_sql, _params, options = {}) => { calls++; return [{ COLUMN_NAME: (options.server || context.getRequestContext().req.server) === 'A' ? 'BPLId' : 'Branch' }]; },
    },
  });
  await Promise.all(['A','B'].map(server => context.runWithRequestContext({ server }, async () => {
    const first = await service.getReportTableColumns('OPRQ');
    const second = await service.getReportTableColumns('OPRQ');
    assert.equal(first.has(server === 'A' ? 'BPLID' : 'BRANCH'), true);
    assert.equal(second.has(server === 'A' ? 'BPLID' : 'BRANCH'), true);
  })));
  assert.equal(calls, 2);
  await context.runWithRequestContext({ server: 'A' }, async () => {
    await service.getReportTableColumns('OPRQ');
    await service.getReportTableColumns('OPRQ', { server: 'B' });
    await service.getReportTableColumns('OPRQ', { server: 'B', dialect: 'sqlserver' });
  });
  assert.equal(calls, 5);
});

test('failed report metadata queries are retryable and never cached as missing tables', async () => {
  let calls = 0;
  const service = load('reportMetadataService.js', {
    './requestContextService': context,
    './dbService': {
      resolveSqlConnectionConfig: async () => ({ database: 'A', server: 'A' }),
      query: async () => { if (++calls === 1) throw new Error('offline'); return [{ TABLE_NAME: 'OINM' }]; },
    },
  });
  await context.runWithRequestContext({}, async () => {
    await assert.rejects(service.reportTableExists('OINM'), /offline/);
    assert.equal(await service.reportTableExists('OINM'), true);
  });
});

test('purchase request reports omit unavailable optional fields and keep branch values textual', async () => {
  for (const columns of [[], ['BPLID'], ['BRANCH','BPLID','DEPARTMENT','ORIGINTYPE','TODATE','REQDATE']]) {
    let query;
    const service = load('reports/purchaseRequestReport.service.js', {
      '../reportMetadataService': { getReportTableColumns: async () => new Set(columns) },
      '../../services/dbService': { query: async sql => { query = sql; return { recordset: [] }; } },
    });
    await service.getPurchaseRequestReport({ type: 'Item', branch: { enabled: true, code: '1' }, department: { enabled: true, code: '2' }, displayMrpOnly: true });
    for (const name of ['Branch','BPLId','Department','OriginType','ToDate','ReqDate']) {
      if (!columns.includes(name.toUpperCase())) assert.doesNotMatch(query, new RegExp('H\\.\\[?' + name + '\\b', 'i'));
    }
    assert.doesNotMatch(query, /ISNUMERIC|THEN CAST/);
    assert.match(query, /CAST\(B.BPLId AS NVARCHAR\(50\)\)/);
  }
});

test('won-opportunity buckets aggregate a computed column and preserve boundary totals', async () => {
  const db = new DatabaseSync(':memory:');
  const columns = new Set(['OPPRID','STATUS','OPENDATE','CLOSEDATE','MAXSUMLOC']);
  db.function('DAYS_BETWEEN', (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000));
  db.function('CEILING', Math.ceil);
  db.exec("CREATE TABLE OOPR (OpprId INTEGER, Status TEXT, OpenDate TEXT, CloseDate TEXT, MaxSumLoc REAL); INSERT INTO OOPR VALUES (1,'W','2026-01-01','2026-01-11',100),(2,'W','2026-01-01','2026-01-12',200),(3,'W','2026-01-01','2026-01-21',300),(4,'O','2026-01-01','2026-01-12',400);");
  let buckets;
  const service = load('opportunitiesForecastDbService.js', {
    './reportMetadataService': { reportTableExists: async table => table === 'OOPR', getReportTableColumns: async () => columns },
    './dbService': { query: async (sql, params) => {
      assert.match(sql, /GROUP BY buckets.BucketIndex/);
      const bound = bindParams(normalizeSql(sql), params);
      buckets = db.prepare(bound.sql).all(...bound.values);
      return { recordset: buckets };
    } },
  });
  try {
    await service.getWonOpportunitiesReport({ rangeDays: 10 });
    assert.deepEqual(buckets.map(row => [row.BucketIndex,row.OpportunityCount,row.TotalAmount]), [[0,1,100],[1,2,500]]);
  } finally { db.close(); }
});
