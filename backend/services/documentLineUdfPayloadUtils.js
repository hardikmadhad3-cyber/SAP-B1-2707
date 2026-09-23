'use strict';

const { normalizeUdfValues, toUdfDefinitionMap } = require('./udfPayloadUtils');

const hasValue = (value) => (
  value !== undefined
  && value !== null
  && !(typeof value === 'string' && value.trim() === '')
);

const firstPresent = (...values) => values.find(hasValue);

const normalizeUdfToken = (value) => String(value ?? '')
  .trim()
  .toUpperCase()
  .replace(/^U_/, '')
  .replace(/[^A-Z0-9]+/g, '');

// A matrix column that SAP renders from a UDF writes its value into line.udf,
// but the pages also keep a camelCase field for the same UDF on the line
// itself. Both shapes must reach the Service Layer, or a value the user typed
// into a live column is silently dropped on save.
const MARKETING_DOCUMENT_LINE_UDF_MAPPINGS = Object.freeze([
  { aliases: ['U_Cost_Sheet', 'U_CostSheet', 'U_COSTSHEET'], lineKeys: ['costSheet'] },
  { aliases: ['U_PackingType', 'U_PACKINGTYPE', 'U_Packing_Type', 'U_PackingStatus'], lineKeys: ['packingType'] },
  { aliases: ['U_ContainerType', 'U_CONTAINERTYPE', 'U_Container_Type'], lineKeys: ['containerType'] },
  { aliases: ['U_GrossWt', 'U_GROSSWT', 'U_Gross_Wt', 'U_GrossWeight'], lineKeys: ['grossWt'], numeric: true, label: 'Gross Weight' },
  { aliases: ['U_TotalPackage', 'U_TOTALPACKAGE', 'U_Total_Package', 'U_TotalPackge'], lineKeys: ['totalPackage'], numeric: true, label: 'Total Package' },
  { aliases: ['U_TAXCODE', 'U_TaxCode'], lineKeys: ['taxCodeRepeat'] },
  { aliases: ['U_PRICE', 'U_Price'], lineKeys: ['price'] },
  { aliases: ['U_ForRate', 'U_FORRATE', 'U_FOR_RATE'], lineKeys: ['forRate'] },
  { aliases: ['U_Brok_Seller', 'U_BROK_SELLER'], lineKeys: ['sellerBrokerage'] },
  { aliases: ['U_Brok_Buyer', 'U_BROK_BUYER', 'U_Buyer_Brokerage'], lineKeys: ['buyerBrokerage'] },
  { aliases: ['U_Buyer_Delivery', 'U_BUYER_DELIVERY'], lineKeys: ['buyerDelivery'] },
  { aliases: ['U_Seller_Delivery', 'U_SELLER_DELIVERY'], lineKeys: ['sellerDelivery'] },
  { aliases: ['U_Buyer_Payment_Terms', 'U_BUYER_PAYMENT_TERMS'], lineKeys: ['buyerTermsOfPayment', 'buyerPaymentTerms'] },
  { aliases: ['U_Seller_Payment_Term', 'U_Seller_Payment_Terms', 'U_SELLER_PAYMENT_TERM', 'U_SELLER_PAYMENT_TERMS'], lineKeys: ['sellerTermsOfPaymentRepeat', 'sellerTermsOfPayment', 'sellerPaymentTermsDuplicate', 'sellerPaymentTerms'] },
  { aliases: ['U_Buyer_Quality', 'U_BUYER_QUALITY'], lineKeys: ['buyerQuality'] },
  { aliases: ['U_Seller_Quality', 'U_SELLER_QUALITY'], lineKeys: ['sellerQuality'] },
  { aliases: ['U_Buyer_Price', 'U_BUYER_PRICE'], lineKeys: ['buyerPrice'] },
  { aliases: ['U_Seller_Price', 'U_SELLER_PRICE'], lineKeys: ['sellerPrice'] },
  { aliases: ['U_Buyer_SPINS', 'U_BUYER_SPINS'], lineKeys: ['buyerSpecialInstruction'] },
  { aliases: ['U_Seller_SPINS', 'U_SELLER_SPINS'], lineKeys: ['sellerSpecialInstruction'] },
  { aliases: ['U_Sel_Brok_AP', 'U_SEL_BROK_AP'], lineKeys: ['sellerBrokerageAmountPer', 'sellerBrokerageAmtPer'] },
  { aliases: ['U_Seller_Brok_Per', 'U_SELLER_BROK_PER'], lineKeys: ['sellerBrokeragePercentage', 'sellerBrokeragePercent'] },
  { aliases: ['U_SELLTCODE', 'U_STCODE'], lineKeys: ['stcode'] },
  { aliases: ['U_S_Item', 'U_S_ITEM', 'U_SItem'], lineKeys: ['sellerItem'] },
  { aliases: ['U_S_Qty', 'U_S_QTY'], lineKeys: ['sellerQuantity', 'sellerQty'] },
  { aliases: ['U_SPLRBT'], lineKeys: ['specialRebate'] },
  { aliases: ['U_COMPRC'], lineKeys: ['commision', 'commission'] },
  { aliases: ['U_S_BrokPerQty', 'U_S_BROKPERQTY'], lineKeys: ['brokPerQty', 'sellerBrokeragePerQty'] },
  { aliases: ['U_Fix_Brock_B', 'U_Fix_Brok_B', 'U_FIX_BROK_BUYER'], lineKeys: ['fixBrokBuyer'] },
  { aliases: ['U_Fix_Brock_S', 'U_Fix_Brok_S', 'U_Fix_Brock_Seller'], lineKeys: ['fixBrockSeller'] },
]);

// A company names its UDF once; the pages carry several historical spellings of
// it. Resolving through the company's own definitions means whichever spelling
// arrives ends up on the column SAP actually has.
const createDefinitionKeyResolver = (definitions) => {
  const definitionsByKey = toUdfDefinitionMap(definitions);
  if (!definitionsByKey || !definitionsByKey.size) return null;
  const byToken = new Map(
    Array.from(definitionsByKey.keys()).map((key) => [normalizeUdfToken(key), key]),
  );
  return (candidates) => {
    for (const candidate of candidates) {
      if (definitionsByKey.has(candidate)) return candidate;
      const matched = byToken.get(normalizeUdfToken(candidate));
      if (matched) return matched;
    }
    return '';
  };
};

const readMappedLineValue = (line, mapping) => {
  const fromLine = firstPresent(...mapping.lineKeys.map((lineKey) => line?.[lineKey]));
  if (hasValue(fromLine)) return fromLine;
  // The same UDF may already sit on line.udf under any of its spellings.
  const udf = line?.udf || {};
  return firstPresent(...mapping.aliases.map((alias) => udf[alias]));
};

const coerceMappedValue = (value, mapping) => {
  if (!mapping.numeric) return value;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    throw new Error(`${mapping.label || mapping.aliases[0]} must contain a valid numeric value.`);
  }
  return numericValue;
};

/**
 * Collect every line UDF a marketing-document line carries, from `line.udf`
 * (live SAP-driven matrix columns) and from the page's own camelCase line
 * fields, keyed by the names the company database actually defines.
 *
 * @param {object} line                 A document line from the request payload.
 * @param {object} [options]
 * @param {Map|Array|object} [options.definitions] The table's UDF definitions.
 * @param {Set} [options.allowedKeys]   Restrict the result to these UDF keys.
 * @returns {object} UDF values keyed by their SAP field name.
 */
const buildDocumentLineUdfValues = (line = {}, { definitions = null, allowedKeys = null } = {}) => {
  const resolveKey = createDefinitionKeyResolver(definitions);
  const values = { ...(line.udf || {}) };

  for (const mapping of MARKETING_DOCUMENT_LINE_UDF_MAPPINGS) {
    const rawValue = readMappedLineValue(line, mapping);
    if (!hasValue(rawValue)) continue;

    // Without company definitions the first alias is the canonical spelling.
    const targetKey = (resolveKey && resolveKey(mapping.aliases)) || mapping.aliases[0];

    // Drop the other spellings so one UDF is never sent twice with two names.
    for (const alias of mapping.aliases) {
      if (alias !== targetKey) delete values[alias];
    }
    values[targetKey] = coerceMappedValue(rawValue, mapping);
  }

  return normalizeUdfValues(values, allowedKeys, definitions);
};

module.exports = {
  MARKETING_DOCUMENT_LINE_UDF_MAPPINGS,
  buildDocumentLineUdfValues,
  createDefinitionKeyResolver,
  normalizeUdfToken,
};
