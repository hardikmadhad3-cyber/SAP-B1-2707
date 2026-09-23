/**
 * Frontend-side display configuration for the 4 Job Work transactions.
 * This is a curated subset of backend/services/jobWorkSchema.js's fields —
 * the first-pass UI shows Main (header + address block), the primary material
 * line grid, Attachments, and Remarks; it does not surface every UDF the
 * legacy add-on captured (see the approved plan's documented scope cut).
 */

const dateField = (name, label) => ({ name, label, type: 'date' });
const textField = (name, label) => ({ name, label, type: 'text' });
// `optionsKey` selects which referenceData list (paymentTerms/salesEmployees) backs the dropdown.
const selectField = (name, label, optionsKey, valueKey, textKey) => ({ name, label, type: 'select', optionsKey, valueKey, textKey });
// Line-grid item/warehouse pickers, backed by referenceData.items / referenceData.warehouses.
const itemField = (name, label) => ({ name, label, type: 'select', optionsKey: 'items', valueKey: 'ItemCode', textKey: 'ItemCode', isItem: true });
const warehouseField = (name, label) => ({ name, label, type: 'select', optionsKey: 'warehouses', valueKey: 'WhsCode', textKey: 'WhsCode' });

const commonAddressBlockLabel = 'Address';

// Field-name maps for the Bill To / Ship From address block. The legacy schema
// does NOT use one consistent prefix scheme across Sales vs Purchase tables
// (e.g. Purchase's bill-to toggle is "ABILTO" + "APOBOX" for street, while
// Sales uses "BillTo" + "BStreet"), so each side gets its own explicit map
// rather than a generated prefix.
const SALES_ADDRESS_FIELDS = {
  billTo: {
    toggle: 'BillTo', addressId: 'BAdresID', street: 'BStreet', streetNo: 'BStretNo',
    building: 'BBuildg', block: 'BBlock', city: 'BCity', zip: 'BZCode',
    county: 'BCounty', country: 'BContry', state: 'BState', gstin: 'BGSTIN', gstType: 'BGSTType',
  },
  shipFrom: {
    toggle: 'ShipTo', addressId: 'SAdresID', street: 'SStreet', streetNo: 'SStretNo',
    building: 'SBuildg', block: 'SBlock', city: 'SCity', zip: 'SZCode',
    county: 'SCounty', country: 'SContry', state: 'SState', gstin: 'SGSTIN', gstType: 'SGSTType',
  },
};

const PURCHASE_ADDRESS_FIELDS = {
  billTo: {
    toggle: 'ABILTO', addressId: 'AADDID', street: 'APOBOX', streetNo: 'ASTRTNO',
    building: 'ABLDNO', block: 'ABLOCK', city: 'ACITY', zip: 'AZIPCOD',
    county: 'ACOUNTY', country: 'ACNTRY', state: 'ASTATE', gstin: 'AGSTIN', gstType: 'AGSTTYP',
  },
  shipFrom: {
    toggle: 'ASHPFRM', addressId: 'SADDID', street: 'SPOBOX', streetNo: 'SSTRTNO',
    building: 'SBLDNO', block: 'SBLOCK', city: 'SCITY', zip: 'SZIPCOD',
    county: 'SCOUNTY', country: 'SCNTRY', state: 'SSTATE', gstin: 'SGSTIN', gstType: 'SGSTTYP',
  },
};

export const JOB_WORK_TRANSACTIONS = {
  jobworkIssueNote: {
    apiKey: 'jobworkIssueNote',
    menuName: 'Jobwork Issue Note',
    partyType: 'vendor',
    partyLabel: 'Vendor',
    partyCodeField: 'VENCOD',
    partyNameField: 'VENNAME',
    paymentTermField: 'JWOPAYT',
    salesEmployeeField: 'SLSEMP',
    headerFields: [
      dateField('DOCDATE', 'Document Date'),
      dateField('PDATE', 'Posting Date'),
      dateField('DDATE', 'Delivery Date'),
      textField('BRNCH', 'Branch'),
      textField('OWOR', 'Own Work Order Ref'),
      selectField('JWOPAYT', 'Payment Term', 'paymentTerms', 'GroupNum', 'PymntGroup'),
      selectField('SLSEMP', 'Sales Employee', 'salesEmployees', 'SlpCode', 'SlpName'),
      textField('TranName', 'Transporter Name'),
      textField('VEHNO', 'Vehicle Number'),
      textField('ChallanNo', 'Challan No'),
      dateField('ChallanDt', 'Challan Date'),
      textField('NatureP', 'Nature Of Process'),
      textField('EWBILLNO', 'E-Way Bill No'),
      textField('KNTWEIGHT', 'Kata Weight'),
    ],
    addressBlockLabel: commonAddressBlockLabel,
    addressFields: PURCHASE_ADDRESS_FIELDS,
    lineTable: 'STTL_JWP6',
    // Item selection auto-fills Description/UoM and drives the batch-required check on save
    // (legacy JW_Pur.b1f.cs:1568/1574) — see itemField/itemDescriptionField/itemUomField below.
    itemField: 'MITMNO',
    itemDescriptionField: 'MDES',
    itemUomField: 'MUOM',
    lineFields: [
      itemField('MITMNO', 'Item Code'),
      textField('MDES', 'Description'),
      { name: 'MQTY', label: 'Quantity', type: 'number' },
      warehouseField('MWHS', 'From Warehouse'),
      warehouseField('TWHS', 'To Warehouse'),
      textField('MUOM', 'UoM'),
      textField('MBatch', 'Batch'),
      textField('MBinCode', 'Bin Code'),
      textField('ToBinCode', 'To Bin Code'),
      { name: 'Rate', label: 'Rate', type: 'number' },
      textField('Remarks', 'Remarks'),
    ],
    remarksField: 'REMARKS',
  },

  jobworkReceiptReturnNote: {
    apiKey: 'jobworkReceiptReturnNote',
    menuName: 'Jobwork Receipt / Return Note',
    partyType: 'vendor',
    partyLabel: 'Vendor',
    partyCodeField: 'VENCOD',
    partyNameField: 'VENNAME',
    paymentTermField: 'JWOPAYT',
    salesEmployeeField: 'SLSEMP',
    headerFields: [
      dateField('DOCDATE', 'Document Date'),
      dateField('PDATE', 'Posting Date'),
      dateField('DDATE', 'Delivery Date'),
      textField('BRNCH', 'Branch'),
      textField('OWOR', 'Own Work Order Ref'),
      textField('PONo', 'JW Ref No'),
      textField('JWTYP', 'JW Type'),
      selectField('JWOPAYT', 'Payment Term', 'paymentTerms', 'GroupNum', 'PymntGroup'),
      selectField('SLSEMP', 'Sales Employee', 'salesEmployees', 'SlpCode', 'SlpName'),
      textField('TranName', 'Transporter Name'),
      textField('VEHNO', 'Vehicle Number'),
      textField('ChallanNo', 'Challan No'),
      dateField('ChallanDt', 'Challan Date'),
      textField('NatureP', 'Nature Of Process'),
      textField('EWBILLNO', 'E-Way Bill No'),
      textField('VPONo', 'Vendor PO No'),
      dateField('VPODT', 'Vendor PO Date'),
    ],
    addressBlockLabel: commonAddressBlockLabel,
    addressFields: PURCHASE_ADDRESS_FIELDS,
    lineTable: 'STTL_JWPR6',
    lineFields: [
      textField('MITMNO', 'Item Code'),
      textField('MDES', 'Description'),
      { name: 'MQTY', label: 'Quantity', type: 'number' },
      textField('MWHS', 'Warehouse'),
      textField('MUOM', 'UoM'),
      textField('MBatch', 'Batch'),
      textField('MBinCode', 'Bin Code'),
      { name: 'Rate', label: 'Rate', type: 'number' },
      textField('Remarks', 'Remarks'),
    ],
    remarksField: 'REMARKS',
  },

  customerReceiptNote: {
    apiKey: 'customerReceiptNote',
    menuName: 'Customer Receipt Note',
    partyType: 'customer',
    partyLabel: 'Customer',
    partyCodeField: 'CCode',
    partyNameField: 'CName',
    headerFields: [
      dateField('DocDate', 'Document Date'),
      dateField('PDate', 'Posting Date'),
      dateField('DDate', 'Delivery Date'),
      textField('JWBranch', 'Branch'),
      textField('TranName', 'Transporter Name'),
      textField('VEHNO', 'Vehicle Number'),
      textField('ChallanNo', 'Challan No'),
      dateField('ChallanDt', 'Challan Date'),
      textField('NatureP', 'Nature Of Process'),
      textField('EWBILLNO', 'E-Way Bill No'),
      textField('KNTWEIGHT', 'Kata Weight'),
    ],
    addressBlockLabel: commonAddressBlockLabel,
    addressFields: SALES_ADDRESS_FIELDS,
    lineTable: 'STTL_JWS12',
    lineFields: [
      textField('ICode', 'Item Code'),
      textField('IName', 'Item Name'),
      { name: 'Qty', label: 'Quantity', type: 'number' },
      textField('WhsCode', 'Warehouse'),
      textField('UOM', 'UoM'),
      textField('Batch', 'Batch'),
      textField('BinCode', 'Bin Code'),
      { name: 'Price', label: 'Price', type: 'number' },
      textField('AccountCode', 'Account Code'),
      textField('Remarks', 'Remarks'),
    ],
    remarksField: 'Remarks',
  },

  customerIssueReturnNote: {
    apiKey: 'customerIssueReturnNote',
    menuName: 'Customer Issue / Return Note',
    partyType: 'customer',
    partyLabel: 'Customer',
    partyCodeField: 'CCode',
    partyNameField: 'CName',
    paymentTermField: 'PTerm',
    salesEmployeeField: 'SEmp',
    headerFields: [
      dateField('DocDate', 'Document Date'),
      dateField('PDate', 'Posting Date'),
      dateField('DDate', 'Delivery Date'),
      textField('JWBranch', 'Branch'),
      selectField('PTerm', 'Payment Term', 'paymentTerms', 'GroupNum', 'PymntGroup'),
      selectField('SEmp', 'Sales Employee', 'salesEmployees', 'SlpCode', 'SlpName'),
      textField('CPONo', 'Customer PO No'),
      dateField('CPODT', 'Customer PO Date'),
      textField('JWRtn', 'Return Type'),
      textField('TranName', 'Transporter Name'),
      textField('ChallanNo', 'Challan No'),
      dateField('ChallanDt', 'Challan Date'),
      textField('NatureP', 'Nature Of Process'),
    ],
    addressBlockLabel: commonAddressBlockLabel,
    addressFields: SALES_ADDRESS_FIELDS,
    lineTable: 'STTL_JWSR10',
    lineFields: [
      textField('ICode', 'Item Code'),
      textField('IName', 'Item Name'),
      { name: 'Qty', label: 'Quantity', type: 'number' },
      textField('WhsCode', 'Warehouse'),
      textField('UOM', 'UoM'),
      textField('Batch', 'Batch'),
      textField('BinCode', 'Bin Code'),
      { name: 'Rate', label: 'Rate', type: 'number' },
      textField('Remarks', 'Remarks'),
    ],
    remarksField: 'Remarks',
  },
};

export const getJobWorkTransaction = (key) => JOB_WORK_TRANSACTIONS[key];
