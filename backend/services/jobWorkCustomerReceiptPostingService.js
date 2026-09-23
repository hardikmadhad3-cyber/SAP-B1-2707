/**
 * Business logic specific to the Customer Receipt Note (Sales J/W) transaction —
 * mirrors jobWorkIssueNotePostingService.js's role for Jobwork Issue Note, but
 * for the sales-side counterpart: material comes back IN from the customer
 * after job work, so this posts a real Inventory Goods Receipt rather than a
 * Stock Transfer / Goods Issue. Unlike the Issue Note's STTL_JWP6 lines,
 * STTL_JWS12 only ever carries a single Warehouse per line (no From/To split),
 * since a receipt only ever has one destination.
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
 * @param {Array} lines - raw STTL_JWS12 rows from the request payload.
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
 * Posts the real stock movement this Receipt Note represents: a single
 * Inventory Goods Receipt covering all material lines (material returning
 * from the customer after job work).
 */
const postStockMovements = async ({ header = {}, lines = [] }) => {
  const activeLines = lines.filter((line) => String(line?.ICode || '').trim());
  const result = { goodsReceipt: null };

  if (!activeLines.length) {
    return result;
  }

  const comments = `Customer Receipt Note - ${header.CName || header.CCode || ''}`.trim();
  const postingDate = toIsoDate(header.PDate) || toIsoDate(header.DocDate);
  const documentDate = toIsoDate(header.DocDate) || postingDate;

  // validateLines() requires a BinCode for any line on a bin-managed warehouse,
  // but that BinCode was never actually sent to SAP — a real bug independent of
  // the ShipDate/ODBC -1029 error below, worth keeping fixed regardless. NOTE:
  // every reproduction of that ODBC error so far has had an empty line.BinCode,
  // so this fix has never actually been exercised against it — it is NOT a
  // confirmed cause, just a separate gap found while investigating.
  const binEntryByWarehouse = new Map();
  await Promise.all(
    [...new Set(activeLines.map((line) => String(line.WhsCode || '').trim()).filter(Boolean))].map(async (whsCode) => {
      const bins = await jobWorkDb.getBinsByWarehouse('customerReceiptNote', whsCode).catch(() => []);
      binEntryByWarehouse.set(whsCode, new Map(bins.map((bin) => [String(bin.BinCode || '').trim(), Number(bin.BinAbsEntry)])));
    }),
  );

  const buildBinAllocations = (line) => {
    const binCode = String(line.BinCode || '').trim();
    if (!binCode) return undefined;
    const binAbsEntry = binEntryByWarehouse.get(String(line.WhsCode || '').trim())?.get(binCode);
    if (!Number.isFinite(binAbsEntry)) return undefined;
    return [{ BinAbsEntry: binAbsEntry, Quantity: toNumber(line.Qty, 0), BinActionType: 'batToWarehouse' }];
  };

  // A line can span multiple batches — each becomes its own BatchNumbers
  // entry so SAP splits the receipt across all selected/created batches.
  // Falls back to the single Batch field for any legacy row that only ever
  // had one batch typed in directly (pre multi-batch-modal rows). Matches
  // goodsReceiptService.js's own proven-working /InventoryGenEntries
  // BatchNumbers shape exactly: BatchNumber + Quantity always, ExpiryDate
  // only when the user actually supplied one (never force-defaulted), and
  // no ManufacturingDate at all — that field was a guess in an earlier fix
  // attempt for this same ODBC -1029 error and was never actually confirmed
  // against a real SAP response; the working reference never sends it.
  const buildBatchNumbers = (line) => {
    if (Array.isArray(line.batches) && line.batches.length) {
      return line.batches
        .filter((batch) => String(batch?.batchNumber || '').trim())
        .map((batch) => {
          const entry = {
            BatchNumber: String(batch.batchNumber).trim(),
            Quantity: toNumber(batch.quantity, 0),
          };
          if (batch.expiryDate) {
            entry.ExpiryDate = toIsoDate(batch.expiryDate);
          }
          return entry;
        });
    }
    return String(line.Batch || '').trim()
      ? [{ BatchNumber: String(line.Batch).trim(), Quantity: toNumber(line.Qty, 0) }]
      : undefined;
  };

  const payload = {
    DocDate: postingDate,
    TaxDate: documentDate,
    Comments: comments,
    JournalMemo: 'Customer Receipt Note',
    // Deliberately NOT setting CardCode here. goodsReceiptService.js's own
    // proven-working /InventoryGenEntries payload never sets it either, and a
    // side-by-side test proved every batch/date/bin field was a red herring —
    // this was the one remaining structural difference. ShipDate is
    // fundamentally a delivery/shipment-to-customer concept; setting CardCode
    // on a plain Inventory Entry likely makes SAP treat it as customer-linked
    // internally and try to populate that field, which this object doesn't
    // actually support at the DB level — hence the ODBC -1029 error on it
    // regardless of what we do to BatchNumbers/ShipDate ourselves. The real
    // customer link is preserved elsewhere: the linked UDO paperwork document
    // stores CCode/CName properly, and Comments above already names them.
    ...(String(header.JWBranch || '').trim() ? { BPL_IDAssignedToInvoice: Number(header.JWBranch) } : {}),
    ...(String(header.GoodsReceiptSeries || '').trim() ? { Series: Number(header.GoodsReceiptSeries) } : {}),
    DocumentLines: activeLines.map((line) => ({
      ItemCode: line.ICode,
      Quantity: toNumber(line.Qty, 0),
      WarehouseCode: line.WhsCode,
      Price: toNumber(line.Price, 0),
      // Confirmed via a live SAP error response: explicitly setting ShipDate
      // does NOT avoid the "[DocumentLines.ShipDate] Field cannot be updated
      // (ODBC -1029)" error — SAP rejects it identically whether it's sent or
      // left out, so this is a read-only/system field on this object and
      // should not be set at all. Do not re-add this.
      ...(String(line.AccountCode || '').trim() ? { AccountCode: String(line.AccountCode).trim() } : {}),
      BatchNumbers: buildBatchNumbers(line),
      DocumentLinesBinAllocations: buildBinAllocations(line),
    })),
  };

  console.log('[CustomerReceiptNote] Posting /InventoryGenEntries payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await sapService.request({ method: 'POST', url: '/InventoryGenEntries', data: payload });
    result.goodsReceipt = { docEntry: response.data.DocEntry, docNum: response.data.DocNum, series: response.data.Series };
  } catch (error) {
    // Two prior attempts at this exact ODBC -1029 ShipDate error (bin allocation,
    // then an explicit ShipDate) didn't resolve it — the message string alone was
    // never enough to diagnose it. Logging the full raw SAP response here (not just
    // the shortened message extractSapError pulls out below) so the next failure
    // has everything needed instead of guessing again.
    console.error('[CustomerReceiptNote] Full SAP error response:', JSON.stringify(error.response?.data, null, 2));
    throw new Error(extractSapError(error, 'Failed to post the Inventory Goods Receipt for this Customer Receipt Note.'));
  }

  return result;
};

module.exports = {
  validateHeader,
  validateLines,
  postStockMovements,
};
