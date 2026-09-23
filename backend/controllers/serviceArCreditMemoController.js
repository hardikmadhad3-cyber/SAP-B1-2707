const { getDocumentSeriesNumberPreview } = require('../services/documentSeriesNumberPreview');
const { resolveMarketingDocumentSeries } = require('../services/documentSeriesDbUtils');
const seriesDatabase = require('../services/dbService');
const serviceArCreditMemoService = require('../services/serviceArCreditMemoService');

const getErrorPayload = (error, fallbackMessage) => ({
  message: error.message || fallbackMessage,
  detail: error.response?.data || null,
});

const getReferenceData = async (req, res) => {
  try {
    res.json(await serviceArCreditMemoService.getReferenceData(req.query.company_id));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load Service A/R Credit Memo reference data.'));
  }
};

const getCustomerDetails = async (req, res) => {
  try {
    res.json(await serviceArCreditMemoService.getCustomerDetails(req.params.customerCode));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load customer details.'));
  }
};

const getCustomerFilterOptions = async (req, res) => {
  try {
    res.json(await serviceArCreditMemoService.getCustomerFilterOptions({
      query: req.query.query || '',
      customerCode: req.query.customerCode || '',
      customerName: req.query.customerName || '',
      top: req.query.top,
      display: req.query.display || 'code',
    }));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load customer options.'));
  }
};

const getServiceARCreditMemoList = async (req, res) => {
  try {
    res.json(await serviceArCreditMemoService.getServiceARCreditMemoList(req.query));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load Service A/R Credit Memos.'));
  }
};

const getServiceARCreditMemo = async (req, res) => {
  try {
    res.json(await serviceArCreditMemoService.getServiceARCreditMemo(req.params.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load Service A/R Credit Memo.'));
  }
};

const submitServiceARCreditMemo = async (req, res) => {
  try {
    res.json(await serviceArCreditMemoService.submitServiceARCreditMemo(req.body));
  } catch (error) {
    res.status(error.response?.status || 500).json(getErrorPayload(error, 'Failed to submit Service A/R Credit Memo.'));
  }
};

const updateServiceARCreditMemo = async (req, res) => {
  try {
    res.json(await serviceArCreditMemoService.updateServiceARCreditMemo(req.params.docEntry, req.body));
  } catch (error) {
    res.status(error.response?.status || 500).json(getErrorPayload(error, 'Failed to update Service A/R Credit Memo.'));
  }
};

const getDocumentSeries = async (req, res) => {
  try {
    const data = await resolveMarketingDocumentSeries({ db: seriesDatabase, objectCode: '14', targetDate: req.query.date, branch: req.query.branch || '', docSubType: req.query.docSubType, transactionType: req.query.transactionType });
    res.json(data);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message, error: error.message, code: error.code || 'SAP_DOCUMENT_SERIES' });
  }
};

const getNextNumber = async (req, res) => {
  try {
    res.json(await getDocumentSeriesNumberPreview({ db: seriesDatabase, objectCode: '14', seriesId: req.query.series ?? req.params.series,
      targetDate: req.query.date || req.query.postingDate || req.query.targetDate, branch: req.query.branch || '',
      docSubType: req.query.docSubType, transactionType: req.query.transactionType }));
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message, error: error.message, code: error.code || 'SAP_DOCUMENT_SERIES' });
  }
};

const getOpenServiceARInvoices = async (req, res) => {
  try {
    res.json(await serviceArCreditMemoService.getOpenServiceARInvoices(req.query.customerCode || null));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load service A/R invoices.'));
  }
};

const getServiceARInvoiceForCopy = async (req, res) => {
  try {
    res.json(await serviceArCreditMemoService.getServiceARInvoiceForCopy(req.params.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to copy service A/R invoice.'));
  }
};

module.exports = {
  getReferenceData,
  getCustomerDetails,
  getCustomerFilterOptions,
  getServiceARCreditMemoList,
  getServiceARCreditMemo,
  submitServiceARCreditMemo,
  updateServiceARCreditMemo,
  getDocumentSeries,
  getNextNumber,
  getOpenServiceARInvoices,
  getServiceARInvoiceForCopy,
};

