const { createTableFieldMetadataReader } = require('./salesDocumentDbCompatibility');

const readers = new WeakMap();

// Price is SAP's effective price. Editing must start from PriceBefDi so
// row and document discounts are not applied again after loading/copying.
const getDocumentUnitPriceSql = async (database, tableName, alias = 'T0') => {
  if (!readers.has(database)) {
    readers.set(database, createTableFieldMetadataReader({ database }));
  }
  const metadata = await readers.get(database)(tableName);
  const field = Object.keys(metadata).find((key) => key.toUpperCase() === 'PRICEBEFDI');
  if (!field) return `${alias}.Price`;
  return `COALESCE(NULLIF(${alias}.[${field.replace(/]/g, ']]')}], 0), ${alias}.Price, ${alias}.[${field.replace(/]/g, ']]')}], 0)`;
};

module.exports = { getDocumentUnitPriceSql };
