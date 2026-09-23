/**
 * Business logic specific to the Jobwork Issue Note (Purchase J/W) transaction —
 * the validations and real inventory postings the legacy add-on performs in
 * JW_Pur.b1f.cs on save, which the generic UDO write in jobWorkService.js does
 * not cover on its own (it only persists the STTL_JWPM paperwork document).
 *
 * Legacy behaviour (JW_Pur.b1f.cs):
 *  - Vendor is mandatory (:719 "Cardcode is Missing").
 *  - Each material line needs an Item Code and Warehouse (:1550/:1562), and a
 *    batch number if the item is batch-managed (:1568/:1574).
 *  - On save the form posts a Stock Transfer (oStockTransfer) for lines moving
 *    between the company's own warehouses (From Whs + To Whs both set), and/or
 *    a Goods Issue (oInventoryGenExit) for lines where material is leaving to
 *    the job worker (To Whs left blank).
 */
const sapService = require('./sapService');

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

/** @param {Array} branches - reference-data branches list; only non-empty when Business Places is enabled for this company. */
const validateHeader = (header = {}, branches = []) => {
  if (!String(header.VENCOD || '').trim()) {
    throw new Error('Vendor is required.');
  }
  if (branches.length && !String(header.BRNCH || '').trim()) {
    throw new Error('Branch is required.');
  }
};

/**
 * @param {Array} lines - raw STTL_JWP6 rows from the request payload.
 * @param {Map<string,object>} itemsByCode - ItemCode -> reference-data item row (for the batch-managed check).
 * @param {Map<string,object>} warehousesByCode - WhsCode -> reference-data warehouse row (for the bin-managed check).
 */
const isBinEnabled = (warehousesByCode, whsCode) => {
  const warehouse = warehousesByCode.get(String(whsCode || '').trim());
  return String(warehouse?.BinEnabled || '').trim().toUpperCase() === 'Y';
};

const validateLines = (lines, itemsByCode = new Map(), warehousesByCode = new Map()) => {
  const activeLines = (lines || []).filter((line) => String(line?.MITMNO || '').trim());

  if (!activeLines.length) {
    throw new Error('Add at least one material line before saving.');
  }

  activeLines.forEach((line, index) => {
    const rowLabel = `Line ${index + 1}`;
    if (!String(line.MITMNO || '').trim()) {
      throw new Error(`${rowLabel}: Item Code is required.`);
    }
    if (toNumber(line.MQTY, 0) <= 0) {
      throw new Error(`${rowLabel}: Quantity must be greater than zero.`);
    }
    if (!String(line.MWHS || '').trim()) {
      throw new Error(`${rowLabel}: Warehouse is required.`);
    }

    const item = itemsByCode.get(String(line.MITMNO || '').trim());
    const isBatchManaged = String(item?.BatchManaged || '').trim().toUpperCase() === 'Y';
    const hasBatchAllocation = (Array.isArray(line.batches) && line.batches.length > 0) || String(line.MBatch || '').trim();
    if (isBatchManaged && !hasBatchAllocation) {
      throw new Error(`${rowLabel}: Item ${line.MITMNO} is batch-managed — at least one Batch allocation is required.`);
    }

    if (isBinEnabled(warehousesByCode, line.MWHS) && !String(line.MBinCode || '').trim()) {
      throw new Error(`${rowLabel}: Warehouse ${line.MWHS} requires a Bin Location.`);
    }
    if (String(line.TWHS || '').trim() && isBinEnabled(warehousesByCode, line.TWHS) && !String(line.ToBinCode || '').trim()) {
      throw new Error(`${rowLabel}: To Warehouse ${line.TWHS} requires a To Bin Location.`);
    }
  });

  return activeLines;
};

/**
 * Posts the real stock movement(s) this Issue Note represents: lines with a
 * "To Warehouse" move as an Inventory Transfer between own warehouses; lines
 * without one post as a Goods Issue (material leaving to the job worker).
 * Mirrors JW_Pur.b1f.cs's split between oStockTransfer and oInventoryGenExit.
 */
const postStockMovements = async ({ header = {}, lines = [] }) => {
  const activeLines = lines.filter((line) => String(line?.MITMNO || '').trim());
  const transferLines = activeLines.filter((line) => String(line.TWHS || '').trim());
  const issueLines = activeLines.filter((line) => !String(line.TWHS || '').trim());

  const comments = `Job Work Issue Note - ${header.VENNAME || header.VENCOD || ''}`.trim();
  const docDate = toIsoDate(header.DOCDATE);
  const result = { inventoryTransfer: null, goodsIssue: null };

  // A line can span multiple batches (frontend's multi-batch allocation modal,
  // same as Goods Issue) — each becomes its own BatchNumbers entry so SAP splits
  // the posting across all selected batches. Falls back to the single MBatch
  // field for lines that only ever had one batch typed in directly.
  const buildBatchNumbers = (line) => {
    if (Array.isArray(line.batches) && line.batches.length) {
      return line.batches
        .filter((batch) => String(batch?.batchNumber || '').trim())
        .map((batch) => ({
          BatchNumber: String(batch.batchNumber).trim(),
          Quantity: toNumber(batch.quantity, 0),
        }));
    }
    return String(line.MBatch || '').trim()
      ? [{ BatchNumber: String(line.MBatch).trim(), Quantity: toNumber(line.MQTY, 0) }]
      : undefined;
  };

  if (transferLines.length) {
    const payload = {
      DocDate: docDate,
      Comments: comments,
      JournalMemo: 'Job Work Issue Note',
      // SAP's StockTransfers document needs its own header-level From/To
      // Warehouse in addition to the per-line ones (confirmed against the
      // working Inventory Transfer module) — without them, the posted
      // transfer ends up using the same warehouse on both sides regardless
      // of what each line specifies.
      FromWarehouse: transferLines[0].MWHS,
      ToWarehouse: transferLines[0].TWHS,
      // Carries the Job Work vendor onto the Inventory Transfer so it's visible
      // on the transfer itself, not just traceable back through the Job Work doc.
      ...(String(header.VENCOD || '').trim() ? { CardCode: String(header.VENCOD).trim() } : {}),
      StockTransferLines: transferLines.map((line) => ({
        ItemCode: line.MITMNO,
        Quantity: toNumber(line.MQTY, 0),
        FromWarehouseCode: line.MWHS,
        WarehouseCode: line.TWHS,
        BatchNumbers: buildBatchNumbers(line),
      })),
    };

    try {
      const response = await sapService.request({ method: 'POST', url: '/StockTransfers', data: payload });
      result.inventoryTransfer = { docEntry: response.data.DocEntry, docNum: response.data.DocNum };
    } catch (error) {
      throw new Error(extractSapError(error, 'Failed to post the Inventory Transfer for this Jobwork Issue Note.'));
    }
  }

  if (issueLines.length) {
    const payload = {
      DocDate: docDate,
      Comments: comments,
      JournalMemo: 'Job Work Issue Note',
      DocumentLines: issueLines.map((line) => ({
        ItemCode: line.MITMNO,
        Quantity: toNumber(line.MQTY, 0),
        WarehouseCode: line.MWHS,
        Price: toNumber(line.Rate, 0),
        BatchNumbers: buildBatchNumbers(line),
      })),
    };

    try {
      const response = await sapService.request({ method: 'POST', url: '/InventoryGenExits', data: payload });
      result.goodsIssue = { docEntry: response.data.DocEntry, docNum: response.data.DocNum };
    } catch (error) {
      throw new Error(extractSapError(error, 'Failed to post the Goods Issue for this Jobwork Issue Note.'));
    }
  }

  return result;
};

module.exports = {
  validateHeader,
  validateLines,
  postStockMovements,
};
