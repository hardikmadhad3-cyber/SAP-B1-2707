const { AsyncLocalStorage } = require('async_hooks');

const requestContextStorage = new AsyncLocalStorage();

const runWithRequestContext = (req, callback) =>
  requestContextStorage.run({ req }, callback);

const getRequestContext = () => requestContextStorage.getStore() || null;

const getOrSetContextValue = (key, factory) => {
  const context = getRequestContext();
  if (!context) return factory();

  if (!Object.prototype.hasOwnProperty.call(context, key)) {
    context[key] = factory();
  }

  return context[key];
};

const setCompanyContextOverride = (company) => {
  const context = getRequestContext();
  if (!context) {
    throw new Error('A request context is required to select an Admin Panel company.');
  }
  context.companyOverride = company || null;
  context.databaseName = String(company?.DbName || '').trim();
};

module.exports = {
  runWithRequestContext,
  getRequestContext,
  getOrSetContextValue,
  setCompanyContextOverride,
};
