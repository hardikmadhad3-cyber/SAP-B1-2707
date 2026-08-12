'use strict';

const http = require('node:http');
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createNewSalesOrderRouter } = require('../modules/newSalesOrder/newSalesOrderRoutes');
const { createSalesDocumentSchemaRouter } = require('../modules/salesDocumentSchema/salesDocumentSchemaRoutes');
const {
  createNewSalesOrderContextService,
} = require('../modules/newSalesOrder/newSalesOrderContextService');

const listen = async (app) => {
  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  return { server, url: `http://127.0.0.1:${address.port}` };
};

test('isolated router serves schema and whitelisted lookup GET endpoints', async (t) => {
  const calls = [];
  const app = express();
  app.use(express.json());
  const router = createNewSalesOrderRouter({
    authenticate: (req, _res, next) => {
      req.auth = { tokenType: 'access', userId: 7, companyId: 101, roleId: 3 };
      next();
    },
    contextMiddleware: (req, _res, next) => {
      req.newSalesOrderContext = { companyId: 101, companyDb: 'NSO_COMPANY_A', userCode: 'manager_a' };
      next();
    },
    handlers: {
      getSchema: (req, res) => {
        calls.push(['schema', req.newSalesOrderContext.companyDb]);
        res.json({ documentType: 'SALES_ORDER', companyDb: req.newSalesOrderContext.companyDb });
      },
      getLookup: (req, res) => {
        calls.push(['lookup', req.params.source, req.query.q]);
        res.json({ source: req.params.source, items: [] });
      },
      validate: (_req, res) => res.json({ success: true, valid: true }),
      saveDummyDraft: (_req, res) => res.status(201).json({ success: true }),
    },
    dummySaveGuard: (_req, _res, next) => next(),
  });
  app.use('/api/new-sales-order', router);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const { server, url } = await listen(app);
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const schemaResponse = await fetch(`${url}/api/new-sales-order/schema`);
  const lookupResponse = await fetch(`${url}/api/new-sales-order/lookups/items?q=bolt`);
  const unrelatedResponse = await fetch(`${url}/api/new-sales-order/not-a-route`);

  assert.equal(schemaResponse.status, 200);
  assert.deepEqual(await schemaResponse.json(), { documentType: 'SALES_ORDER', companyDb: 'NSO_COMPANY_A' });
  assert.equal(lookupResponse.status, 200);
  assert.deepEqual(await lookupResponse.json(), { source: 'items', items: [] });
  assert.equal(unrelatedResponse.status, 404);
  assert.deepEqual(calls, [
    ['schema', 'NSO_COMPANY_A'],
    ['lookup', 'items', 'bolt'],
  ]);
});

test('sales document schema router exposes production schema and lookup endpoints only', async (t) => {
  const calls = [];
  const app = express();
  app.use(express.json());
  const router = createSalesDocumentSchemaRouter({
    authenticate: (req, _res, next) => {
      req.auth = { tokenType: 'access', userId: 7, companyId: 101, roleId: 3 };
      next();
    },
    contextMiddleware: (req, _res, next) => {
      req.newSalesOrderContext = { companyId: 101, companyDb: 'NSO_COMPANY_A', userCode: 'manager_a' };
      next();
    },
    handlers: {
      getSchema: (req, res) => {
        calls.push(['schema', req.newSalesOrderContext.companyDb]);
        res.json({ documentType: 'SALES_ORDER', companyDb: req.newSalesOrderContext.companyDb });
      },
      getLookup: (req, res) => {
        calls.push(['lookup', req.params.source, req.query.q]);
        res.json({ source: req.params.source, items: [] });
      },
    },
  });
  app.use('/api/sales-document', router);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const { server, url } = await listen(app);
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const schemaResponse = await fetch(`${url}/api/sales-document/schema`);
  const lookupResponse = await fetch(`${url}/api/sales-document/lookups/items?q=bolt`);
  const validateResponse = await fetch(`${url}/api/sales-document/validate`, { method: 'POST' });

  assert.equal(schemaResponse.status, 200);
  assert.deepEqual(await schemaResponse.json(), { documentType: 'SALES_ORDER', companyDb: 'NSO_COMPANY_A' });
  assert.equal(lookupResponse.status, 200);
  assert.deepEqual(await lookupResponse.json(), { source: 'items', items: [] });
  assert.equal(validateResponse.status, 404);
  assert.deepEqual(calls, [
    ['schema', 'NSO_COMPANY_A'],
    ['lookup', 'items', 'bolt'],
  ]);
});

test('company context is revalidated from JWT assignment and rejects browser overrides', async () => {
  let assignmentCalls = 0;
  const service = createNewSalesOrderContextService({
    authDb: {
      getAssignedCompanyForUser: async (userId, companyId) => {
        assignmentCalls += 1;
        assert.equal(userId, 7);
        assert.equal(companyId, 101);
        return {
          CompanyId: 101,
          CompanyName: 'Company A',
          DbName: 'NSO_COMPANY_A',
          DbDialect: 'hana',
          SapUsername: 'manager_a',
        };
      },
      getUserRoleForCompany: async () => ({ RoleId: 3 }),
      queryOne: async () => ({ Username: 'developer' }),
    },
  });

  const context = await service.resolve({
    auth: { tokenType: 'access', userId: 7, companyId: 101, roleId: 3 },
    query: {},
    body: {},
    headers: {},
  });
  assert.equal(context.companyDb, 'NSO_COMPANY_A');
  assert.equal(context.userCode, 'manager_a');
  assert.equal(context.dbDialect, 'hana');
  assert.equal(assignmentCalls, 1);

  await assert.rejects(
    service.resolve({
      auth: { tokenType: 'access', userId: 7, companyId: 101, roleId: 3 },
      query: { companyDb: 'ATTACKER_DB' },
      headers: {},
    }),
    (error) => error.statusCode === 400 && error.code === 'COMPANY_SCOPE_OVERRIDE_REJECTED',
  );
  assert.equal(assignmentCalls, 1);
});

test('company context rejects unassigned and stale-role sessions', async () => {
  const unassigned = createNewSalesOrderContextService({
    authDb: {
      getAssignedCompanyForUser: async () => null,
      getUserRoleForCompany: async () => ({ RoleId: 3 }),
      queryOne: async () => ({ Username: 'developer' }),
    },
  });
  await assert.rejects(
    unassigned.resolve({
      auth: { tokenType: 'access', userId: 7, companyId: 999, roleId: 3 },
      query: {},
      headers: {},
    }),
    (error) => error.statusCode === 403 && error.code === 'COMPANY_NOT_ASSIGNED',
  );

  const stale = createNewSalesOrderContextService({
    authDb: {
      getAssignedCompanyForUser: async () => ({ DbName: 'NSO_COMPANY_A', SapUsername: 'manager_a' }),
      getUserRoleForCompany: async () => ({ RoleId: 4 }),
      queryOne: async () => ({ Username: 'developer' }),
    },
  });
  await assert.rejects(
    stale.resolve({
      auth: { tokenType: 'access', userId: 7, companyId: 101, roleId: 3 },
      query: {},
      headers: {},
    }),
    (error) => error.statusCode === 403 && error.code === 'STALE_COMPANY_SESSION',
  );
});
