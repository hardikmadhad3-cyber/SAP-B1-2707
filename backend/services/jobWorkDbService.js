/**
 * Direct-SQL reads for Job Work documents, generic across all 4 transactions —
 * once a UDT is provisioned it's an ordinary physical table (`@<TableName>`)
 * visible via INFORMATION_SCHEMA, so no Service Layer round-trip is needed for
 * lists/detail, exactly like every other document module (see grpoDbService.js).
 */
const db = require('./dbService');
const { getTransaction } = require('./jobWorkSchema');
const { getMarketingDocumentSeries } = require('./documentSeriesDbUtils');

const safe = async (promise) => {
  try {
    const result = await promise;
    return result.recordset || [];
  } catch (error) {
    console.error('[JobWork DB] Query failed:', error.message);
    return [];
  }
};

const physicalTable = (tableName) => `"@${tableName}"`;

const getReferenceData = async (transactionKey) => {
  const transaction = getTransaction(transactionKey);
  const isVendor = transaction.partyType === 'vendor';

  const [parties, warehouses, items, paymentTerms, salesEmployees, branches] = await Promise.all([
    safe(db.query(`
      SELECT CardCode, CardName, CardType, GroupNum, SlpCode
      FROM OCRD
      WHERE CardType = @cardType AND ISNULL(frozenFor, 'N') <> 'Y'
      ORDER BY CardName
    `, { cardType: isVendor ? 'S' : 'C' })),
    safe(db.query(`
      SELECT WhsCode, WhsName, BinActivat AS BinEnabled, BPLid AS BranchId
      FROM OWHS
      WHERE ISNULL(Inactive, 'N') <> 'Y'
      ORDER BY WhsCode
    `)),
    safe(db.query(`
      SELECT ItemCode, ItemName, InvntryUom AS InventoryUOM, DfltWH AS DefaultWarehouse,
             ManBtchNum AS BatchManaged
      FROM OITM
      WHERE ISNULL(validFor, 'Y') <> 'N'
      ORDER BY ItemCode
    `)),
    safe(db.query(`
      SELECT GroupNum, PymntGroup
      FROM OCTG
      ORDER BY PymntGroup
    `)),
    safe(db.query(`
      SELECT SlpCode, SlpName
      FROM OSLP
      WHERE ISNULL(Active, 'Y') <> 'N'
      ORDER BY SlpName
    `)),
    // Companies without Business Places (branches) enabled simply have zero rows here —
    // the frontend treats an empty list as "no branch selection needed".
    safe(db.query(`
      SELECT BPLId, BPLName
      FROM OBPL
      WHERE ISNULL(Disabled, 'N') <> 'Y'
      ORDER BY BPLName
    `)),
  ]);

  return { parties, warehouses, items, paymentTerms, salesEmployees, branches };
};

/** Active bin locations for a bin-managed warehouse (SAP's OBIN table). */
const getBinsByWarehouse = async (transactionKey, whsCode) => {
  getTransaction(transactionKey); // validates the transaction key exists

  return safe(db.query(`
    SELECT AbsEntry AS BinAbsEntry, BinCode
    FROM OBIN
    WHERE WhsCode = @whsCode AND COALESCE(Disabled, 'N') <> 'Y'
    ORDER BY BinCode
  `, { whsCode }));
};

/** Bill-To / Ship-From addresses saved against a customer/vendor (SAP's CRD1 table). */
const getPartyAddresses = async (transactionKey, partyCode) => {
  getTransaction(transactionKey); // validates the transaction key exists

  const [addresses, defaults] = await Promise.all([
    safe(db.query(`
      SELECT
        Address AS address_id,
        AdresType AS address_type,
        Street AS street,
        StreetNo AS street_no,
        Building AS building,
        Block AS block,
        City AS city,
        ZipCode AS zip_code,
        County AS county,
        Country AS country,
        State AS state,
        GSTRegnNo AS gstin,
        GSTType AS gst_type
      FROM CRD1
      WHERE CardCode = @partyCode AND AdresType IN ('B', 'S')
      ORDER BY Address
    `, { partyCode })),
    // SAP stores the vendor/customer's chosen default Bill-To / Ship-From
    // address codes on the business partner master itself (OCRD), separate
    // from the address list on CRD1 — same convention incomingPaymentsService
    // and masterDataDbService already rely on.
    safe(db.query(`SELECT BillToDef, ShipToDef FROM OCRD WHERE CardCode = @partyCode`, { partyCode })),
  ]);

  // SAP allows an address to be saved without an "Address Name" (CRD1.Address
  // blank) — common on a business partner's sole/default address. Street,
  // City etc. still come through fine on that row; only the ID is missing.
  // A blank ID would make the row unselectable/indistinguishable in the UI,
  // so give it a stable synthetic label instead of leaving it empty. This
  // never gets written back to SAP — it only ever lands in this app's own
  // BAdresID/SAdresID copy-fields on the paperwork document.
  const seenByType = {};
  const addressesWithFallbackIds = addresses.map((address) => {
    if (String(address.address_id || '').trim()) return address;
    const type = address.address_type || 'X';
    seenByType[type] = (seenByType[type] || 0) + 1;
    return { ...address, address_id: `${type}${seenByType[type]}` };
  });

  return {
    addresses: addressesWithFallbackIds,
    billToDefault: defaults[0]?.BillToDef || '',
    shipToDefault: defaults[0]?.ShipToDef || '',
  };
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
  const udfColumnList = getHeaderUdfColumns(transaction)
    .map((column) => `"${column}"`)
    .join(', ');

  const headerRows = await safe(db.query(`
    SELECT "DocEntry", "DocNum", "Series", "CreateDate", ${udfColumnList}
    FROM ${table}
    WHERE "DocEntry" = @docEntry
  `, { docEntry }));

  if (!headerRows.length) {
    const error = new Error(`Job Work document ${docEntry} not found.`);
    error.statusCode = 404;
    throw error;
  }

  const header = headerRows[0];
  const primaryLineTable = transaction.listFields.primaryLineTable;
  const lineFields = transaction.childFields[primaryLineTable] || [];
  const lineColumnList = lineFields.map((f) => `"U_${f.name}"`).join(', ');

  const lines = await safe(db.query(`
    SELECT "LineId", ${lineColumnList}
    FROM ${physicalTable(primaryLineTable)}
    WHERE "DocEntry" = @docEntry
    ORDER BY "LineId" ASC
  `, { docEntry }));

  return { header, lines };
};

/**
 * Deletes physical line rows dropped from the UI on update. Service Layer's
 * PATCH on a UDO's child collection only ever adds/updates rows present in
 * the submitted array — a row simply omitted from that array is left
 * untouched in the physical table, not removed, so a line the user deleted
 * in the UI silently reappears on reload unless we clean it up ourselves.
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

// Reuses the same NNM1/ONNM-schema-tolerant query every other document module
// uses (documentSeriesDbUtils) instead of an ad-hoc query — the earlier
// hand-rolled version selected a `DfltSeries` column that doesn't exist on
// this SAP version's NNM1, so every call silently returned an empty list.
const getDocumentSeries = async (transactionKey) => {
  const transaction = getTransaction(transactionKey);
  return getMarketingDocumentSeries({ db, objectCode: transaction.udo.objectType });
};

const getNextNumber = async (transactionKey, series) => {
  const transaction = getTransaction(transactionKey);
  const rows = await safe(db.query(`
    SELECT NextNumber
    FROM NNM1
    WHERE Series = @series AND ObjectCode = @objectCode
  `, { series, objectCode: transaction.udo.objectType }));

  return { nextNumber: rows[0]?.NextNumber ?? null };
};

// Object code '59' is SAP's "Inventory Goods Receipt" object (OIGN), the same
// real document /InventoryGenEntries posts to — matches goodsReceiptDbService.js's
// own getSeries exactly, so the standalone Goods Receipt module and this Customer
// Receipt Note's linked goods receipt offer the same numbering series choices.
const getGoodsReceiptSeries = async (targetDate = null, branch = '') =>
  getMarketingDocumentSeries({ db, objectCode: '59', targetDate, branch });

module.exports = {
  getReferenceData,
  getList,
  getByDocEntry,
  getDocumentSeries,
  getGoodsReceiptSeries,
  getNextNumber,
  getPartyAddresses,
  getBinsByWarehouse,
  deleteRemovedLines,
};
