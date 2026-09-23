const { getDocumentSeriesNumberPreview } = require('../services/documentSeriesNumberPreview');
const { resolveMarketingDocumentSeries } = require('../services/documentSeriesDbUtils');
const seriesDatabase = require('../services/dbService');
const serviceApInvoiceService = require('../services/serviceApInvoiceService');

const getErrorPayload = (error, fallbackMessage) => ({
  message: error.message || fallbackMessage,
  detail: error.response?.data || null,
});

const getReferenceData = async (req, res) => {
  try {
    res.json(await serviceApInvoiceService.getReferenceData(req.query.company_id));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load Service A/P Invoice reference data.'));
  }
};

const getVendorDetails = async (req, res) => {
  try {
    res.json(await serviceApInvoiceService.getVendorDetails(req.params.vendorCode));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load vendor details.'));
  }
};

const getVendorFilterOptions = async (req, res) => {
  try {
    res.json(await serviceApInvoiceService.getVendorFilterOptions({
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

const getServiceAPInvoiceList = async (req, res) => {
  try {
    res.json(await serviceApInvoiceService.getServiceAPInvoiceList(req.query));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load Service A/P Invoices.'));
  }
};

const getServiceAPInvoice = async (req, res) => {
  try {
    res.json(await serviceApInvoiceService.getServiceAPInvoice(req.params.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load Service A/P Invoice.'));
  }
};

const submitServiceAPInvoice = async (req, res) => {
  try {
    res.json(await serviceApInvoiceService.submitServiceAPInvoice(req.body));
  } catch (error) {
    res.status(error.response?.status || 500).json(getErrorPayload(error, 'Failed to submit Service A/P Invoice.'));
  }
};

const updateServiceAPInvoice = async (req, res) => {
  try {
    res.json(await serviceApInvoiceService.updateServiceAPInvoice(req.params.docEntry, req.body));
  } catch (error) {
    res.status(error.response?.status || 500).json(getErrorPayload(error, 'Failed to update Service A/P Invoice.'));
  }
};

const getDocumentSeries = async (req, res) => {
  try {
    const data = await resolveMarketingDocumentSeries({ db: seriesDatabase, objectCode: '18', targetDate: req.query.date, branch: req.query.branch || '', docSubType: req.query.docSubType, transactionType: req.query.transactionType });
    res.json(data);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message, error: error.message, code: error.code || 'SAP_DOCUMENT_SERIES' });
  }
};

const getNextNumber = async (req, res) => {
  try {
    res.json(await getDocumentSeriesNumberPreview({ db: seriesDatabase, objectCode: '18', seriesId: req.query.series ?? req.params.series,
      targetDate: req.query.date || req.query.postingDate || req.query.targetDate, branch: req.query.branch || '',
      docSubType: req.query.docSubType, transactionType: req.query.transactionType }));
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message, error: error.message, code: error.code || 'SAP_DOCUMENT_SERIES' });
  }
};

const getOpenServicePurchaseQuotations = async (req, res) => {
  try {
    res.json(await serviceApInvoiceService.getOpenServicePurchaseQuotations(req.query.vendorCode || null));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load service purchase quotations.'));
  }
};

const getOpenServicePurchaseOrders = async (req, res) => {
  try {
    res.json(await serviceApInvoiceService.getOpenServicePurchaseOrders(req.query.vendorCode || null));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load service purchase orders.'));
  }
};

const getOpenServiceGRPO = async (req, res) => {
  try {
    res.json(await serviceApInvoiceService.getOpenServiceGRPO(req.query.vendorCode || null));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load service GRPOs.'));
  }
};

const getServicePurchaseQuotationForCopy = async (req, res) => {
  try {
    res.json(await serviceApInvoiceService.getServicePurchaseQuotationForCopy(req.params.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to copy service purchase quotation.'));
  }
};

const getServicePurchaseOrderForCopy = async (req, res) => {
  try {
    res.json(await serviceApInvoiceService.getServicePurchaseOrderForCopy(req.params.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to copy service purchase order.'));
  }
};

const getServiceGRPOForCopy = async (req, res) => {
  try {
    res.json(await serviceApInvoiceService.getServiceGRPOForCopy(req.params.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to copy service GRPO.'));
  }
};

module.exports = {
  getReferenceData,
  getVendorDetails,
  getVendorFilterOptions,
  getServiceAPInvoiceList,
  getServiceAPInvoice,
  submitServiceAPInvoice,
  updateServiceAPInvoice,
  getDocumentSeries,
  getNextNumber,
  getOpenServicePurchaseQuotations,
  getOpenServicePurchaseOrders,
  getOpenServiceGRPO,
  getServicePurchaseQuotationForCopy,
  getServicePurchaseOrderForCopy,
  getServiceGRPOForCopy,
};
