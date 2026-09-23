const {
  createTableFieldMetadataReader,
  findPhysicalColumnName,
} = require('./salesDocumentDbCompatibility');

const readers = new WeakMap();

const normalizeRows = (result) => {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.recordset)) return result.recordset;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
};

const pickFirstValue = (row = {}, candidates = []) => {
  for (const candidate of candidates) {
    const physicalKey = Object.keys(row).find(
      (key) => String(key).toUpperCase() === String(candidate).toUpperCase(),
    );
    if (physicalKey && row[physicalKey] !== undefined && row[physicalKey] !== null && row[physicalKey] !== '') {
      return row[physicalKey];
    }
  }
  return '';
};

const formatDate = (value) => {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).split('T')[0];
};

const getDocumentReferences = async (database, tableName, docEntry) => {
  if (!readers.has(database)) {
    readers.set(database, createTableFieldMetadataReader({ database }));
  }

  const metadata = await readers.get(database)(tableName);
  const columns = Object.keys(metadata);
  const docEntryColumn = findPhysicalColumnName(columns, 'DocEntry');
  if (!docEntryColumn) return [];

  const lineNumColumn = findPhysicalColumnName(columns, 'LineNum');
  const result = await database.query(`
    SELECT *
    FROM [${tableName}]
    WHERE [${docEntryColumn}] = @docEntry
    ${lineNumColumn ? `ORDER BY [${lineNumColumn}]` : ''}
  `, { docEntry });

  return normalizeRows(result).map((row, index) => ({
    lineNum: Number(pickFirstValue(row, ['LineNum'])) || index,
    direction: 'to',
    transactionType: String(pickFirstValue(row, ['RefObjType', 'RefType', 'ObjType', 'ObjectType', 'RefObjCode', 'RefObj']) || ''),
    docEntry: String(pickFirstValue(row, ['RefDocEntr', 'RefDocEntry', 'RefDocEnt', 'RefDocEn', 'LinkedDocEntry']) || ''),
    docNumber: String(pickFirstValue(row, ['RefDocNum', 'RefDocNo', 'RefDocNumber', 'DocNum', 'RefDoc']) || ''),
    extDocNumber: String(pickFirstValue(row, ['ExtDocNum', 'ExtDocNo', 'ExtDocNumber', 'ExternalRefNo', 'ExternalReferencedDocNumber']) || ''),
    issueDate: formatDate(pickFirstValue(row, ['IssueDate', 'RefDate', 'DocDate'])),
    remark: String(pickFirstValue(row, ['Remark', 'Remarks', 'Comments']) || ''),
  })).filter((row) => (
    String(row.transactionType || row.docEntry || row.docNumber || row.extDocNumber || '').trim()
  ));
};

module.exports = { getDocumentReferences };
