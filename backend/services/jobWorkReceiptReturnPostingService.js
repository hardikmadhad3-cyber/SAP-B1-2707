/**
 * Business logic specific to the Jobwork Receipt / Return Note (Purchase J/W)
 * transaction — ported from the legacy VB.NET screen (JW_Pur_R.b1f.cs), which
 * has two distinct modes selected by the header's JWTYP field:
 *
 *  - JWTYP = 'R' (Receipt): the vendor has finished the job work. STTL_JWPR8
 *    rows ("Used Qty" against a selected Jobwork Issue Note line) post ONE
 *    Goods Issue consuming the raw material from the vendor's bin; STTL_JWPR9
 *    rows (finished goods, item can differ from what was issued — confirmed
 *    unrestricted in the legacy code) post ONE Goods Receipt into the
 *    company's own warehouse. Both post together.
 *  - JWTYP = 'RE' (Return): nothing was consumed/produced — unused material
 *    is coming back as-is. STTL_JWPR6 rows post ONE Stock Transfer reversing
 *    the vendor bin back to the original source warehouse. No Goods
 *    Issue/Receipt happens in this mode.
 *
 * "Balance Qty" for a source Issue Note line is NOT stored — it's computed
 * live as IssuedQty minus the sum of everything already consumed against
 * that same line across BOTH STTL_JWPR6 and STTL_JWPR8 (the legacy screen's
 * own Getsumused query unions both), so multiple Receipt/Return documents
 * can each partially draw down the same Issue Note over time.
 */
const sapService = require('./sapService');
const db = require('./dbService');

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toIsoDate = (value) => (value ? String(value).split('T')[0] : undefined);

const extractSapError = (error, fallback) =>
  error.response?.data?.error?.message?.value ||
  error.response?.data?.error?.message ||
  error.response?.data?.detail ||
  error.message ||
  fallback;

const physicalTable = (name) => `"@${name}"`;

const safe = async (promise) => {
  try {
    const result = await promise;
    return result.recordset || [];
  } catch (error) {
    console.error('[JobworkReceiptReturn] Query failed:', error.message);
    return [];
  }
};

const isBinEnabled = (warehousesByCode, whsCode) => {
  const warehouse = warehousesByCode.get(String(whsCode || '').trim());
  return String(warehouse?.BinEnabled || '').trim().toUpperCase() === 'Y';
};

const normalizeJwType = (value) => String(value || '').trim().toUpperCase();

const validateHeader = (header = {}, branches = []) => {
  if (!String(header.VENCOD || '').trim()) {
    throw new Error('Vendor is required.');
  }
  if (branches.length && !String(header.BRNCH || '').trim()) {
    throw new Error('Branch is required.');
  }
  const type = normalizeJwType(header.JWTYP);
  if (!['R', 'RE'].includes(type)) {
    throw new Error('Transaction Type is required — select Receipt or Return.');
  }
};

/**
 * @param {Object} lines - the FULL payload.lines map (config.passFullLines),
 *   keyed by child table name — { STTL_JWPR6, STTL_JWPR8, STTL_JWPR9 }.
 */
const validateLines = (lines = {}, itemsByCode = new Map(), warehousesByCode = new Map(), header = {}) => {
  const type = normalizeJwType(header.JWTYP);

  if (type === 'RE') {
    const returnLines = (lines.STTL_JWPR6 || []).filter((line) => String(line?.MITMNO || '').trim());
    if (!returnLines.length) {
      throw new Error('Select at least one Jobwork Issue Note line to return before saving.');
    }
    returnLines.forEach((line, index) => {
      const rowLabel = `Return line ${index + 1}`;
      if (toNumber(line.MQTY, 0) <= 0) throw new Error(`${rowLabel}: Quantity must be greater than zero.`);
      if (!String(line.MWHS || '').trim() || !String(line.TWHS || '').trim()) {
        throw new Error(`${rowLabel}: source and destination warehouse are both required.`);
      }
    });
    return;
  }

  // Receipt (type === 'R')
  const consumptionLines = (lines.STTL_JWPR8 || []).filter((line) => String(line?.MRITMNO || '').trim());
  if (!consumptionLines.length) {
    throw new Error('Select at least one Jobwork Issue Note line consumed before saving.');
  }
  consumptionLines.forEach((line, index) => {
    const rowLabel = `Consumption line ${index + 1}`;
    if (toNumber(line.MRQTY, 0) <= 0) throw new Error(`${rowLabel}: Used Qty must be greater than zero.`);
    if (!String(line.MRWHS || '').trim()) throw new Error(`${rowLabel}: Warehouse is required.`);
    const item = itemsByCode.get(String(line.MRITMNO || '').trim());
    const isBatchManaged = String(item?.BatchManaged || '').trim().toUpperCase() === 'Y';
    const hasBatchAllocation = (Array.isArray(line.batches) && line.batches.length > 0) || String(line.MRBatch || '').trim();
    if (isBatchManaged && !hasBatchAllocation) {
      throw new Error(`${rowLabel}: Item ${line.MRITMNO} is batch-managed — at least one Batch allocation is required.`);
    }
    if (isBinEnabled(warehousesByCode, line.MRWHS) && !String(line.MRBinCode || '').trim()) {
      throw new Error(`${rowLabel}: Warehouse ${line.MRWHS} requires a Bin Location.`);
    }
  });

  const receiptLines = (lines.STTL_JWPR9 || []).filter((line) => String(line?.MRITMNO || '').trim());
  if (!receiptLines.length) {
    throw new Error('Add at least one finished-goods line received before saving.');
  }
  receiptLines.forEach((line, index) => {
    const rowLabel = `Receipt line ${index + 1}`;
    if (toNumber(line.MRQTY, 0) <= 0) throw new Error(`${rowLabel}: Quantity must be greater than zero.`);
    if (!String(line.MRWHS || '').trim()) throw new Error(`${rowLabel}: Warehouse is required.`);
    if (isBinEnabled(warehousesByCode, line.MRWHS) && !String(line.MRBinCode || '').trim()) {
      throw new Error(`${rowLabel}: Warehouse ${line.MRWHS} requires a Bin Location.`);
    }
  });
};

/**
 * Lists open Jobwork Issue Note lines for a vendor, each with a live Balance
 * Qty — mirrors the legacy Getsumused query, summing consumption already
 * recorded against that line across BOTH STTL_JWPR6 and STTL_JWPR8, from
 * every Receipt/Return document ever saved (not just this one).
 */
const getConsumableIssues = async (vendorCode) => {
  const normalizedVendorCode = String(vendorCode || '').trim();
  if (!normalizedVendorCode) return [];

  const issueLines = await safe(db.query(`
    SELECT
      H."DocEntry" AS doc_entry,
      H."DocNum" AS doc_num,
      H."U_JWONUO" AS jw_no,
      L."LineId" AS line_id,
      L."U_MITMNO" AS item_code,
      L."U_MDES" AS item_name,
      L."U_MQTY" AS issued_qty,
      L."U_MUOM" AS uom,
      L."U_MWHS" AS whs_code,
      L."U_MBinCode" AS bin_code,
      L."U_MBatch" AS batch
    FROM ${physicalTable('STTL_JWPM')} H
    INNER JOIN ${physicalTable('STTL_JWP6')} L ON L."DocEntry" = H."DocEntry"
    WHERE H."U_VENCOD" = @vendorCode
    ORDER BY H."DocEntry" DESC, L."LineId" ASC
  `, { vendorCode: normalizedVendorCode }));

  if (!issueLines.length) return [];

  const usedRows = await safe(db.query(`
    SELECT "U_PJWDEN" AS src_doc_entry, "U_MITMNO" AS item_code, SUM("U_MQTY") AS used_qty
    FROM ${physicalTable('STTL_JWPR6')}
    WHERE "U_PJWDEN" IS NOT NULL
    GROUP BY "U_PJWDEN", "U_MITMNO"
    UNION ALL
    SELECT "U_PJWDEN" AS src_doc_entry, "U_MRITMNO" AS item_code, SUM("U_MRQTY") AS used_qty
    FROM ${physicalTable('STTL_JWPR8')}
    WHERE "U_PJWDEN" IS NOT NULL
    GROUP BY "U_PJWDEN", "U_MRITMNO"
  `));

  const usedByKey = new Map();
  usedRows.forEach((row) => {
    const key = `${row.src_doc_entry}|${String(row.item_code || '').trim().toLowerCase()}`;
    usedByKey.set(key, (usedByKey.get(key) || 0) + toNumber(row.used_qty, 0));
  });

  return issueLines
    .map((row) => {
      const key = `${row.doc_entry}|${String(row.item_code || '').trim().toLowerCase()}`;
      const usedQty = usedByKey.get(key) || 0;
      const balanceQty = toNumber(row.issued_qty, 0) - usedQty;
      return {
        doc_entry: row.doc_entry,
        doc_num: row.doc_num,
        jw_no: row.jw_no,
        line_id: row.line_id,
        item_code: row.item_code,
        item_name: row.item_name,
        issued_qty: toNumber(row.issued_qty, 0),
        used_qty: usedQty,
        balance_qty: balanceQty,
        uom: row.uom,
        whs_code: row.whs_code,
        bin_code: row.bin_code,
        batch: row.batch,
      };
    })
    .filter((row) => row.balance_qty > 0.0001);
};

const buildBatchNumbers = (line, itemField, qtyField) => {
  if (Array.isArray(line.batches) && line.batches.length) {
    return line.batches
      .filter((batch) => String(batch?.batchNumber || '').trim())
      .map((batch) => ({
        BatchNumber: String(batch.batchNumber).trim(),
        Quantity: toNumber(batch.quantity, 0),
      }));
  }
  return String(line[itemField] || '').trim()
    ? [{ BatchNumber: String(line[itemField]).trim(), Quantity: toNumber(line[qtyField], 0) }]
    : undefined;
};

/**
 * Posts the real stock movement(s) this Receipt/Return Note represents.
 * Branches entirely on header.JWTYP — 'RE' posts a single Stock Transfer,
 * 'R' posts a Goods Issue and a Goods Receipt together.
 */
const postStockMovements = async ({ header = {}, lines = {} }) => {
  const type = normalizeJwType(header.JWTYP);
  const result = { goodsIssue: null, goodsReceipt: null, inventoryTransferReturn: null };
  const docDate = toIsoDate(header.DOCDATE);
  const comments = `Jobwork Receipt / Return Note - ${header.VENNAME || header.VENCOD || ''}`.trim();

  if (type === 'RE') {
    const returnLines = (lines.STTL_JWPR6 || []).filter((line) => String(line?.MITMNO || '').trim());
    if (!returnLines.length) return result;

    const payload = {
      DocDate: docDate,
      Comments: comments,
      JournalMemo: 'Jobwork Receipt / Return Note',
      // Header-level From/To Warehouse required in addition to the per-line
      // ones — confirmed against the working Jobwork Issue Note StockTransfer
      // (jobWorkIssueNotePostingService.js), the proven reference for this object.
      FromWarehouse: returnLines[0].MWHS,
      ToWarehouse: returnLines[0].TWHS,
      ...(String(header.VENCOD || '').trim() ? { CardCode: String(header.VENCOD).trim() } : {}),
      StockTransferLines: returnLines.map((line) => ({
        ItemCode: line.MITMNO,
        Quantity: toNumber(line.MQTY, 0),
        FromWarehouseCode: line.MWHS,
        WarehouseCode: line.TWHS,
        BatchNumbers: buildBatchNumbers(line, 'MBatch', 'MQTY'),
      })),
    };

    console.log('[JobworkReceiptReturn] Posting /StockTransfers (return) payload:', JSON.stringify(payload, null, 2));

    try {
      const response = await sapService.request({ method: 'POST', url: '/StockTransfers', data: payload });
      result.inventoryTransferReturn = { docEntry: response.data.DocEntry, docNum: response.data.DocNum };
    } catch (error) {
      console.error('[JobworkReceiptReturn] Full SAP error response:', JSON.stringify(error.response?.data, null, 2));
      throw new Error(extractSapError(error, 'Failed to post the Return Stock Transfer for this Jobwork Receipt/Return Note.'));
    }

    return result;
  }

  // Receipt (type === 'R'): Goods Issue (consumption) + Goods Receipt (finished goods).
  const consumptionLines = (lines.STTL_JWPR8 || []).filter((line) => String(line?.MRITMNO || '').trim());
  const receiptLines = (lines.STTL_JWPR9 || []).filter((line) => String(line?.MRITMNO || '').trim());

  if (consumptionLines.length) {
    const payload = {
      DocDate: docDate,
      Comments: comments,
      JournalMemo: 'Jobwork Receipt / Return Note - RM Consumption',
      // No CardCode here — confirmed on the Customer Receipt Note's own
      // /InventoryGenEntries call that setting a vendor/customer CardCode on
      // a plain Inventory Entry causes SAP to misfire on an unrelated field
      // (the ODBC -1029 ShipDate saga). Same object type, same rule applies.
      // BPL_IDAssignedToInvoice is required when Business Places are active
      // in SAP (matches the proven goodsIssueService.js/goodsReceiptService.js
      // and jobWorkCustomerIssuePostingService.js pattern) — without it SAP
      // rejects the post with "Specify an active branch [OIGE.BPLId]".
      ...(String(header.BRNCH || '').trim() ? { BPL_IDAssignedToInvoice: Number(header.BRNCH) } : {}),
      DocumentLines: consumptionLines.map((line) => ({
        ItemCode: line.MRITMNO,
        Quantity: toNumber(line.MRQTY, 0),
        WarehouseCode: line.MRWHS,
        Price: toNumber(line.Price, 0),
        BatchNumbers: buildBatchNumbers(line, 'MRBatch', 'MRQTY'),
      })),
    };

    console.log('[JobworkReceiptReturn] Posting /InventoryGenExits (consumption) payload:', JSON.stringify(payload, null, 2));

    try {
      const response = await sapService.request({ method: 'POST', url: '/InventoryGenExits', data: payload });
      result.goodsIssue = { docEntry: response.data.DocEntry, docNum: response.data.DocNum };
    } catch (error) {
      console.error('[JobworkReceiptReturn] Full SAP error response:', JSON.stringify(error.response?.data, null, 2));
      throw new Error(extractSapError(error, 'Failed to post the Goods Issue (RM consumption) for this Jobwork Receipt/Return Note.'));
    }
  }

  if (receiptLines.length) {
    const payload = {
      DocDate: docDate,
      Comments: comments,
      JournalMemo: 'Jobwork Receipt / Return Note - Finished Goods',
      ...(String(header.BRNCH || '').trim() ? { BPL_IDAssignedToInvoice: Number(header.BRNCH) } : {}),
      DocumentLines: receiptLines.map((line) => ({
        ItemCode: line.MRITMNO,
        Quantity: toNumber(line.MRQTY, 0),
        WarehouseCode: line.MRWHS,
        Price: toNumber(line.Price, 0),
        BatchNumbers: buildBatchNumbers(line, 'MRBatch', 'MRQTY'),
      })),
    };

    console.log('[JobworkReceiptReturn] Posting /InventoryGenEntries (finished goods) payload:', JSON.stringify(payload, null, 2));

    try {
      const response = await sapService.request({ method: 'POST', url: '/InventoryGenEntries', data: payload });
      result.goodsReceipt = { docEntry: response.data.DocEntry, docNum: response.data.DocNum };
    } catch (error) {
      console.error('[JobworkReceiptReturn] Full SAP error response:', JSON.stringify(error.response?.data, null, 2));
      throw new Error(extractSapError(error, 'Failed to post the Goods Receipt (finished goods) for this Jobwork Receipt/Return Note.'));
    }
  }

  return result;
};

module.exports = {
  validateHeader,
  validateLines,
  postStockMovements,
  getConsumableIssues,
};
