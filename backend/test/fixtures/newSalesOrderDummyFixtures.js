const companyASchema = {
  documentType: 'SALES_ORDER',
  objectType: '17',
  companyId: 1,
  companyDb: 'DUMMY_COMPANY_A',
  userCode: 'tester-a',
  schemaVersion: 'schema-a-v1',
  headerTable: 'ORDR',
  lineTable: 'RDR1',
  headerFields: [
    {
      id: 'ORDR.CardCode', stateKey: 'cardCode', sapField: 'CardCode', databaseField: 'CardCode',
      tableName: 'ORDR', label: 'Customer', type: 'text', renderer: 'lookup', storage: 'standard',
      visible: true, editable: true, required: true, lookup: { source: 'business-partners' }, maxLength: 15,
    },
    {
      id: 'ORDR.DocDate', stateKey: 'docDate', sapField: 'DocDate', databaseField: 'DocDate',
      tableName: 'ORDR', label: 'Posting Date', type: 'date', renderer: 'date', storage: 'standard',
      visible: true, editable: true, required: true,
    },
    {
      id: 'ORDR.Comments', stateKey: 'comments', sapField: 'Comments', databaseField: 'Comments',
      tableName: 'ORDR', label: 'Remarks', type: 'textarea', renderer: 'textarea', storage: 'standard',
      visible: true, editable: true, required: false, maxLength: 254,
    },
    {
      id: 'ORDR.DocNum', stateKey: 'docNum', sapField: 'DocNum', databaseField: 'DocNum',
      tableName: 'ORDR', label: 'Document Number', type: 'integer', renderer: 'integer', storage: 'display-only',
      visible: true, editable: false, required: false,
    },
  ],
  lineFields: [
    {
      id: 'RDR1.ItemCode', stateKey: 'itemNo', sapField: 'ItemCode', databaseField: 'ItemCode',
      tableName: 'RDR1', label: 'Item No.', type: 'text', renderer: 'item-lookup', storage: 'standard',
      visible: true, editable: true, required: true, lookup: { source: 'items' }, maxLength: 50,
    },
    {
      id: 'RDR1.Quantity', stateKey: 'quantity', sapField: 'Quantity', databaseField: 'Quantity',
      tableName: 'RDR1', label: 'Quantity', type: 'number', renderer: 'number', storage: 'standard',
      visible: true, editable: true, required: true, precision: 19, scale: 6, minimum: 0,
    },
    {
      id: 'RDR1.UnitPrice', stateKey: 'unitPrice', sapField: 'UnitPrice', databaseField: 'Price',
      tableName: 'RDR1', label: 'Unit Price', type: 'number', renderer: 'number', storage: 'standard',
      visible: true, editable: true, required: false, precision: 19, scale: 6,
    },
    {
      id: 'RDR1.U_PackingType', stateKey: 'U_PackingType', sapField: 'U_PackingType', databaseField: 'U_PackingType',
      tableName: 'RDR1', label: 'Packing Type', type: 'select', renderer: 'select', storage: 'udf',
      visible: true, editable: true, required: false,
      options: [{ value: 'BOX', label: 'Box' }, { value: 'BAG', label: 'Bag' }],
    },
    {
      id: 'RDR1.U_GrossWt', stateKey: 'U_GrossWt', sapField: 'U_GrossWt', databaseField: 'U_GrossWt',
      tableName: 'RDR1', label: 'Gross Weight', type: 'number', renderer: 'number', storage: 'udf',
      visible: true, editable: true, required: false, precision: 19, scale: 6,
    },
    {
      id: 'RDR1.U_TotalPackage', stateKey: 'U_TotalPackage', sapField: 'U_TotalPackage', databaseField: 'U_TotalPackage',
      tableName: 'RDR1', label: 'Total Package', type: 'integer', renderer: 'integer', storage: 'udf',
      visible: true, editable: true, required: false, precision: 10, scale: 0,
    },
    {
      id: 'RDR1.U_ContainerType', stateKey: 'U_ContainerType', sapField: 'U_ContainerType', databaseField: 'U_ContainerType',
      tableName: 'RDR1', label: 'Container Type', type: 'lookup', renderer: 'lookup', storage: 'udf',
      visible: true, editable: true, required: false, lookup: { source: 'udf-linked-table' },
    },
    {
      id: 'RDR1.U_NewLiveField', stateKey: 'U_NewLiveField', sapField: 'U_NewLiveField', databaseField: 'U_NewLiveField',
      tableName: 'RDR1', label: 'New Live Field', type: 'text', renderer: 'text', storage: 'udf',
      visible: true, editable: true, required: false, maxLength: 20,
    },
  ],
};

const companyBSchema = {
  ...companyASchema,
  companyId: 2,
  companyDb: 'DUMMY_COMPANY_B',
  userCode: 'tester-b',
  schemaVersion: 'schema-b-v1',
  lineFields: [
    ...companyASchema.lineFields.slice(0, 3),
    {
      id: 'RDR1.U_Quality', stateKey: 'U_Quality', sapField: 'U_Quality', databaseField: 'U_Quality',
      tableName: 'RDR1', label: 'Quality', type: 'lookup', renderer: 'lookup', storage: 'udf',
      visible: true, editable: true, required: false, lookup: { source: 'udf-linked-table' },
    },
    {
      id: 'RDR1.U_ExpectedDate', stateKey: 'U_ExpectedDate', sapField: 'U_ExpectedDate', databaseField: 'U_ExpectedDate',
      tableName: 'RDR1', label: 'Expected Date', type: 'date', renderer: 'date', storage: 'udf',
      visible: true, editable: true, required: false,
    },
    {
      id: 'RDR1.U_Approved', stateKey: 'U_Approved', sapField: 'U_Approved', databaseField: 'U_Approved',
      tableName: 'RDR1', label: 'Approved', type: 'checkbox', renderer: 'checkbox', storage: 'udf',
      visible: true, editable: true, required: false,
    },
  ],
};

const companyAFormData = {
  header: {
    values: {
      cardCode: ' C00001 ',
      docDate: '2026-08-03',
      comments: ' Dummy New Sales Order test ',
    },
    udf: {},
  },
  lines: [
    {
      localLineId: 'line-a-1',
      values: {
        itemNo: ' ITEM001 ',
        quantity: '5.25',
        unitPrice: '100',
      },
      udf: {
        U_PackingType: 'BOX',
        U_GrossWt: '50.500000',
        U_TotalPackage: '3',
        U_ContainerType: 'CONT-20',
        U_NewLiveField: 'automatic',
      },
      errors: {},
    },
  ],
};

const companyBFormData = {
  header: {
    values: { cardCode: 'C00002', docDate: '2026-08-04', comments: '' },
    udf: {},
  },
  lines: [
    {
      localLineId: 'line-b-1',
      values: { itemNo: 'ITEM002', quantity: '2', unitPrice: '' },
      udf: {
        U_Quality: 'Q-A',
        U_ExpectedDate: '2026-08-10T12:00:00Z',
        U_Approved: true,
      },
      errors: {},
    },
  ],
};

module.exports = {
  companyAFormData,
  companyASchema,
  companyBFormData,
  companyBSchema,
};
