const { getDocumentSeriesNumberPreview } = require('../services/documentSeriesNumberPreview');
const { resolveMarketingDocumentSeries } = require('../services/documentSeriesDbUtils');
const seriesDatabase = require('../services/dbService');
const serviceApCreditMemoService = require('../services/serviceApCreditMemoService');

const getErrorPayload = (error, fallbackMessage) => ({
  message: error.message || fallbackMessage,
  detail: error.response?.data || null,
});

const getReferenceData = async (req, res) => {
  try {
    res.json(await serviceApCreditMemoService.getReferenceData(req.query.company_id));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load Service A/P Credit Memo reference data.'));
  }
};

const getVendorDetails = async (req, res) => {
  try {
    res.json(await serviceApCreditMemoService.getVendorDetails(req.params.vendorCode));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load vendor details.'));
  }
};

const getVendorFilterOptions = async (req, res) => {
  try {
    res.json(await serviceApCreditMemoService.getVendorFilterOptions({
      query: req.query.query || '',
      vendorCode: req.query.vendorCode || '',
      vendorName: req.query.vendorName || '',
      top: req.query.top,
      display: req.query.display || 'code',
    }));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load vendor options.'));
  }
};

const getServiceAPCreditMemoList = async (req, res) => {
  try {
    res.json(await serviceApCreditMemoService.getServiceAPCreditMemoList(req.query));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load Service A/P Credit Memos.'));
  }
};

const getServiceAPCreditMemo = async (req, res) => {
  try {
    res.json(await serviceApCreditMemoService.getServiceAPCreditMemo(req.params.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load Service A/P Credit Memo.'));
  }
};

const submitServiceAPCreditMemo = async (req, res) => {
  try {
    res.json(await serviceApCreditMemoService.submitServiceAPCreditMemo(req.body));
  } catch (error) {
    res.status(error.response?.status || 500).json(getErrorPayload(error, 'Failed to submit Service A/P Credit Memo.'));
  }
};

const updateServiceAPCreditMemo = async (req, res) => {
  try {
    res.json(await serviceApCreditMemoService.updateServiceAPCreditMemo(req.params.docEntry, req.body));
  } catch (error) {
    res.status(error.response?.status || 500).json(getErrorPayload(error, 'Failed to update Service A/P Credit Memo.'));
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

const getOpenServiceAPInvoices = async (req, res) => {
  try {
    res.json(await serviceApCreditMemoService.getOpenServiceAPInvoices(req.query.vendorCode || null));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load service A/P invoices.'));
  }
};

const getServiceAPInvoiceForCopy = async (req, res) => {
  try {
    res.json(await serviceApCreditMemoService.getServiceAPInvoiceForCopy(req.params.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to copy service A/P invoice.'));
  }
};

module.exports = {
  getReferenceData,
  getVendorDetails,
  getVendorFilterOptions,
  getServiceAPCreditMemoList,
  getServiceAPCreditMemo,
  submitServiceAPCreditMemo,
  updateServiceAPCreditMemo,
  getDocumentSeries,
  getNextNumber,
  getOpenServiceAPInvoices,
  getServiceAPInvoiceForCopy,
};

