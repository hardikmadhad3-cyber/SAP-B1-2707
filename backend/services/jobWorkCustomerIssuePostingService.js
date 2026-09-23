/**
 * Business logic specific to the Customer Issue / Return Note (Sales J/W)
 * transaction — mirrors jobWorkCustomerReceiptPostingService.js's role for
 * the Customer Receipt Note, but material goes back OUT to the customer
 * (or is being returned) here, so this posts a real Inventory Goods Issue
 * rather than a Goods Receipt. STTL_JWSR10 only ever carries a single
 * Warehouse per line, same as the Receipt Note's STTL_JWS12.
 */
const sapService = require('./sapService');
const jobWorkDb = require('./jobWorkDbService');

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
  if (!String(header.CCode || '').trim()) {
    throw new Error('Customer is required.');
  }
  if (branches.length && !String(header.JWBranch || '').trim()) {
    throw new Error('Branch is required.');
  }
};

const isBinEnabled = (warehousesByCode, whsCode) => {
  const warehouse = warehousesByCode.get(String(whsCode || '').trim());
  return String(warehouse?.BinEnabled || '').trim().toUpperCase() === 'Y';
};

/**
 * @param {Array} lines - raw STTL_JWSR10 rows from the request payload.
 * @param {Map<string,object>} itemsByCode - ItemCode -> reference-data item row (for the batch-managed check).
 * @param {Map<string,object>} warehousesByCode - WhsCode -> reference-data warehouse row (for the bin-managed check).
 */
const validateLines = (lines, itemsByCode = new Map(), warehousesByCode = new Map()) => {
  const activeLines = (lines || []).filter((line) => String(line?.ICode || '').trim());

  if (!activeLines.length) {
    throw new Error('Add at least one material line before saving.');
  }

  activeLines.forEach((line, index) => {
    const rowLabel = `Line ${index + 1}`;
    if (!String(line.ICode || '').trim()) {
      throw new Error(`${rowLabel}: Item Code is required.`);
    }
    if (toNumber(line.Qty, 0) <= 0) {
      throw new Error(`${rowLabel}: Quantity must be greater than zero.`);
    }
    if (!String(line.WhsCode || '').trim()) {
      throw new Error(`${rowLabel}: Warehouse is required.`);
    }

    const item = itemsByCode.get(String(line.ICode || '').trim());
    const isBatchManaged = String(item?.BatchManaged || '').trim().toUpperCase() === 'Y';
    const hasBatchAllocation = (Array.isArray(line.batches) && line.batches.length > 0) || String(line.Batch || '').trim();
    if (isBatchManaged && !hasBatchAllocation) {
      throw new Error(`${rowLabel}: Item ${line.ICode} is batch-managed — at least one Batch allocation is required.`);
    }

    if (isBinEnabled(warehousesByCode, line.WhsCode) && !String(line.BinCode || '').trim()) {
      throw new Error(`${rowLabel}: Warehouse ${line.WhsCode} requires a Bin Location.`);
    }
  });

  return activeLines;
};

/**
 * Posts the real stock movement this Issue/Return Note represents: a single
 * Inventory Goods Issue covering all material lines (material going back out
 * to — or being returned to — the customer after job work).
 */
const postStockMovements = async ({ header = {}, lines = [] }) => {
  const activeLines = lines.filter((line) => String(line?.ICode || '').trim());
  const result = { goodsIssue: null };

  if (!activeLines.length) {
    return result;
  }

  const comments = `Customer Issue / Return Note - ${header.CName || header.CCode || ''}`.trim();
  const postingDate = toIsoDate(header.PDate) || toIsoDate(header.DocDate);
  const documentDate = toIsoDate(header.DocDate) || postingDate;

  // Same bin-allocation gap fixed on the Receipt Note side: validateLines()
  // requires a BinCode for a bin-managed warehouse, but it must actually be
  // sent to SAP as a real BinAllocations entry, not just validated and
  // dropped. BinActionType is 'batFromWarehouse' here (stock LEAVING the
  // bin) — the opposite of the Receipt Note's 'batToWarehouse'.
  const binEntryByWarehouse = new Map();
  await Promise.all(
    [...new Set(activeLines.map((line) => String(line.WhsCode || '').trim()).filter(Boolean))].map(async (whsCode) => {
      const bins = await jobWorkDb.getBinsByWarehouse('customerIssueReturnNote', whsCode).catch(() => []);
      binEntryByWarehouse.set(whsCode, new Map(bins.map((bin) => [String(bin.BinCode || '').trim(), Number(bin.BinAbsEntry)])));
    }),
  );

  const buildBinAllocations = (line) => {
    const binCode = String(line.BinCode || '').trim();
    if (!binCode) return undefined;
    const binAbsEntry = binEntryByWarehouse.get(String(line.WhsCode || '').trim())?.get(binCode);
    if (!Number.isFinite(binAbsEntry)) return undefined;
    return [{ BinAbsEntry: binAbsEntry, Quantity: toNumber(line.Qty, 0), BinActionType: 'batFromWarehouse' }];
  };

  // Goods Issue consumes EXISTING batches (picked via the same "available
  // batches on hand" lookup the standalone Goods Issue module uses) rather
  // than creating new ones — so, matching goodsIssueService.js's own proven
  // /InventoryGenExits BatchNumbers shape exactly, only BatchNumber and
  // Quantity are sent. No ExpiryDate/ManufacturingDate: those belong to the
  // batch's original receipt, not to consuming it, and the Receipt Note's
  // ODBC -1029 ShipDate saga confirmed extra unsupported fields on this kind
  // of object get silently misattributed to unrelated errors — don't guess
  // at more fields than the proven-working reference actually sends.
  const buildBatchNumbers = (line) => {
    if (Array.isArray(line.batches) && line.batches.length) {
      return line.batches
        .filter((batch) => String(batch?.batchNumber || '').trim())
        .map((batch) => ({
          BatchNumber: String(batch.batchNumber).trim(),
          Quantity: toNumber(batch.quantity, 0),
        }));
    }
    return String(line.Batch || '').trim()
      ? [{ BatchNumber: String(line.Batch).trim(), Quantity: toNumber(line.Qty, 0) }]
      : undefined;
  };

  const payload = {
    DocDate: postingDate,
    TaxDate: documentDate,
    Comments: comments,
    JournalMemo: 'Customer Issue / Return Note',
    // Deliberately NOT setting CardCode — confirmed on the Receipt Note's own
    // /InventoryGenEntries call that setting a customer CardCode on a plain
    // inventory document (no real concept of "customer" at the DB level)
    // causes SAP to misfire on an unrelated field. The real customer link is
    // preserved on the linked UDO paperwork document and in Comments above.
    ...(String(header.JWBranch || '').trim() ? { BPL_IDAssignedToInvoice: Number(header.JWBranch) } : {}),
    ...(String(header.GoodsIssueSeries || '').trim() ? { Series: Number(header.GoodsIssueSeries) } : {}),
    DocumentLines: activeLines.map((line) => ({
      ItemCode: line.ICode,
      Quantity: toNumber(line.Qty, 0),
      WarehouseCode: line.WhsCode,
      Price: toNumber(line.Rate, 0),
      BatchNumbers: buildBatchNumbers(line),
      DocumentLinesBinAllocations: buildBinAllocations(line),
    })),
  };

  console.log('[CustomerIssueReturnNote] Posting /InventoryGenExits payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await sapService.request({ method: 'POST', url: '/InventoryGenExits', data: payload });
    result.goodsIssue = { docEntry: response.data.DocEntry, docNum: response.data.DocNum, series: response.data.Series };
  } catch (error) {
    console.error('[CustomerIssueReturnNote] Full SAP error response:', JSON.stringify(error.response?.data, null, 2));
    throw new Error(extractSapError(error, 'Failed to post the Inventory Goods Issue for this Customer Issue / Return Note.'));
  }

  return result;
};

module.exports = {
  validateHeader,
  validateLines,
  postStockMovements,
};
