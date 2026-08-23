import { getSapStandardSalesMatrixColumns } from '../modules/sales-order/documentLayout';
import {
  buildSalesDocumentLiveFields,
  filterLayoutToCurrentSchema,
  getSalesDocumentCompanyScopeKey,
  isSalesDocumentSchemaForCompany,
  loadSalesDocumentFieldLookupOptions,
  stripSalesDocumentTopLevelUdfs,
} from './salesDocumentLiveFields';

const quotationSchema = {
  companyId: 7,
  companyDb: 'SBODEMO',
  documentType: 'SALES_QUOTATION',
  objectType: '23',
  headerTable: 'OQUT',
  lineTable: 'QUT1',
  schemaVersion: 'qut1-v1',
  headerFields: [
    {
      id: 'OQUT.U_HeaderAgent',
      stateKey: 'U_HeaderAgent',
      sapField: 'U_HeaderAgent',
      storage: 'udf',
      label: 'Header Agent',
      lookup: { source: 'udf-linked-table', fieldId: 'OQUT.U_HeaderAgent' },
      linkedTable: '@AGENTS',
    },
  ],
  lineFields: [
    {
      id: 'QUT1.ItemCode',
      stateKey: 'itemNo',
      sapField: 'ItemCode',
      storage: 'standard',
      label: 'Item No.',
      order: 1,
    },
    {
      id: 'QUT1.U_Agent',
      stateKey: 'U_Agent',
      sapField: 'U_Agent',
      storage: 'udf',
      label: 'Agent',
      order: 2,
      lookup: { source: 'udf-linked-table', fieldId: 'QUT1.U_Agent' },
      linkedTable: '@AGENTS',
    },
  ],
};

test('company-scopes sales document schemas by id and database', () => {
  expect(isSalesDocumentSchemaForCompany(quotationSchema, { companyId: 7, companyDb: 'sbodemo' })).toBe(true);
  expect(isSalesDocumentSchemaForCompany(quotationSchema, { companyId: 8, companyDb: 'SBODEMO' })).toBe(false);
  expect(isSalesDocumentSchemaForCompany(quotationSchema, { companyId: 7, companyDb: 'OTHER' })).toBe(false);
});

test('uses a stable company scope key to gate document hydration until metadata is current', () => {
  const currentScope = getSalesDocumentCompanyScopeKey({ companyId: 7, companyDb: 'SBODEMO' });

  expect(currentScope).toBe('7::sbodemo');
  expect(getSalesDocumentCompanyScopeKey({ companyId: 7, companyDb: 'sbodemo' })).toBe(currentScope);
  expect(getSalesDocumentCompanyScopeKey({ companyId: 8, companyDb: 'SBODEMO' })).not.toBe(currentScope);
});

test('removes layout UDFs that are not confirmed by the current physical schema', () => {
  const filtered = filterLayoutToCurrentSchema([
    { fieldName: 'ItemCode', columnTitle: 'Item No.' },
    { fieldName: 'U_Agent', columnTitle: 'Agent', isUdf: true },
    { fieldName: 'U_OtherCompany', columnTitle: 'Old Field', isUdf: true },
  ], quotationSchema.lineFields);

  expect(filtered.map((column) => column.fieldName)).toEqual(['ItemCode', 'U_Agent']);
});

test('removes legacy top-level UDF copies while retaining the schema-backed udf bag', () => {
  expect(stripSalesDocumentTopLevelUdfs({
    itemNo: 'I001',
    U_OtherCompany: 'stale',
    udf: { U_Current: 'kept' },
  })).toEqual({
    itemNo: 'I001',
    udf: { U_Current: 'kept' },
  });
});

test('builds schema-only UDFs and reconciles them with the current SAP layout', () => {
  const result = buildSalesDocumentLiveFields({
    schema: quotationSchema,
    documentType: 'SALES_QUOTATION',
    objectType: '23',
    headerTable: 'OQUT',
    lineTable: 'QUT1',
    companyId: 7,
    companyDb: 'SBODEMO',
    referenceMatrixColumns: [{ key: 'itemNo', sapField: 'ItemCode', label: 'Item No.' }],
    layoutResponse: {
      data: {
        source: 'sap-form-settings',
        columns: [
          { fieldName: 'ItemCode', columnTitle: 'Item No.', visible: true, editable: true, columnOrder: 1 },
          { fieldName: 'U_Agent', columnTitle: 'Agent', visible: true, editable: true, columnOrder: 2, isUdf: true },
          { fieldName: 'U_OtherCompany', columnTitle: 'Old Field', visible: true, editable: true, columnOrder: 3, isUdf: true },
        ],
      },
    },
  });

  expect(result.liveAvailable).toBe(true);
  expect(result.headerUdfFields.map((field) => field.key)).toEqual(['U_HeaderAgent']);
  expect(result.rowUdfFields.map((field) => field.key)).toEqual(['U_Agent']);
  expect(result.rowUdfFields[0].lookupSource).toBe('udf:QUT1:U_Agent');
  expect(result.matrixColumns.map((column) => column.valueKey || column.key)).toContain('U_Agent');
  expect(result.matrixColumns.map((column) => column.valueKey || column.key)).not.toContain('U_OtherCompany');
});

test('uses only SAP standard fields when schema is unavailable or belongs to another company', () => {
  const expectedKeys = getSapStandardSalesMatrixColumns().map((column) => column.key);
  const unavailable = buildSalesDocumentLiveFields({
    schema: null,
    documentType: 'AR_INVOICE',
    objectType: '13',
    headerTable: 'OINV',
    lineTable: 'INV1',
    companyId: 7,
    companyDb: 'SBODEMO',
  });
  const wrongCompany = buildSalesDocumentLiveFields({
    schema: quotationSchema,
    documentType: 'SALES_QUOTATION',
    objectType: '23',
    headerTable: 'OQUT',
    lineTable: 'QUT1',
    companyId: 99,
    companyDb: 'OTHER',
    layoutResponse: {
      data: {
        source: 'sap-form-settings',
        columns: [{ fieldName: 'U_Agent', columnTitle: 'Agent', isUdf: true }],
      },
    },
  });

  expect(unavailable.matrixColumns.map((column) => column.key)).toEqual(expectedKeys);
  expect(unavailable.headerUdfFields).toEqual([]);
  expect(unavailable.rowUdfFields).toEqual([]);
  expect(wrongCompany.schemaMatchesCompany).toBe(false);
  expect(wrongCompany.matrixColumns.some((column) => String(column.key).startsWith('U_'))).toBe(false);
});

test('loads linked UDF values with the document type, schema version, and line item', async () => {
  const fetchLookup = jest.fn().mockResolvedValue({
    items: [{ value: 'A01', label: 'Agent 01', description: 'Primary' }],
  });

  const options = await loadSalesDocumentFieldLookupOptions({
    fetchLookup,
    source: 'udf:RIN1:U_Agent',
    field: {
      key: 'U_Agent',
      tableId: 'RIN1',
      schemaFieldId: 'RIN1.U_Agent',
      lookupTable: '@AGENTS',
      lookup: { source: 'udf-linked-table' },
    },
    line: { itemNo: 'I001' },
    documentType: 'AR_CREDIT_MEMO',
    schemaVersion: 'rin1-v2',
  });

  expect(fetchLookup).toHaveBeenCalledWith('udf-linked-table', expect.objectContaining({
    fieldId: 'RIN1.U_Agent',
    itemCode: 'I001',
    documentType: 'AR_CREDIT_MEMO',
    schemaVersion: 'rin1-v2',
  }));
  expect(options).toEqual([{ value: 'A01', label: 'Agent 01', description: 'Primary' }]);
});
