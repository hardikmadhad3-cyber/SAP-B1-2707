const { getDocumentSeriesNumberPreview } = require('../services/documentSeriesNumberPreview');
const { resolveMarketingDocumentSeries } = require('../services/documentSeriesDbUtils');
const seriesDatabase = require('../services/dbService');
const apCreditMemoService = require('../services/apCreditMemoService');

const getErrorPayload = (error, fallbackMessage) => ({
  detail:
    error.response?.data?.error?.message?.value ||
    error.response?.data?.error?.message ||
    error.response?.data ||
    error.message ||
    fallbackMessage,
});

const parseTopParam = (value) => {
  if (value == null || value === '') return undefined;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;

  return Math.floor(parsed);
};

const getReferenceData = async (req, res) => {
  try {
    res.json(await apCreditMemoService.getReferenceData(req.query.company_id));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load A/P Credit Memo reference data.'));
  }
};

const getVendorDetails = async (req, res) => {
  try {
    res.json(await apCreditMemoService.getVendorDetails(req.params.vendorCode));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load vendor details.'));
  }
};

const getVendorFilterOptions = async (req, res) => {
  try {
    res.json(await apCreditMemoService.getVendorFilterOptions({
      query: req.query.query,
      vendorCode: req.query.vendorCode,
      vendorName: req.query.vendorName,
      top: parseTopParam(req.query.top),
      display: req.query.display,
    }));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load vendor filter options.'));
  }
};

const getAPCreditMemos = async (req, res) => {
  try {
    const rawOpenOnly = req.query.openOnly;
    const openOnly = rawOpenOnly === undefined
      ? false
      : !['false', '0', 'no'].includes(String(rawOpenOnly).trim().toLowerCase());
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 25));
    res.json(await apCreditMemoService.getAPCreditMemoList({
      query: req.query.query,
      openOnly,
      docNum: req.query.docNum,
      vendorCode: req.query.vendorCode,
      vendorName: req.query.vendorName,
      status: req.query.status,
      postingDateFrom: req.query.postingDateFrom,
      postingDateTo: req.query.postingDateTo,
      page,
      pageSize,
    }));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load A/P Credit Memos.'));
  }
};

const getAPCreditMemoByDocEntry = async (req, res) => {
  try {
    res.json(await apCreditMemoService.getAPCreditMemo(req.params.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load A/P Credit Memo details.'));
  }
};

const submitAPCreditMemo = async (req, res) => {
  try {
    res.json(await apCreditMemoService.submitAPCreditMemo(req.body));
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ...getErrorPayload(error, 'Failed to submit A/P Credit Memo.'),
      validation: error.validation || null,
    });
  }
};

const updateAPCreditMemo = async (req, res) => {
  try {
    res.json(await apCreditMemoService.updateAPCreditMemo(req.params.docEntry, req.body));
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ...getErrorPayload(error, 'Failed to update A/P Credit Memo.'),
      validation: error.validation || null,
    });
  }
};

const getDocumentSeries = async (req, res) => {
  try {
    const data = await resolveMarketingDocumentSeries({ db: seriesDatabase, objectCode: '19', targetDate: req.query.date, branch: req.query.branch || '', docSubType: req.query.docSubType, transactionType: req.query.transactionType });
    res.json(data);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message, error: error.message, code: error.code || 'SAP_DOCUMENT_SERIES' });
  }
};

const getNextNumber = async (req, res) => {
  try {
    res.json(await getDocumentSeriesNumberPreview({ db: seriesDatabase, objectCode: '19', seriesId: req.query.series ?? req.params.series,
      targetDate: req.query.date || req.query.postingDate || req.query.targetDate, branch: req.query.branch || '',
      docSubType: req.query.docSubType, transactionType: req.query.transactionType }));
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message, error: error.message, code: error.code || 'SAP_DOCUMENT_SERIES' });
  }
};

const getStateFromWarehouse = async (req, res) => {
  try {
    res.json(await apCreditMemoService.getStateFromWarehouse(req.params.whsCode));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to get state from warehouse.'));
  }
};

const getOpenGRPO = async (req, res) => {
  try {
    res.json(await apCreditMemoService.getOpenGRPO(req.query.vendorCode || req.query.vendor || null));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load open GRPOs.'));
  }
};

const getGRPOForCopy = async (req, res) => {
  try {
    res.json(await apCreditMemoService.getGRPOForCopy(req.params.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load GRPO.'));
  }
};

const getItemsForModal = async (req, res) => {
  try {
    res.json(await apCreditMemoService.getItemsForModal());
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load items.'));
  }
};

const getFreightCharges = async (req, res) => {
  try {
    res.json(await apCreditMemoService.getFreightCharges(req.query.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load freight charges.'));
  }
};

module.exports = {
  getReferenceData,
  getVendorDetails,
  getVendorFilterOptions,
  getAPCreditMemos,
  getAPCreditMemoByDocEntry,
  submitAPCreditMemo,
  updateAPCreditMemo,
  getDocumentSeries,
  getNextNumber,
  getStateFromWarehouse,
  getOpenGRPO,
  getGRPOForCopy,
  getItemsForModal,
  getFreightCharges,
};
