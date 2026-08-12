'use strict';

const context = Object.freeze({
  userId: 7,
  companyId: 202,
  roleId: 4,
  companyDb: 'NSO_COMPANY_B',
  companyName: 'Dummy Company B',
  userCode: 'manager_b',
  username: 'developer',
  dbDialect: 'hana',
});

const column = (columnName, databaseType, ordinal, overrides = {}) => ({
  columnName,
  databaseType,
  maxLength: null,
  precision: null,
  scale: null,
  nullable: true,
  ordinal,
  ...overrides,
});

const metadata = Object.freeze({
  dialect: 'hana',
  physical: {
    ORDR: [
      column('CardCode', 'nvarchar', 1, { maxLength: 15 }),
      column('CardName', 'nvarchar', 2, { maxLength: 100 }),
      column('DocDate', 'date', 3),
      column('DocDueDate', 'date', 4),
      column('TaxDate', 'date', 5),
      column('Comments', 'nvarchar', 6, { maxLength: 254 }),
    ],
    RDR1: [
      column('LineNum', 'integer', 1, { precision: 10, scale: 0, nullable: false }),
      column('ItemCode', 'nvarchar', 2, { maxLength: 50 }),
      column('Dscription', 'nvarchar', 3, { maxLength: 200 }),
      column('Quantity', 'decimal', 4, { precision: 19, scale: 6 }),
      column('Price', 'decimal', 5, { precision: 19, scale: 6 }),
      column('WhsCode', 'nvarchar', 6, { maxLength: 8 }),
      column('VatGroup', 'nvarchar', 7, { maxLength: 8 }),
      column('U_Quality', 'nvarchar', 8, { maxLength: 20 }),
      column('U_ExpectedDate', 'date', 9),
      column('U_Approved', 'nvarchar', 10, { maxLength: 1 }),
    ],
  },
  udfs: {
    ORDR: [],
    RDR1: [
      {
        tableName: 'RDR1',
        fieldId: 1,
        aliasId: 'Quality',
        sapField: 'U_Quality',
        label: 'Quality',
        typeId: 'A',
        subType: '',
        maxLength: 20,
        required: false,
        readOnly: false,
        linkedTable: '@NSO_QUALITY',
        relUDO: null,
        defaultValue: null,
        options: [],
      },
      {
        tableName: 'RDR1',
        fieldId: 2,
        aliasId: 'ExpectedDate',
        sapField: 'U_ExpectedDate',
        label: 'Expected Date',
        typeId: 'D',
        subType: '',
        maxLength: null,
        required: false,
        readOnly: false,
        linkedTable: null,
        relUDO: null,
        defaultValue: null,
        options: [],
      },
      {
        tableName: 'RDR1',
        fieldId: 3,
        aliasId: 'Approved',
        sapField: 'U_Approved',
        label: 'Approved',
        typeId: 'A',
        subType: '',
        maxLength: 1,
        required: false,
        readOnly: false,
        linkedTable: null,
        relUDO: null,
        defaultValue: 'N',
        options: [
          { value: 'Y', label: 'Yes' },
          { value: 'N', label: 'No' },
        ],
      },
    ],
  },
  layout: [
    { tableName: 'RDR1', columnUid: 'ItemCode', fieldName: 'ItemCode', columnTitle: 'Item No.', visible: 1, editable: 1, columnOrder: 1, width: 160 },
    { tableName: 'RDR1', columnUid: 'Quantity', fieldName: 'Quantity', columnTitle: 'Quantity', visible: 1, editable: 1, columnOrder: 2, width: 100 },
    { tableName: 'RDR1', columnUid: 'U_Quality', fieldName: 'U_Quality', columnTitle: 'Quality', visible: 1, editable: 1, columnOrder: 20, width: 140 },
    { tableName: 'RDR1', columnUid: 'U_ExpectedDate', fieldName: 'U_ExpectedDate', columnTitle: 'Expected Date', visible: 1, editable: 1, columnOrder: 21, width: 135 },
    { tableName: 'RDR1', columnUid: 'U_Approved', fieldName: 'U_Approved', columnTitle: 'Approved', visible: 1, editable: 1, columnOrder: 22, width: 100 },
  ],
});

module.exports = { context, metadata };
