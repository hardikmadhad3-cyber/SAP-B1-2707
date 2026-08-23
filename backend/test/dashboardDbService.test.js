const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSql } = require('../db/hanaDb');
const { cacheMiddleware, clearCache } = require('../middleware/cacheMiddleware');
const {
  SALES_TOTAL_SQL,
  REVENUE_GROSS_PROFIT_SQL,
  TOP_CUSTOMERS_SQL,
  TOP_ITEMS_SQL,
  buildComparisonWindow,
  buildMonthBuckets,
  buildRecentDocumentsSql,
  calculateChangePercent,
  createDashboardDbService,
} = require('../services/dashboardDbService');

test('dashboard cache entries are isolated by both company and user', () => {
  clearCache('dashboard-test');
  const middleware = cacheMiddleware({ namespace: 'dashboard-test', ttlSeconds: 30 });
  const execute = (userId, nextBody) => {
    const response = { headers: {}, statusCode: 200, body: null };
    response.set = (name, value) => { response.headers[name] = value; return response; };
    response.status = (statusCode) => { response.statusCode = statusCode; return response; };
    response.json = (body) => { response.body = body; return response; };
    let calledNext = false;
    middleware({
      method: 'GET',
      originalUrl: '/api/dashboard/overview',
      auth: { companyId: 9, userId },
    }, response, () => {
      calledNext = true;
      response.json(nextBody);
    });
    return { calledNext, response };
  };

  assert.equal(execute(101, { owner: 101 }).calledNext, true);
  const cachedForSameUser = execute(101, { owner: 'should-not-run' });
  assert.equal(cachedForSameUser.calledNext, false);
  assert.deepEqual(cachedForSameUser.response.body, { owner: 101 });
  const differentUser = execute(202, { owner: 202 });
  assert.equal(differentUser.calledNext, true);
  assert.deepEqual(differentUser.response.body, { owner: 202 });
});

test('builds an equal-length comparison window before the fiscal period', () => {
  assert.deepEqual(buildComparisonWindow('2026-04-01', '2026-08-13'), {
    currentFrom: '2026-04-01',
    currentTo: '2026-08-13',
    previousFrom: '2025-11-17',
    previousTo: '2026-03-31',
  });
  assert.equal(calculateChangePercent(120, 100), 20);
  assert.equal(calculateChangePercent(100, 0), null);
});

test('fills missing fiscal months with zero-valued chart buckets', () => {
  const rows = buildMonthBuckets('2026-04-01', '2026-08-13', [
    { SalesYear: 2026, SalesMonth: 4, Revenue: 100, GrossProfit: 25 },
    { SalesYear: 2026, SalesMonth: 6, Revenue: 75, GrossProfit: 20 },
  ]);

  assert.deepEqual(rows.map((row) => row.key), [
    '2026-04', '2026-05', '2026-06', '2026-07', '2026-08',
  ]);
  assert.equal(rows[1].revenue, 0);
  assert.equal(rows[2].grossProfit, 20);
});

test('dashboard sales SQL remains portable through the HANA adapter', () => {
  const hanaSql = normalizeSql(SALES_TOTAL_SQL);
  assert.match(hanaSql, /FROM "OINV"/);
  assert.match(hanaSql, /FROM "ORIN"/);
  assert.match(hanaSql, /IFNULL/);
  assert.doesNotMatch(hanaSql, /ISNULL/);

  [TOP_ITEMS_SQL, TOP_CUSTOMERS_SQL, REVENUE_GROSS_PROFIT_SQL].forEach((sql) => {
    const normalized = normalizeSql(sql);
    assert.match(normalized, /FROM "OINV"/);
    assert.match(normalized, /FROM "ORIN"/);
    assert.doesNotMatch(normalized, /\bTOP\s+5\b/i);
  });

  const recentSql = normalizeSql(buildRecentDocumentsSql([
    { objectType: 'salesOrder', label: 'Sales Order', table: 'ORDR' },
  ]));
  assert.match(recentSql, /FROM "ORDR"/);
  assert.match(recentSql, /LIMIT 8/);
});

test('loads a role-filtered company overview and applies SAP salesperson scope', async () => {
  const calls = [];
  const database = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('currentPeriod.Indicator')) {
        return { recordset: [{ Indicator: '2026-27', FiscalStart: '2026-04-01', FiscalEnd: '2027-03-31' }] };
      }
      if (sql.includes('MainCurncy')) {
        return { recordset: [{ LocalCurrency: 'INR', SystemCurrency: 'USD' }] };
      }
      if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) {
        return { recordset: [
          { TABLE_NAME: 'OUSR', COLUMN_NAME: 'USERID' },
          { TABLE_NAME: 'OUSR', COLUMN_NAME: 'USER_CODE' },
          { TABLE_NAME: 'OUSR', COLUMN_NAME: 'U_NAME' },
          { TABLE_NAME: 'OHEM', COLUMN_NAME: 'userId' },
          { TABLE_NAME: 'OHEM', COLUMN_NAME: 'salesPrson' },
        ] };
      }
      if (sql.includes('FROM OUSR usr')) {
        return { recordset: [{ SalesEmployeeCode: 4, SalesEmployeeName: 'Manager' }] };
      }
      if (sql.includes('WITH NetSales AS')) {
        return { recordset: [{ CurrentAmount: 1500, PreviousAmount: 1000 }] };
      }
      if (sql.includes('FROM JDT1 line')) {
        return { recordset: [{ ReceivableAmount: 825 }] };
      }
      if (sql.includes('COUNT(DISTINCT doc.DocEntry)')) {
        return { recordset: [{ OpenOrderCount: 3 }] };
      }
      if (sql.includes('WITH NetItemSales AS')) {
        return { recordset: [{ ItemCode: 'I-1', ItemName: 'Item One', Amount: 700 }] };
      }
      if (sql.includes('WITH NetCustomerSales AS')) {
        return { recordset: [{ CardCode: 'C-1', CardName: 'Customer One', Amount: 900 }] };
      }
      if (sql.includes('WITH MonthlySales AS')) {
        return { recordset: [{ SalesYear: 2026, SalesMonth: 4, Revenue: 1500, GrossProfit: 300 }] };
      }
      if (sql.includes('WITH RecentDocuments AS')) {
        return { recordset: [{
          ObjectType: 'salesOrder', DocumentLabel: 'Sales Order', DocEntry: 12,
          DocNum: 45, CardCode: 'C-1', CardName: 'Customer One',
          DocDate: '2026-08-12', UpdatedAt: '2026-08-13',
        }] };
      }
      throw new Error(`Unexpected dashboard SQL: ${sql.slice(0, 80)}`);
    },
  };
  const service = createDashboardDbService({
    database,
    companyConfigLoader: async () => ({ userMapping: { sapUserCode: 'manager' } }),
  });

  const overview = await service.getOverview({
    asOfDate: '2026-08-13',
    allowedRoutes: ['/sales-order'],
  });

  assert.equal(overview.currency.local, 'INR');
  assert.equal(overview.userScope.mode, 'sales-employee');
  assert.equal(overview.kpis.salesAmount.value, 1500);
  assert.equal(overview.kpis.salesAmount.changePercent, 50);
  assert.equal(overview.kpis.openSalesOrders.value, 3);
  assert.equal(overview.topItems[0].code, 'I-1');
  assert.equal(overview.recentUpdates[0].route, '/sales-order');

  const openOrderCall = calls.find((call) => call.sql.includes('COUNT(DISTINCT doc.DocEntry)'));
  assert.match(openOrderCall.sql, /doc\.SlpCode = @salesEmployeeCode/);
  assert.deepEqual(openOrderCall.params, { salesEmployeeCode: 4 });
  const recentCall = calls.find((call) => call.sql.includes('WITH RecentDocuments AS'));
  assert.match(recentCall.sql, /FROM ORDR/);
  assert.doesNotMatch(recentCall.sql, /FROM OINV/);
});
