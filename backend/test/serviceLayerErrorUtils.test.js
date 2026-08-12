const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createServiceLayerLoginError,
  getSapErrorMessage,
} = require('../services/serviceLayerErrorUtils');

test('wraps SAP credential failures without exposing them as Web Client authentication failures', () => {
  const source = new Error('Request failed with status code 401');
  source.response = {
    status: 401,
    data: {
      error: {
        code: 100000027,
        message: { value: 'Login failed' },
      },
    },
  };

  const error = createServiceLayerLoginError(source, {
    companyDb: 'TEST_COMPANY',
    baseUrl: 'https://sap.example.test:50000/b1s/v1',
  });

  assert.equal(error.statusCode, 502);
  assert.equal(error.code, 'SAP_SERVICE_LAYER_LOGIN_FAILED');
  assert.equal(error.sapCode, 100000027);
  assert.equal(error.upstreamStatus, 401);
  assert.equal(error.response, undefined);
  assert.equal(error.serviceLayer.host, 'sap.example.test:50000');
  assert.match(error.message, /TEST_COMPANY/);
  assert.match(error.message, /Company Master/);
});

test('keeps useful SAP messages for non-credential login failures', () => {
  const source = new Error('Request failed');
  source.response = {
    status: 500,
    data: { error: { message: { value: 'Company database is unavailable' } } },
  };

  const error = createServiceLayerLoginError(source, { companyDb: 'COMPANY_A' });

  assert.equal(error.statusCode, 502);
  assert.equal(error.code, 'SAP_SERVICE_LAYER_LOGIN_UNAVAILABLE');
  assert.match(error.message, /Company database is unavailable/);
});

test('extracts SAP Service Layer message values', () => {
  const error = {
    response: { data: { error: { message: { value: 'SAP validation message' } } } },
  };

  assert.equal(getSapErrorMessage(error), 'SAP validation message');
});
