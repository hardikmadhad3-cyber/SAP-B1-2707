const dbService = require('./dbService');

const normalizeFieldName = (row = {}) =>
  String(row.FieldName || row.FIELDNAME || row.fieldName || row.AliasID || row.ALIASID || '').trim();

const getExistingFieldNames = async (physicalTableName) => {
  const result = await dbService.query(
    `SELECT AliasID AS FieldName
     FROM CUFD
     WHERE TableID = @tableName
     ORDER BY FieldID`,
    { tableName: String(physicalTableName || '').trim() },
  );
  return new Set((result.recordset || []).map(normalizeFieldName).filter(Boolean));
};

module.exports = {
  getExistingFieldNames,
  normalizeFieldName,
};
