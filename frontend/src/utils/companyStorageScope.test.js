import {
  buildCompanyStorageScope,
  createCompanyScopedRouteState,
  isRouteStateForCompany,
} from './companyStorageScope';

test('accepts edit route state only for the company that created it', () => {
  const primaryCompany = {
    companyId: 7,
    dbName: 'SBODEMO_US',
    serverName: 'SQL-HOST',
  };
  const reportingCompany = {
    companyId: 8,
    dbName: 'SBODEMO_US',
    serverName: 'SQL-HOST',
  };
  const state = createCompanyScopedRouteState(
    { arInvoiceDocEntry: 42 },
    primaryCompany,
  );

  expect(state.sapCompanyScope).toBe(buildCompanyStorageScope(primaryCompany));
  expect(isRouteStateForCompany(state, primaryCompany)).toBe(true);
  expect(isRouteStateForCompany(state, reportingCompany)).toBe(false);
  expect(isRouteStateForCompany({ arInvoiceDocEntry: 42 }, primaryCompany)).toBe(false);
});
