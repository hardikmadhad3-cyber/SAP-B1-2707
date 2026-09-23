/**
 * Direct-SQL reads for Gate Pass masters and transactions — once a UDT is
 * provisioned it's an ordinary physical table (`@<TableName>`) visible via
 * INFORMATION_SCHEMA, so no Service Layer round-trip is needed for
 * lists/detail. Mirrors jobWorkDbService.js's approach for the Job Work module.
 */
const db = require('./dbService');
const { getMaster, getTransaction } = require('./gatePassSchema');

const safe = async (promise) => {
  try {
    const result = await promise;
    return result.recordset || [];
  } catch (error) {
    console.error('[GatePass DB] Query failed:', error.message);
    return [];
  }
};

const physicalTable = (tableName) => `"@${tableName}"`;

/** SAP's built-in Code/Name master data columns — same for every bott_MasterData UDT. */
const getMasterList = async (masterKey, { query = '' } = {}) => {
  const master = getMaster(masterKey);
  const table = physicalTable(master.table.name);
  const searchTerm = String(query || '').trim();

  const rows = await safe(db.query(`
    SELECT "Code" AS code, "Name" AS name
    FROM ${table}
    WHERE @search = '' OR "Code" LIKE @searchLike OR "Name" LIKE @searchLike
    ORDER BY "Name" ASC
  `, { search: searchTerm, searchLike: `%${searchTerm}%` }));

  return rows;
};

const getList = async (transactionKey, { query = '', page = 1, pageSize = 25 } = {}) => {
  const transaction = getTransaction(transactionKey);
  const { statusField, partyCodeField, partyNameField, postingDateField } = transaction.listFields;
  const table = physicalTable(transaction.masterTable.name);
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedPageSize = Math.min(200, Math.max(1, Number(pageSize) || 25));
  const skip = (normalizedPage - 1) * normalizedPageSize;
  const searchTerm = String(query || '').trim();

  const whereClauses = ['1 = 1'];
  const params = {};
  if (searchTerm) {
    whereClauses.push(`(T0."DocNum" LIKE @search OR T0."U_${partyCodeField}" LIKE @search OR T0."U_${partyNameField}" LIKE @search)`);
    params.search = `%${searchTerm}%`;
  }

  const countRows = await safe(db.query(`
    SELECT COUNT(*) AS total_count FROM ${table} T0 WHERE ${whereClauses.join(' AND ')}
  `, params));
  const totalCount = Number(countRows?.[0]?.total_count || 0);

  const rows = await safe(db.query(`
    SELECT
      T0."DocEntry" AS doc_entry,
      T0."DocNum" AS doc_num,
      T0."U_${partyCodeField}" AS party_code,
      T0."U_${partyNameField}" AS party_name,
      T0."U_${postingDateField}" AS posting_date,
      T0."U_${statusField}" AS status
    FROM ${table} T0
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY T0."DocEntry" DESC
    OFFSET @skip ROWS FETCH NEXT @top ROWS ONLY
  `, { ...params, skip, top: normalizedPageSize }));

  return {
    documents: rows.map((row) => ({
      doc_entry: row.doc_entry,
      doc_num: row.doc_num,
      party_code: row.party_code || '',
      party_name: row.party_name || '',
      posting_date: row.posting_date ? String(row.posting_date).split('T')[0] : '',
      status: row.status || '',
    })),
    pagination: {
      page: normalizedPage,
      pageSize: normalizedPageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / normalizedPageSize)),
    },
  };
};

const getHeaderUdfColumns = (transaction) => transaction.masterFields.map((f) => `U_${f.name}`);

const getByDocEntry = async (transactionKey, docEntry) => {
  const transaction = getTransaction(transactionKey);
  const table = physicalTable(transaction.masterTable.name);
  const udfColumnList = getHeaderUdfColumns(transaction).map((column) => `"${column}"`).join(', ');

  const headerRows = await safe(db.query(`
    SELECT "DocEntry", "DocNum", "Series", "CreateDate", ${udfColumnList}
    FROM ${table}
    WHERE "DocEntry" = @docEntry
  `, { docEntry }));

  if (!headerRows.length) {
    const error = new Error(`Gate Pass document ${docEntry} not found.`);
    error.statusCode = 404;
    throw error;
  }

  const header = headerRows[0];
  const lines = {};
  for (const childTable of transaction.childTables) {
    const fields = transaction.childFields[childTable.name] || [];
    const lineColumnList = fields.map((f) => `"U_${f.name}"`).join(', ');
    lines[childTable.name] = await safe(db.query(`
      SELECT "LineId", ${lineColumnList}
      FROM ${physicalTable(childTable.name)}
      WHERE "DocEntry" = @docEntry
      ORDER BY "LineId" ASC
    `, { docEntry }));
  }

  return { header, lines };
};

/**
 * Deletes physical line rows dropped from the UI on update — Service Layer's
 * PATCH only ever adds/updates rows present in the submitted child collection,
 * so a row the user removed in the UI must be cleaned up directly.
 */
const deleteRemovedLines = async (tableName, docEntry, keepLineIds = []) => {
  const table = physicalTable(tableName);
  const existingRows = await safe(db.query(`SELECT "LineId" FROM ${table} WHERE "DocEntry" = @docEntry`, { docEntry }));
  const keepSet = new Set(keepLineIds.map((id) => Number(id)));
  const toDelete = existingRows.map((row) => Number(row.LineId)).filter((lineId) => !keepSet.has(lineId));

  if (!toDelete.length) return { deleted: 0 };

  const params = { docEntry };
  const placeholders = toDelete.map((lineId, index) => {
    const paramName = `lineId${index}`;
    params[paramName] = lineId;
    return `@${paramName}`;
  });

  await safe(db.query(`
    DELETE FROM ${table}
    WHERE "DocEntry" = @docEntry AND "LineId" IN (${placeholders.join(', ')})
  `, params));

  return { deleted: toDelete.length };
};

module.exports = {
  getMasterList,
  getList,
  getByDocEntry,
  deleteRemovedLines,
};
