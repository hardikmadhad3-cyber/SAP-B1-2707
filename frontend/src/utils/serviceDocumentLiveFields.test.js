import {
  buildServiceDocumentLiveFields,
  getSapStandardServiceMatrixColumns,
} from './serviceDocumentLiveFields';

const schema = {
  documentType: 'SERVICE_AP_INVOICE',
  objectType: '18',
  companyId: 10,
  companyDb: 'COMPANY_A',
  headerTable: 'OPCH',
  lineTable: 'PCH1',
  schemaVersion: 'service-a',
  headerFields: [],
  lineFields: [
    { id: 'PCH1.Dscription', stateKey: 'description', sapField: 'ItemDescription', databaseField: 'Dscription', label: 'Description', visible: true, editable: true, order: 1 },
    { id: 'PCH1.AcctCode', stateKey: 'glAccount', sapField: 'AccountCode', databaseField: 'AcctCode', label: 'G/L Account', visible: true, editable: true, order: 2 },
    { id: 'PCH1.LineTotal', stateKey: 'totalLC', sapField: 'LineTotal', databaseField: 'LineTotal', label: 'Total', visible: true, editable: false, readOnly: true, storage: 'calculated', type: 'number', order: 3 },
    { id: 'PCH1.ItemCode', stateKey: 'ItemCode', sapField: 'ItemCode', databaseField: 'ItemCode', label: 'Item No.', visible: true, editable: false, readOnly: true, storage: 'display-only', order: 4 },
    { id: 'PCH1.Legacy', stateKey: 'Legacy', sapField: 'Legacy', databaseField: 'Legacy', label: 'Legacy', visible: true, editable: true, order: 5 },
    { id: 'PCH1.U_CompanyA', stateKey: 'U_CompanyA', sapField: 'U_CompanyA', databaseField: 'U_CompanyA', label: 'Company A', storage: 'udf', visible: true, editable: true, order: 6 },
  ],
};

test('pins mandatory service identity fields in the safe fallback profile', () => {
  const fields = getSapStandardServiceMatrixColumns();

  expect(fields.find((field) => field.key === 'description')).toMatchObject({ requiredVisible: true });
  expect(fields.find((field) => field.key === 'glAccount')).toMatchObject({ requiredVisible: true });
});

test('maps service standards, keeps unsupported standards read-only, and exposes only schema UDFs', () => {
  const result = buildServiceDocumentLiveFields({
    schema,
    documentType: 'SERVICE_AP_INVOICE',
    headerTable: 'OPCH',
    lineTable: 'PCH1',
    companyId: 10,
    companyDb: 'COMPANY_A',
    layoutResponse: {
      source: 'live-sap-metadata',
      columns: [
        { fieldName: 'AcctCode', columnTitle: 'G/L Account (SAP)', visible: true, editable: true, columnOrder: 1, width: 180 },
        { fieldName: 'LineTotal', columnTitle: 'Total (SAP)', visible: true, editable: false, columnOrder: 2, width: 130 },
        { fieldName: 'Legacy', columnTitle: 'Legacy (SAP)', visible: true, editable: true, columnOrder: 3, width: 120 },
        { fieldName: 'U_Deleted', columnTitle: 'Deleted UDF', visible: true, editable: true, columnOrder: 4, isUdf: true },
        { fieldName: 'U_CompanyA', columnTitle: 'Company A UDF', visible: true, editable: true, columnOrder: 5, width: 150, isUdf: true },
      ],
    },
  });

  expect(result.liveAvailable).toBe(true);
  expect(result.matrixColumns.find((field) => field.key === 'glAccount')).toMatchObject({
    label: 'G/L Account (SAP)',
    readOnly: false,
    width: 180,
  });
  expect(result.matrixColumns.find((field) => field.key === 'totalLC').readOnly).toBe(true);
  expect(result.matrixColumns.some((field) => field.sapField === 'ItemCode')).toBe(false);
  expect(result.matrixColumns.find((field) => field.key.startsWith('sapLayout_')).readOnly).toBe(true);
  expect(result.rowUdfFields.map((field) => field.key)).toEqual(['U_CompanyA']);
  expect(result.rowUdfFields[0]).toMatchObject({
    label: 'Company A UDF',
    visible: true,
    active: true,
    order: 5,
    minWidth: 150,
  });
});

test('does not expose physical service-table columns when SAP layout metadata is unavailable', () => {
  const result = buildServiceDocumentLiveFields({
    schema,
    documentType: 'SERVICE_AP_INVOICE',
    headerTable: 'OPCH',
    lineTable: 'PCH1',
    companyId: 10,
    companyDb: 'COMPANY_A',
    layoutResponse: { source: 'fallback', columns: [] },
  });

  expect(result.liveAvailable).toBe(true);
  expect(result.usedSapLayout).toBe(false);
  expect(result.matrixColumns).toEqual(getSapStandardServiceMatrixColumns());
  expect(result.matrixColumns.some((field) => field.key.startsWith('sapLayout_'))).toBe(false);
  expect(result.rowUdfFields[0]).toMatchObject({
    key: 'U_CompanyA',
    visible: false,
    active: false,
  });
});

test('returns the safe service fallback and no UDFs for stale-company metadata', () => {
  const result = buildServiceDocumentLiveFields({
    schema,
    documentType: 'SERVICE_AP_INVOICE',
    headerTable: 'OPCH',
    lineTable: 'PCH1',
    companyId: 20,
    companyDb: 'COMPANY_B',
  });

  expect(result.liveAvailable).toBe(false);
  expect(result.rowUdfFields).toEqual([]);
  expect(result.matrixColumns).toEqual(getSapStandardServiceMatrixColumns());
  expect(result.matrixColumns.some((field) => field.key === 'itemNo')).toBe(false);
});
