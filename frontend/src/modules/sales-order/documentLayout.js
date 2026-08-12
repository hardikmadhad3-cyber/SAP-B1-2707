import { BASE_MATRIX_COLUMNS } from '../../config/salesOrderForm';

export const SALES_ORDER_LAYOUT_DOCUMENT_TYPE = 'SALES_ORDER';
export const SALES_QUOTATION_LAYOUT_DOCUMENT_TYPE = 'SALES_QUOTATION';
export const DELIVERY_LAYOUT_DOCUMENT_TYPE = 'DELIVERY';
export const AR_INVOICE_LAYOUT_DOCUMENT_TYPE = 'AR_INVOICE';
export const AR_CREDIT_MEMO_LAYOUT_DOCUMENT_TYPE = 'AR_CREDIT_MEMO';
export const SALES_ORDER_LINE_NUMBER_KEY = '__lineNumber';

const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');

const normalizeUdfKey = (value) => {
  let normalized = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '');
  if (!normalized) return '';
  if (!normalized.startsWith('U_')) {
    normalized = `U_${normalized.replace(/^_+/, '')}`;
  }
  return normalized;
};

const mapLayoutDataTypeToInputType = (dataType = '') => {
  const normalized = String(dataType || '').trim().toLowerCase();
  if (['number', 'numeric', 'decimal', 'float', 'int', 'integer'].includes(normalized)) return 'number';
  if (['date', 'datetime'].includes(normalized)) return 'date';
  if (['textarea', 'memo'].includes(normalized)) return 'textarea';
  if (['checkbox', 'boolean', 'bit', 'yesno', 'yes_no'].includes(normalized)) return 'checkbox';
  return 'text';
};

const SAP_FIELD_TO_INTERNAL_KEY = {
  LINENUM: SALES_ORDER_LINE_NUMBER_KEY,
  ITEMCODE: 'itemNo',
  DSCRIPTION: 'itemDescription',
  DESCRIPTION: 'itemDescription',
  QUANTITY: 'quantity',
  REQQTY: 'requiredQty',
  REQDATE: 'requiredDate',
  SHIPDATE: 'lineDeliveryDate',
  DELDATE: 'lineDeliveryDate',
  DELIVERYDATE: 'lineDeliveryDate',
  UOMNAME: 'uomName',
  UNITMSR: 'uomName',
  UOMCODE: 'uomCode',
  HSN: 'hsnCode',
  HSNCODE: 'hsnCode',
  HSNENTRY: 'hsnCode',
  PRICE: 'unitPrice',
  PRICEBEFDI: 'unitPrice',
  UNITPRICE: 'unitPrice',
  U_PRICE: 'price',
  U_TAXCODE: 'taxCodeRepeat',
  U_UNITPRICE: 'unitPriceUdf',
  U_UNIT_PRICE: 'unitPriceUdf',
  RATE: 'forRate',
  FORRATE: 'forRate',
  FORPRICE: 'forRate',
  FOR_PRICE: 'forRate',
  VATGROUP: 'taxCode',
  TAXCODE: 'taxCode',
  SHIPTYPE: 'lineShippingType',
  SHIPMETHOD: 'lineShippingType',
  SHIPPINGMETHOD: 'lineShippingType',
  SHIPPINGTYPE: 'lineShippingType',
  TRNSCODE: 'lineShippingType',
  TRANSPORTATIONCODE: 'lineShippingType',
  WTLIABLE: 'wTaxLiable',
  TAXONLY: 'taxLiable',
  LINETOTAL: 'totalLC',
  GTOTAL: 'grossTotal',
  GROSSTOTAL: 'grossTotal',
  TOTAL: 'totalLC',
  PACKQTY: 'noOfPackages',
  NUMOFPACKS: 'noOfPackages',
  VATSUM: 'taxAmount',
  TAXAMOUNT: 'taxAmount',
  TAXAMOUNTLC: 'taxAmount',
  'TAXAMOUNT(LC)': 'taxAmount',
  'TAX AMOUNT(LC)': 'taxAmount',
  'TAX AMOUNT LC': 'taxAmount',
  TAXAMOUNT_LC: 'taxAmount',
  TAXAMOUNTLC_: 'taxAmount',
  TAXAMOUNT_LC_: 'taxAmount',
  TAXAMOUNTLC__:'taxAmount',
  BINALLOC: 'binLocationAllocation',
  BINALLOCATION: 'binLocationAllocation',
  BINLOCATIONALLOCATION: 'binLocationAllocation',
  COMMPERCENT: 'commPercent',
  COMMPRCNT: 'commPercent',
  COMMISSIONPERCENT: 'commPercent',
  ASSESSABLEVALUE: 'assessableValue',
  ASSESSABLEVALUEINR: 'assessableValue',
  PRICEAFTERDISCOUNT: 'priceAfterDiscount',
  PRICEAFTERDISC: 'priceAfterDiscount',
  ITEMCOST: 'itemCost',
  ACCTCODE: 'glAccount',
  ACCTNAME: 'glAccountName',
  ACCOUNTNAME: 'glAccountName',
  DISCPRCNT: 'stdDiscount',
  DISCOUNTPERCENT: 'stdDiscount',
  WAREHOUSECODE: 'whse',
  DELIVRDQTY: 'deliveredQty',
  WHSCODE: 'whse',
  OCRCODE: 'distRule',
  COSTINGCODE: 'distRule',
  OCRCODE2: 'distRule2',
  COSTINGCODE2: 'distRule2',
  OCRCODE3: 'distRule3',
  COSTINGCODE3: 'distRule3',
  OCRCODE4: 'distRule4',
  COSTINGCODE4: 'distRule4',
  OCRCODE5: 'distRule5',
  COSTINGCODE5: 'distRule5',
  COGSOCRCOD: 'cogsDistRule',
  WEIGHT1: 'weight',
  WEIGHT: 'weight',
  OPENQTY: 'openQty',
  COUNTRYORG: 'countryOfOrigin',
  FREETXT: 'freeText',
  FREETEXT: 'freeText',
  SACCODE: 'sacCode',
  SACENTRY: 'sacCode',
  WITHOUTQTYPOSTING: 'withoutQtyPosting',
  WITHOUTINVENTORYMOVEMENT: 'withoutQtyPosting',
  ENSETCOST: 'enableSettingCost',
  RETCOST: 'returnCost',
  AGRNO: 'blanketAgreementNo',
  AGRLINENUM: 'blanketAgreementNo',
  INVQTY: 'qtyInventoryUom',
  NUMPERMSR: 'changeQtyInvUomIndependently',
  UOMENTRY: 'uomGroup',
  LOCCODE: 'loc',
  BPLID: 'branch',
  U_SPLRBT: 'specialRebate',
  U_COMPRC: 'commission',
  U_S_BROKPERQTY: 'sellerBrokeragePerQty',
  U_BROK_SELLER: 'sellerBrokerage',
  U_BROK_BUYER: 'buyerBrokerage',
  U_BUYER_DELIVERY: 'buyerDelivery',
  U_SELLER_DELIVERY: 'sellerDelivery',
  U_BUYER_PAYMENT_TERMS: 'buyerPaymentTerms',
  U_SELLER_PAYMENT_TERM: 'sellerPaymentTerms',
  U_SELLER_PAYMENT_TERMS: 'sellerPaymentTerms',
  U_BUYER_QUALITY: 'buyerQuality',
  U_SELLER_QUALITY: 'sellerQuality',
  U_BUYER_PRICE: 'buyerPrice',
  U_SELLER_PRICE: 'sellerPrice',
  U_BUYER_SPINS: 'buyerSpecialInstruction',
  U_SELLER_SPINS: 'sellerSpecialInstruction',
  U_SEL_BROK_AP: 'sellerBrokerageAmtPer',
  U_SELLER_BROK_PER: 'sellerBrokeragePercent',
  U_BUYER_BILL_DISC: 'buyerBillDiscount',
  U_SELLER_BILL_DISC: 'sellerBillDiscount',
  U_SELLTCODE: 'stcode',
  U_STCODE: 'stcode',
  U_S_ITEM: 'sellerItem',
  U_SITEM: 'sellerItem',
  U_S_QTY: 'sellerQty',
  U_FREIGHT_PUR: 'freightPurchase',
  U_FREIGHT_SALES: 'freightSales',
  U_FR_TRANS: 'freightProvider',
  U_FR_TRANS_NAME: 'freightProviderName',
  U_BDNUM: 'brokerageNumber',
  U_DOCKEY: 'documentCreated',
  U_PACKINGTYPE: 'U_PackingType',
  U_PACKING_TYPE: 'U_PackingType',
  U_GROSSWT: 'U_GrossWt',
  U_GROSS_WT: 'U_GrossWt',
  U_TOTALPACKAGE: 'U_TotalPackage',
  U_TOTAL_PACKAGE: 'U_TotalPackage',
  U_CONTAINERTYPE: 'U_ContainerType',
  U_CONTAINER_TYPE: 'U_ContainerType',
  U_FORRATE: 'U_ForRate',
  U_FOR_RATE: 'U_ForRate',
  U_FOR_RATE_: 'U_ForRate',
  U_FORPRICE: 'U_ForRate',
  U_FOR_PRICE: 'U_ForRate',
  U_FIXBROKBUYER: 'U_Fix_Brock_B',
  U_FIX_BROK_BUYER: 'U_Fix_Brock_B',
  U_FIXBROCKSELLER: 'U_Fix_Brock_S',
  U_FIXBROKSELLER: 'U_Fix_Brock_S',
  U_FIX_BROCK_SELLER: 'U_Fix_Brock_S',
  U_FIX_BROK_SELLER: 'U_Fix_Brock_S',
  U_COSTSHEET: 'U_Cost_Sheet',
  U_COST_SHEET: 'U_Cost_Sheet',
};

const LABEL_TO_INTERNAL_KEY = {
  '#': SALES_ORDER_LINE_NUMBER_KEY,
  ITEMNO: 'itemNo',
  ITEMDESCRIPTION: 'itemDescription',
  DESCRIPTION: 'itemDescription',
  QUANTITY: 'quantity',
  UOMNAME: 'uomName',
  UOMCODE: 'uomCode',
  HSN: 'hsnCode',
  SAC: 'sacCode',
  UNITPRICE: 'unitPrice',
  FORPRICE: 'forRate',
  TAXCODE: 'taxCode',
  TOTALDOC: 'grossTotal',
  TOTALDOCUMENT: 'grossTotal',
  GROSSTOTAL: 'grossTotal',
  TOTAL: 'totalLC',
  GROSSWT: 'U_GrossWt',
  PACKINGTYPE: 'U_PackingType',
  PACKING: 'U_PackingType',
  TOTALPACKAGE: 'U_TotalPackage',
  TOTALPACKAGES: 'U_TotalPackage',
  DISCOUNT: 'stdDiscount',
  DISC: 'stdDiscount',
  PRICE: 'price',
  PRICEAFTERDISCOUNT: 'priceAfterDiscount',
  PRICEAFTERDISC: 'priceAfterDiscount',
  ITEMCOST: 'itemCost',
  QTY: 'quantity',
  REQUIREDQTY: 'requiredQty',
  REQUIREDDATE: 'requiredDate',
  QUOTEDDATE: 'quotedDate',
  DELDATE: 'lineDeliveryDate',
  DELIVERYDATE: 'lineDeliveryDate',
  DELIVEREDQTY: 'deliveredQty',
  QTYTOSHIP: 'deliveredQty',
  ORDEREDQTY: 'openQty',
  WHSE: 'whse',
  DISTRRULE: 'distRule',
  DISTRIBUTIONRULE: 'distRule',
  GLACCOUNT: 'glAccount',
  GLACCOUNTNAME: 'glAccountName',
  WTAXLIABLE: 'wTaxLiable',
  TAXLIABLE: 'taxLiable',
  SHIPPINGTYPE: 'lineShippingType',
  SHIPTYPE: 'lineShippingType',
  BINLOCATIONALLOCATION: 'binLocationAllocation',
  WEIGHT: 'weight',
  NOOFPACKAGES: 'noOfPackages',
  BLANKETAGREEMENTNO: 'blanketAgreementNo',
  WITHOUTQTYPOSTING: 'withoutQtyPosting',
  WITHOUTINVENTORYMOVEMENT: 'withoutQtyPosting',
  ENABLESETTINGCOST: 'enableSettingCost',
  RETURNCOSTLC: 'returnCost',
  QTYINVENTORYUOM: 'qtyInventoryUom',
  CHANGEQTYINVUOMINDEPENDENTLY: 'changeQtyInvUomIndependently',
  UOMGROUP: 'uomGroup',
  COGSDISTRULE: 'cogsDistRule',
  COUNTRYREGIONOFORIGIN: 'countryOfOrigin',
  ASSESSABLEVALUE: 'assessableValue',
  ASSESSABLEVALUEINR: 'assessableValue',
  LOC: 'loc',
  COSTSHEET: 'U_Cost_Sheet',
  CONTAINERTYPE: 'U_ContainerType',
  COMMPERCENT: 'commPercent',
  COMM: 'commPercent',
  FORRATE: 'U_ForRate',
  SELLERBROKERAGE: 'sellerBrokerage',
  BUYERBROKERAGE: 'buyerBrokerage',
  BUYERDELIVERY: 'buyerDelivery',
  SELLERDELIVERY: 'sellerDelivery',
  BUYERTERMSOFPAYMENT: 'buyerPaymentTerms',
  SELLERTERMSOFPAYMENT: 'sellerPaymentTerms',
  BUYERQUALITY: 'buyerQuality',
  SELLERQUALITY: 'sellerQuality',
  BUYERPRICE: 'buyerPrice',
  SELLERPRICE: 'sellerPrice',
  SITEM: 'sellerItem',
  SQTY: 'sellerQty',
  BROKPERQTY: 'sellerBrokeragePerQty',
  BUYERSPECIALINSTRUCTION: 'buyerSpecialInstruction',
  SELLERSPECIALINSTRUCTION: 'sellerSpecialInstruction',
  SELLERBROKERAGEAMTPER: 'sellerBrokerageAmtPer',
  SELLERBROKERAGEINPERCENTAGE: 'sellerBrokeragePercent',
  STCODE: 'stcode',
  FIXBROKBUYER: 'U_Fix_Brock_B',
  FIXBROCKSELLER: 'U_Fix_Brock_S',
  FIXBROKSELLER: 'U_Fix_Brock_S',
};

// Map common label variants for Tax Amount to internal `taxAmount` key
LABEL_TO_INTERNAL_KEY.TAXAMOUNT = 'taxAmount';
LABEL_TO_INTERNAL_KEY.TAXAMOUNTLC = 'taxAmount';
LABEL_TO_INTERNAL_KEY.TAXAMOUNTDOC = 'taxAmount';
LABEL_TO_INTERNAL_KEY.TAXAMOUNTDOCUMENT = 'taxAmount';
LABEL_TO_INTERNAL_KEY.TAXAMOUNT_LC = 'taxAmount';
LABEL_TO_INTERNAL_KEY['TAXAMOUNT(LC)'] = 'taxAmount';
LABEL_TO_INTERNAL_KEY['TAX AMOUNT(LC)'] = 'taxAmount';
LABEL_TO_INTERNAL_KEY['TAX AMOUNT LC'] = 'taxAmount';

// Ensure 'TAX CODE' label variants map exactly to `taxCode`
LABEL_TO_INTERNAL_KEY.TAXCODE = 'taxCode';
LABEL_TO_INTERNAL_KEY['TAX CODE'] = 'taxCode';

const STANDARD_RENDERER_KEYS = new Set([
  SALES_ORDER_LINE_NUMBER_KEY,
  'itemNo',
  'itemDescription',
  'quantity',
  'requiredQty',
  'requiredDate',
  'quotedDate',
  'lineDeliveryDate',
  'uomName',
  'uomCode',
  'hsnCode',
  'unitPrice',
  'unitPriceUdf',
  'forRate',
  'taxCode',
  'taxCodeRepeat',
  'wTaxLiable',
  'taxLiable',
  'lineShippingType',
  'totalLC',
  'grossTotal',
  'price',
  'commPercent',
  'assessableValue',
  'priceAfterDiscount',
  'itemCost',
  'binLocationAllocation',
  'noOfPackages',
  'taxAmount',
  'glAccount',
  'glAccountName',
  'stdDiscount',
  'deliveredQty',
  'whse',
  'distRule',
  'distRule2',
  'distRule3',
  'distRule4',
  'distRule5',
  'cogsDistRule',
  'weight',
  'openQty',
  'countryOfOrigin',
  'freeText',
  'sacCode',
  'enableSettingCost',
  'withoutQtyPosting',
  'returnCost',
  'blanketAgreementNo',
  'qtyInventoryUom',
  'changeQtyInvUomIndependently',
  'uomGroup',
  'loc',
  'branch',
  'specialRebate',
  'commission',
  'sellerBrokeragePerQty',
  'sellerItem',
  'sellerQty',
  'sellerBrokerage',
  'buyerBrokerage',
  'buyerDelivery',
  'sellerDelivery',
  'buyerPaymentTerms',
  'sellerPaymentTerms',
  'buyerQuality',
  'sellerQuality',
  'buyerPrice',
  'sellerPrice',
  'buyerSpecialInstruction',
  'sellerSpecialInstruction',
  'sellerBrokerageAmtPer',
  'sellerBrokeragePercent',
  'stcode',
  'U_Cost_Sheet',
  'U_PackingType',
  'U_ContainerType',
  'U_GrossWt',
  'U_TotalPackage',
  'U_Fix_Brock_B',
  'U_Fix_Brock_S',
]);

const STANDARD_FIELD_OVERRIDES = {
  itemNo: { type: 'text', minWidth: 150 },
  itemDescription: { type: 'text', minWidth: 220 },
  quantity: { type: 'number', minWidth: 100, numeric: true },
  requiredQty: { type: 'number', minWidth: 110, numeric: true },
  lineDeliveryDate: { type: 'date', minWidth: 125 },
  uomName: { type: 'text', minWidth: 120, readOnly: true },
  uomCode: { type: 'text', minWidth: 105 },
  hsnCode: { type: 'text', minWidth: 105 },
  sacCode: { type: 'text', minWidth: 105 },
  unitPrice: { type: 'number', minWidth: 110, numeric: true },
  unitPriceUdf: { type: 'number', minWidth: 110, numeric: true },
  forRate: { type: 'number', minWidth: 110, numeric: true },
  taxCode: { type: 'text', minWidth: 115 },
  lineShippingType: { type: 'text', minWidth: 125 },
  taxCodeRepeat: { type: 'text', minWidth: 110, readOnly: true },
  taxLiable: { type: 'checkbox', minWidth: 95 },
  totalLC: { type: 'number', minWidth: 115, readOnly: true, numeric: true },
  grossTotal: { type: 'number', minWidth: 120, readOnly: true, numeric: true },
  price: { type: 'number', minWidth: 95, readOnly: true, numeric: true },
  priceAfterDiscount: { type: 'number', minWidth: 130, readOnly: true, numeric: true },
  glAccountName: { type: 'text', minWidth: 190, readOnly: true },
  itemCost: { type: 'number', minWidth: 110, readOnly: true, numeric: true },
  binLocationAllocation: { type: 'text', minWidth: 160, readOnly: true },
  stdDiscount: { type: 'number', minWidth: 95, numeric: true },
  deliveredQty: { type: 'number', minWidth: 120, readOnly: true, numeric: true },
  whse: { type: 'text', minWidth: 120 },
  distRule: { type: 'text', minWidth: 115 },
  distRule2: { type: 'text', minWidth: 115 },
  distRule3: { type: 'text', minWidth: 115 },
  distRule4: { type: 'text', minWidth: 115 },
  distRule5: { type: 'text', minWidth: 115 },
  cogsDistRule: { type: 'text', minWidth: 130, readOnly: true },
  openQty: { type: 'number', minWidth: 110, readOnly: true, numeric: true },
  blanketAgreementNo: { type: 'text', minWidth: 150 },
  withoutQtyPosting: { type: 'yesNo', minWidth: 145 },
  enableSettingCost: { type: 'checkbox', minWidth: 140 },
  returnCost: { type: 'number', minWidth: 125, numeric: true },
  commPercent: { type: 'number', minWidth: 95, numeric: true },
  assessableValue: { type: 'number', minWidth: 150, numeric: true },
  U_GrossWt: { type: 'number', minWidth: 110, numeric: true },
  U_TotalPackage: { type: 'number', minWidth: 130, numeric: true },
  U_Fix_Brock_B: { type: 'number', minWidth: 135, numeric: true },
  U_Fix_Brock_S: { type: 'number', minWidth: 140, numeric: true },
  documentCreated: { type: 'date', minWidth: 140, readOnly: true },
};

export const SALES_ORDER_WRITABLE_STANDARD_LINE_FIELDS = Object.freeze({
  itemNo: Object.freeze({ serviceLayerField: 'ItemCode', payloadKey: 'itemNo' }),
  itemDescription: Object.freeze({ serviceLayerField: 'ItemDescription', payloadKey: 'itemDescription' }),
  quantity: Object.freeze({ serviceLayerField: 'Quantity', payloadKey: 'quantity' }),
  unitPrice: Object.freeze({ serviceLayerField: 'UnitPrice', payloadKey: 'unitPrice' }),
  uomCode: Object.freeze({ serviceLayerField: 'UoMEntry', payloadKey: 'uomCode', resolved: true }),
  stdDiscount: Object.freeze({ serviceLayerField: 'DiscountPercent', payloadKey: 'stdDiscount' }),
  taxCode: Object.freeze({ serviceLayerField: 'TaxCode', payloadKey: 'taxCode' }),
  lineShippingType: Object.freeze({ serviceLayerField: 'ShippingMethod', payloadKey: 'lineShippingType' }),
  lineDeliveryDate: Object.freeze({ serviceLayerField: 'ShipDate', payloadKey: 'lineDeliveryDate' }),
  taxLiable: Object.freeze({ serviceLayerField: 'TaxOnly', payloadKey: 'taxLiable' }),
  whse: Object.freeze({ serviceLayerField: 'WarehouseCode', payloadKey: 'whse' }),
  distRule: Object.freeze({ serviceLayerField: 'CostingCode', payloadKey: 'distRule' }),
  distRule2: Object.freeze({ serviceLayerField: 'CostingCode2', payloadKey: 'distRule2' }),
  distRule3: Object.freeze({ serviceLayerField: 'CostingCode3', payloadKey: 'distRule3' }),
  distRule4: Object.freeze({ serviceLayerField: 'CostingCode4', payloadKey: 'distRule4' }),
  distRule5: Object.freeze({ serviceLayerField: 'CostingCode5', payloadKey: 'distRule5' }),
  countryOfOrigin: Object.freeze({ serviceLayerField: 'CountryOrg', payloadKey: 'countryOfOrigin' }),
  hsnCode: Object.freeze({ serviceLayerField: 'HSNEntry', payloadKey: 'hsnCode', resolved: true }),
  sacCode: Object.freeze({ serviceLayerField: 'SACEntry', payloadKey: 'sacCode', resolved: true }),
  freeText: Object.freeze({ serviceLayerField: 'FreeText', payloadKey: 'freeText' }),
});

export const getSalesOrderWritableStandardLineField = (key) => (
  SALES_ORDER_WRITABLE_STANDARD_LINE_FIELDS[String(key || '').trim()] || null
);

export const isSalesOrderWritableStandardLineKey = (key) => (
  Boolean(getSalesOrderWritableStandardLineField(key))
);

const buildLiveFieldMap = (fields = []) => {
  const map = new Map();

  (fields || []).forEach((field) => {
    if (!field?.key) return;
    [
      field.key,
      field.sapField,
      field.fieldName,
      field.label,
    ]
      .map(normalizeToken)
      .filter(Boolean)
      .forEach((token) => {
        if (!map.has(token)) {
          map.set(token, field);
        }
      });
  });

  return map;
};

const buildRowUdfMap = (fields = []) => {
  const map = new Map();

  (fields || []).forEach((field) => {
    if (!field?.key) return;
    [
      field.key,
      field.sapField,
      field.aliasId,
      field.label,
    ]
      .map((value) => (String(value || '').startsWith('U_') ? normalizeUdfKey(value) : normalizeToken(value)))
      .filter(Boolean)
      .forEach((token) => {
        if (!map.has(token)) {
          map.set(token, field);
        }
      });
  });

  return map;
};

const findInternalKey = (layoutColumn, liveFieldMap) => {
  const fieldToken = normalizeToken(layoutColumn.fieldName || layoutColumn.columnUid);
  const labelToken = normalizeToken(layoutColumn.columnTitle);
  const rawTitle = String(layoutColumn.columnTitle || '').trim();
  const rawFieldName = String(layoutColumn.fieldName || layoutColumn.columnUid || '').trim();
  const rawFieldNameUpper = rawFieldName.toUpperCase();

  if (labelToken === 'TAXCODE' && rawTitle && !/\s/.test(rawTitle)) {
    return 'taxCodeRepeat';
  }

  if (labelToken === 'PRICE' && rawTitle.toUpperCase() === 'PRICE' && rawFieldNameUpper.startsWith('U_')) {
    return 'price';
  }

  if (rawFieldNameUpper.startsWith('U_') && normalizeUdfKey(rawFieldName) === 'U_TAXCODE') {
    return 'taxCodeRepeat';
  }

  if (rawFieldNameUpper.startsWith('U_') && normalizeUdfKey(rawFieldName) === 'U_PRICE') {
    return 'price';
  }

  if (['U_FORRATE', 'U_FOR_RATE', 'U_FORPRICE', 'U_FOR_PRICE'].includes(normalizeUdfKey(rawFieldName))) {
    return 'forRate';
  }

  const labelMappedKey = LABEL_TO_INTERNAL_KEY[labelToken];
  if (labelMappedKey && [
    'DISTRRULE',
    'DISTRIBUTIONRULE',
    'PACKINGTYPE',
    'PACKING',
    'TAXCODE',
  ].includes(labelToken)) {
    return labelMappedKey;
  }

  return (
    SAP_FIELD_TO_INTERNAL_KEY[fieldToken]
    || labelMappedKey
    || liveFieldMap.get(fieldToken)?.key
    || liveFieldMap.get(labelToken)?.key
    || ''
  );
};

const buildSyntheticColumn = (layoutColumn, key, extras = {}) => {
  const readOnly = extras.readOnly ?? (layoutColumn.editable === false);
  return {
    key,
    valueKey: extras.valueKey || key,
    rendererKey: extras.rendererKey || key,
    fieldName: layoutColumn.fieldName || layoutColumn.columnUid || key,
    layoutFieldName: layoutColumn.fieldName || layoutColumn.columnUid || key,
    label: layoutColumn.columnTitle || extras.label || key,
    visible: layoutColumn.visible !== false,
    active: extras.active ?? (layoutColumn.editable !== false && !readOnly),
    readOnly,
    minWidth: Number(layoutColumn.width) || extras.minWidth || 125,
    width: Number(layoutColumn.width) || extras.minWidth || 125,
    order: Number(layoutColumn.columnOrder) || extras.order || 0,
    columnOrder: Number(layoutColumn.columnOrder) || extras.order || 0,
    sapControlled: layoutColumn.source !== 'fallback',
    importedLayout: true,
    source: extras.source || layoutColumn.source || 'imported-layout',
    type: extras.type || mapLayoutDataTypeToInputType(layoutColumn.dataType),
    numeric: extras.numeric || false,
    isUdf: extras.isUdf || false,
    lookupSource: extras.lookupSource,
    lookupTable: extras.lookupTable,
    lookup: extras.lookup,
    options: extras.options,
    field: extras.field,
    id: extras.id,
    schemaFieldId: extras.schemaFieldId,
    fieldId: extras.fieldId,
    schemaDriven: Boolean(extras.schemaDriven),
    serviceLayerField: extras.serviceLayerField,
    payloadKey: extras.payloadKey,
    writableStandardField: Boolean(extras.writableStandardField),
  };
};

const buildStandardLayoutColumn = (layoutColumn, liveField, internalKey, index) => {
  const standardOverride = STANDARD_FIELD_OVERRIDES[internalKey] || {};
  const writableMapping = getSalesOrderWritableStandardLineField(internalKey);
  const readOnly = standardOverride.readOnly ?? (
    !writableMapping || liveField?.readOnly || layoutColumn.editable === false
  );
  return {
    ...(liveField || {}),
    ...standardOverride,
    key: internalKey,
    valueKey: internalKey,
    rendererKey: internalKey,
    fieldName: layoutColumn.fieldName || layoutColumn.columnUid || liveField?.fieldName || internalKey,
    layoutFieldName: layoutColumn.fieldName || layoutColumn.columnUid || liveField?.fieldName || internalKey,
    label: layoutColumn.columnTitle || liveField?.label || internalKey,
    visible: layoutColumn.visible !== false,
    active: layoutColumn.editable !== false && !readOnly,
    readOnly,
    minWidth: Number(layoutColumn.width) || standardOverride.minWidth || liveField?.minWidth || 125,
    width: Number(layoutColumn.width) || standardOverride.minWidth || liveField?.minWidth || 125,
    order: Number(layoutColumn.columnOrder) || index + 1,
    columnOrder: Number(layoutColumn.columnOrder) || index + 1,
    sapControlled: layoutColumn.source !== 'fallback' && liveField?.sapControlled !== false,
    importedLayout: true,
    source: layoutColumn.source || 'imported-layout',
    isUdf: false,
    serviceLayerField: writableMapping?.serviceLayerField,
    payloadKey: writableMapping?.payloadKey,
    writableStandardField: Boolean(writableMapping),
  };
};

const buildGenericUdfField = (layoutColumn, fieldName) => ({
  key: fieldName,
  sapField: fieldName,
  label: layoutColumn.columnTitle || fieldName,
  type: mapLayoutDataTypeToInputType(layoutColumn.dataType),
  options: [],
  readOnly: layoutColumn.editable === false,
  active: layoutColumn.editable !== false,
});

const isSchemaUdfField = (field = {}) => {
  const storage = String(field.storage || '').trim().toLowerCase();
  const sapField = String(field.sapField || field.databaseField || field.stateKey || '').trim();
  return storage === 'udf' || sapField.toUpperCase().startsWith('U_');
};

const preserveSchemaUdfKey = (value) => {
  const normalized = String(value || '').trim().replace(/[^A-Za-z0-9_]+/g, '');
  if (!normalized) return '';
  return normalized.toUpperCase().startsWith('U_') ? normalized : `U_${normalized.replace(/^_+/, '')}`;
};

const normalizeSchemaFieldKey = (field = {}) => {
  const sapField = String(field.sapField || field.databaseField || field.stateKey || '').trim();
  return isSchemaUdfField(field)
    ? preserveSchemaUdfKey(sapField || field.stateKey || field.id)
    : String(field.stateKey || sapField || field.id || '').trim();
};

const getSchemaFieldInputType = (field = {}) => {
  const normalizedType = String(field.type || field.renderer || '').trim().toLowerCase();
  if (['number', 'integer'].includes(normalizedType)) return 'number';
  if (normalizedType === 'date') return 'date';
  if (['checkbox', 'boolean', 'yesno', 'yes_no'].includes(normalizedType)) return 'checkbox';
  if (normalizedType === 'textarea') return 'textarea';
  if (normalizedType === 'select') return 'select';
  return 'text';
};

const getSchemaSalesOrderLookupSource = (field = {}, lineTable = 'RDR1') => {
  const rawSource = String(field.lookup?.source || field.lookupSource || '').trim().toLowerCase();
  const sapField = preserveSchemaUdfKey(field.sapField || field.databaseField || field.stateKey);
  if (!isSchemaUdfField(field) || !sapField) return field.lookupSource || undefined;
  if (rawSource === 'udf-linked-table' || rawSource === 'udo' || field.linkedTable || field.lookupTable || field.relUDO) {
    return `udf:${lineTable}:${sapField}`;
  }
  return field.lookupSource || undefined;
};

export const buildSalesOrderRowUdfDefinitionsFromSchema = (schemaLineFields = [], { lineTable = 'RDR1' } = {}) => (
  (schemaLineFields || [])
    .filter(isSchemaUdfField)
    .map((field, index) => {
      const key = normalizeSchemaFieldKey(field);
      if (!key) return null;

      return {
        key,
        sapField: key,
        label: field.label || field.description || key,
        type: getSchemaFieldInputType(field),
        defaultValue: field.defaultValue ?? '',
        required: Boolean(field.required),
        readOnly: Boolean(field.readOnly || field.editable === false),
        visible: field.visible !== false,
        active: field.editable !== false && !field.readOnly,
        maxLength: field.maxLength || field.length || undefined,
        precision: field.precision ?? undefined,
        scale: field.scale ?? undefined,
        options: Array.isArray(field.options) ? field.options : [],
        lookupSource: getSchemaSalesOrderLookupSource(field, lineTable),
        lookupTable: field.linkedTable || field.lookupTable || undefined,
        tableId: lineTable,
        fieldId: field.fieldId,
        aliasId: key.replace(/^U_/, ''),
        order: Number(field.order) || 1000 + index,
        minWidth: Number(field.width) || (field.type === 'textarea' ? 180 : 125),
        sapControlled: true,
        schemaFieldId: field.id,
      };
    })
    .filter(Boolean)
);

export const buildSalesOrderMatrixColumnsFromSchema = ({
  schemaLineFields = [],
  liveMatrixColumns = [],
  rowUdfFields = [],
} = {}) => {
  if (!Array.isArray(schemaLineFields) || !schemaLineFields.length) return [];

  const liveFieldMap = buildLiveFieldMap(liveMatrixColumns);
  const rowUdfMap = buildRowUdfMap(rowUdfFields);

  return withUniqueLayoutKeys(
    schemaLineFields
      .map((field, index) => {
        const sapField = String(field.sapField || field.databaseField || field.stateKey || '').trim();
        const key = normalizeSchemaFieldKey(field);
        if (!key || !sapField) return null;

        const isUdf = isSchemaUdfField(field);
        const layoutColumn = {
          fieldName: sapField,
          columnUid: field.databaseField || sapField,
          columnTitle: field.label || sapField,
          visible: field.visible !== false,
          editable: field.editable !== false && !field.readOnly,
          columnOrder: Number(field.order) || index + 1,
          width: Number(field.width) || undefined,
          dataType: field.databaseType || field.type || '',
          isUdf,
          source: 'schema',
        };

        if (isUdf) {
          const udfField = rowUdfMap.get(normalizeUdfKey(sapField))
            || rowUdfMap.get(normalizeToken(field.label))
            || {
              key,
              sapField: key,
              label: field.label || key,
              type: getSchemaFieldInputType(field),
              options: Array.isArray(field.options) ? field.options : [],
              lookupSource: getSchemaSalesOrderLookupSource(field),
              lookupTable: field.linkedTable || field.lookupTable || undefined,
              readOnly: Boolean(field.readOnly || field.editable === false),
              active: field.editable !== false && !field.readOnly,
            };

          return buildSyntheticColumn(layoutColumn, udfField.key, {
            label: field.label || udfField.label || udfField.key,
            readOnly: Boolean(udfField.readOnly || field.readOnly || field.editable === false),
            minWidth: Number(field.width) || (udfField.type === 'textarea' ? 180 : 125),
            order: Number(field.order) || index + 1,
            type: udfField.type || getSchemaFieldInputType(field),
            isUdf: true,
            lookupSource: udfField.lookupSource || getSchemaSalesOrderLookupSource(field),
            lookupTable: udfField.lookupTable || field.linkedTable || field.lookupTable,
            lookup: field.lookup,
            options: udfField.options || field.options,
            field: udfField,
            id: field.id,
            schemaFieldId: field.id,
            fieldId: field.fieldId || field.lookup?.fieldId,
            schemaDriven: true,
            sapControlled: true,
          });
        }

        const internalKey = findInternalKey(layoutColumn, liveFieldMap);
        const liveField = internalKey
          ? liveFieldMap.get(normalizeToken(internalKey)) || liveMatrixColumns.find((candidate) => candidate.key === internalKey)
          : null;

        if (liveField && STANDARD_RENDERER_KEYS.has(internalKey)) {
          return {
            ...buildStandardLayoutColumn(layoutColumn, liveField, internalKey, index),
            lookupSource: liveField.lookupSource || field.lookup?.source || field.lookupSource || undefined,
            lookup: field.lookup,
            options: liveField.options || (Array.isArray(field.options) ? field.options : undefined),
            id: field.id,
            schemaFieldId: field.id,
            fieldId: field.fieldId || field.lookup?.fieldId,
            schemaDriven: true,
          };
        }

        if (internalKey && STANDARD_RENDERER_KEYS.has(internalKey)) {
          const writableMapping = getSalesOrderWritableStandardLineField(internalKey);
          const standardOverride = STANDARD_FIELD_OVERRIDES[internalKey] || {};
          const readOnly = standardOverride.readOnly ?? (
            !writableMapping || field.readOnly || field.editable === false
          );
          return buildSyntheticColumn(layoutColumn, internalKey, {
            ...standardOverride,
            label: field.label || internalKey,
            order: Number(field.order) || index + 1,
            readOnly,
            active: field.editable !== false && !readOnly,
            lookupSource: field.lookup?.source || field.lookupSource || undefined,
            lookup: field.lookup,
            options: Array.isArray(field.options) ? field.options : undefined,
            id: field.id,
            schemaFieldId: field.id,
            fieldId: field.fieldId || field.lookup?.fieldId,
            schemaDriven: true,
            sapControlled: true,
            serviceLayerField: writableMapping?.serviceLayerField,
            payloadKey: writableMapping?.payloadKey,
            writableStandardField: Boolean(writableMapping),
          });
        }

        return buildSyntheticColumn(layoutColumn, key, {
          label: field.label || key,
          readOnly: true,
          minWidth: Number(field.width) || 125,
          order: Number(field.order) || index + 1,
          type: getSchemaFieldInputType(field),
          schemaDriven: true,
          sapControlled: true,
          lookupSource: field.lookup?.source || field.lookupSource || undefined,
          lookup: field.lookup,
          options: Array.isArray(field.options) ? field.options : undefined,
          id: field.id,
          schemaFieldId: field.id,
          fieldId: field.fieldId || field.lookup?.fieldId,
          source: 'RDR1_SCHEMA_DISPLAY',
        });
      })
      .filter(Boolean)
  );
};

const withUniqueLayoutKeys = (columns = []) => {
  const counts = new Map();

  return (columns || []).map((column, index) => {
    const baseKey = column.key || column.valueKey || column.fieldName || `layout_${index + 1}`;
    const count = counts.get(baseKey) || 0;
    counts.set(baseKey, count + 1);

    const valueKey = column.valueKey || baseKey;
    const rendererKey = column.rendererKey || valueKey;
    if (count === 0) {
      return {
        ...column,
        key: baseKey,
        valueKey,
        rendererKey,
      };
    }

    return {
      ...column,
      key: `${baseKey}__layout_${index + 1}`,
      valueKey,
      rendererKey,
    };
  });
};

const getColumnIdentityTokens = (column = {}) => (
  [
    column.key,
    column.valueKey,
    column.rendererKey,
    column.fieldName,
    column.layoutFieldName,
    column.sapField,
    column.sapColumnId,
    column.columnUid,
  ]
    .map((value) => {
      const raw = String(value || '').trim();
      return raw.startsWith('U_') ? normalizeUdfKey(raw) : normalizeToken(raw);
    })
    .filter(Boolean)
);

const appendMissingLiveMatrixColumns = (layoutMappedColumns = [], liveMatrixColumns = []) => {
  if (!Array.isArray(liveMatrixColumns) || !liveMatrixColumns.length) return layoutMappedColumns;

  const seen = new Set();
  layoutMappedColumns.forEach((column) => {
    getColumnIdentityTokens(column).forEach((token) => seen.add(token));
  });

  const missing = liveMatrixColumns.filter((column) => {
    const tokens = getColumnIdentityTokens(column);
    if (!tokens.length) return false;
    return !tokens.some((token) => seen.has(token));
  });

  return [...layoutMappedColumns, ...missing];
};

const isLineNumberColumn = (column = {}) => (
  column.key === SALES_ORDER_LINE_NUMBER_KEY
  || column.valueKey === SALES_ORDER_LINE_NUMBER_KEY
  || column.rendererKey === SALES_ORDER_LINE_NUMBER_KEY
  || getColumnIdentityTokens(column).some((token) => token === 'LINENUM' || token === SALES_ORDER_LINE_NUMBER_KEY)
);

const pinLineNumberColumnFirst = (columns = []) => (
  (columns || []).map((column) => (
    isLineNumberColumn(column)
      ? {
          ...column,
          key: SALES_ORDER_LINE_NUMBER_KEY,
          valueKey: SALES_ORDER_LINE_NUMBER_KEY,
          rendererKey: SALES_ORDER_LINE_NUMBER_KEY,
          label: '#',
          order: -10000,
          columnOrder: -10000,
          minWidth: column.minWidth || 42,
          width: column.width || column.minWidth || 42,
          readOnly: true,
          active: false,
        }
      : column
  ))
);

const ensureLineNumberColumn = (columns = []) => {
  if ((columns || []).some(isLineNumberColumn)) return columns;

  return [{
    key: SALES_ORDER_LINE_NUMBER_KEY,
    valueKey: SALES_ORDER_LINE_NUMBER_KEY,
    rendererKey: SALES_ORDER_LINE_NUMBER_KEY,
    fieldName: 'LineNum',
    sapField: 'LineNum',
    label: '#',
    type: 'number',
    minWidth: 42,
    width: 42,
    order: -10000,
    columnOrder: -10000,
    visible: true,
    readOnly: true,
    active: false,
    sapControlled: true,
  }, ...(columns || [])];
};

export const mapLiveSalesOrderMatrixToLayout = (columns = []) => (
  (columns || []).map((column, index) => ({
    columnUid: column.sapColumnId || column.columnUid || column.sapField || column.key || `column_${index + 1}`,
    fieldName: column.sapField || column.fieldName || column.key || '',
    columnTitle: column.label || column.columnTitle || column.key || '',
    visible: column.visible !== false,
    editable: column.active !== false && !column.readOnly,
    columnOrder: Number.isFinite(Number(column.order)) ? Number(column.order) : index + 1,
    width: Number(column.minWidth || column.width) || undefined,
    dataType: column.dataType || column.type || '',
    isUdf: Boolean(column.isUdf || String(column.sapField || column.key || '').toUpperCase().startsWith('U_')),
    source: 'live-sap-metadata',
  }))
);

const getColumnDisplayIdentity = (column = {}) => {
  if (isLineNumberColumn(column)) return SALES_ORDER_LINE_NUMBER_KEY;
  const labelToken = normalizeToken(column.label || column.columnTitle);
  if (labelToken) return `LABEL:${labelToken}`;
  const tokens = getColumnIdentityTokens(column);
  return tokens[0] || '';
};

const dedupeVisibleMatrixColumns = (columns = []) => {
  const seen = new Set();
  return (columns || []).filter((column) => {
    const identity = getColumnDisplayIdentity(column);
    if (!identity) return true;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
};

export const buildSalesOrderMatrixColumnsFromLayout = ({
  layoutColumns = [],
  liveMatrixColumns = [],
  rowUdfFields = [],
  includeLineNumber = true,
  appendMissingLiveColumns = false,
} = {}) => {
  if (!Array.isArray(layoutColumns) || !layoutColumns.length) {
    return Array.isArray(liveMatrixColumns) && liveMatrixColumns.length
      ? withUniqueLayoutKeys(dedupeVisibleMatrixColumns(pinLineNumberColumnFirst(
          includeLineNumber ? ensureLineNumberColumn(liveMatrixColumns) : liveMatrixColumns,
        )))
      : BASE_MATRIX_COLUMNS;
  }

  const liveFieldMap = buildLiveFieldMap(liveMatrixColumns);
  const rowUdfMap = buildRowUdfMap(rowUdfFields);

  const mappedColumns = layoutColumns.map((layoutColumn, index) => {
    const internalKey = findInternalKey(layoutColumn, liveFieldMap);
    const fieldName = String(layoutColumn.fieldName || layoutColumn.columnUid || '').trim();
    const udfField = rowUdfMap.get(normalizeUdfKey(fieldName)) || rowUdfMap.get(normalizeToken(layoutColumn.columnTitle));
    const liveField = internalKey ? liveFieldMap.get(normalizeToken(internalKey)) || liveMatrixColumns.find((field) => field.key === internalKey) : null;
    const layoutIsUdf = Boolean(layoutColumn.isUdf) || fieldName.toUpperCase().startsWith('U_');

    if (internalKey === SALES_ORDER_LINE_NUMBER_KEY) {
      if (!includeLineNumber) return null;
      return buildSyntheticColumn(layoutColumn, SALES_ORDER_LINE_NUMBER_KEY, {
        label: '#',
        readOnly: true,
        minWidth: 42,
        order: index + 1,
        type: 'number',
      });
    }

    if (internalKey === 'itemNo') {
      return buildStandardLayoutColumn(layoutColumn, liveField, internalKey, index);
    }

    if (udfField && layoutIsUdf) {
      return buildSyntheticColumn(layoutColumn, udfField.key, {
        label: layoutColumn.columnTitle || udfField.label,
        readOnly: Boolean(udfField.readOnly) || layoutColumn.editable === false,
        minWidth: Number(layoutColumn.width) || (udfField.type === 'textarea' ? 180 : 125),
        order: Number(layoutColumn.columnOrder) || index + 1,
        type: udfField.type,
        isUdf: true,
        lookupSource: udfField.lookupSource,
        lookupTable: udfField.lookupTable,
        options: udfField.options,
        field: udfField,
      });
    }

    if (liveField && STANDARD_RENDERER_KEYS.has(internalKey)) {
      return buildStandardLayoutColumn(layoutColumn, liveField, internalKey, index);
    }

    if (!liveField && internalKey && STANDARD_RENDERER_KEYS.has(internalKey)) {
      const writableMapping = getSalesOrderWritableStandardLineField(internalKey);
      const standardOverride = STANDARD_FIELD_OVERRIDES[internalKey] || {};
      const readOnly = standardOverride.readOnly ?? (
        !writableMapping || layoutColumn.editable === false
      );
      return buildSyntheticColumn(layoutColumn, internalKey, {
        ...standardOverride,
        label: layoutColumn.columnTitle || internalKey,
        order: Number(layoutColumn.columnOrder) || index + 1,
        readOnly,
        active: layoutColumn.editable !== false && !readOnly,
        serviceLayerField: writableMapping?.serviceLayerField,
        payloadKey: writableMapping?.payloadKey,
        writableStandardField: Boolean(writableMapping),
      });
    }

    if (liveField) {
      return {
        ...liveField,
        key: liveField.key,
        valueKey: liveField.key,
        rendererKey: liveField.key,
        fieldName,
        layoutFieldName: fieldName,
        label: layoutColumn.columnTitle || liveField.label || liveField.key,
        visible: layoutColumn.visible !== false,
        active: layoutColumn.editable !== false,
        minWidth: Number(layoutColumn.width) || liveField.minWidth || 125,
        width: Number(layoutColumn.width) || liveField.minWidth || 125,
        order: Number(layoutColumn.columnOrder) || index + 1,
        columnOrder: Number(layoutColumn.columnOrder) || index + 1,
        sapControlled: layoutColumn.source !== 'fallback' && liveField.sapControlled !== false,
        importedLayout: true,
        source: layoutColumn.source || 'imported-layout',
      };
    }

    if (udfField) {
      return buildSyntheticColumn(layoutColumn, udfField.key, {
        label: udfField.label || layoutColumn.columnTitle,
        readOnly: Boolean(udfField.readOnly) || layoutColumn.editable === false,
        minWidth: udfField.type === 'textarea' ? 180 : 125,
        order: index + 1,
        type: udfField.type,
        isUdf: true,
        lookupSource: udfField.lookupSource,
        lookupTable: udfField.lookupTable,
        options: udfField.options,
      });
    }

    if (fieldName.toUpperCase().startsWith('U_')) {
      const genericField = buildGenericUdfField(layoutColumn, fieldName);
      return buildSyntheticColumn(layoutColumn, fieldName, {
        order: index + 1,
        isUdf: true,
        field: genericField,
        type: genericField.type,
      });
    }

    // Skip unknown layout fields that cannot be rendered by the UI.
    return null;
  });

  // Ensure Tax Code appears before Tax Amount to match SAP B1 default ordering
  const filtered = mappedColumns.filter(Boolean);
  try {
    const taxCodeIdx = filtered.findIndex((c) => (c.key || '').toString().toLowerCase() === 'taxcode' || (c.fieldName || '').toString().toLowerCase().includes('taxcode'));
    const taxAmountIdx = filtered.findIndex((c) => (c.key || '').toString().toLowerCase() === 'taxamount' || (c.fieldName || '').toString().toLowerCase().includes('taxamount') || (c.label || '').toString().toLowerCase().includes('tax amount'));
    if (taxCodeIdx >= 0 && taxAmountIdx >= 0 && taxAmountIdx < taxCodeIdx) {
      // swap their order values so taxCode renders earlier
      const tmpOrder = Number(filtered[taxCodeIdx].order || filtered[taxCodeIdx].columnOrder || taxCodeIdx + 1);
      filtered[taxCodeIdx].order = Number(filtered[taxAmountIdx].order || filtered[taxAmountIdx].columnOrder || taxAmountIdx + 1);
      filtered[taxAmountIdx].order = tmpOrder;
    }
  } catch (e) {
    // swallow any errors — ordering is best-effort
    // console.debug('layout ordering adjust failed', e);
  }

  const mergedColumns = appendMissingLiveColumns
    ? appendMissingLiveMatrixColumns(filtered, liveMatrixColumns)
    : filtered;

  return withUniqueLayoutKeys(dedupeVisibleMatrixColumns(pinLineNumberColumnFirst(
    includeLineNumber ? ensureLineNumberColumn(mergedColumns) : mergedColumns,
  )));
};
