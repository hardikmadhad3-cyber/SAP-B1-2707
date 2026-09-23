const { getDocumentSeriesNumberPreview } = require('../services/documentSeriesNumberPreview');
const { resolveMarketingDocumentSeries } = require('../services/documentSeriesDbUtils');
const seriesDatabase = require('../services/dbService');
const serviceArInvoiceService = require('../services/serviceArInvoiceService');

const getErrorPayload = (error, fallbackMessage) => ({
  message: error.message || fallbackMessage,
  detail: error.response?.data || null,
});

const getReferenceData = async (req, res) => {
  try {
    const data = await serviceArInvoiceService.getReferenceData(req.query.company_id, req.auth?.userId);
    res.json(data);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load Service A/R Invoice reference data.'));
  }
};

const getCustomerDetails = async (req, res) => {
  try {
    res.json(await serviceArInvoiceService.getCustomerDetails(req.params.customerCode));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load customer details.'));
  }
};

const getCustomerFilterOptions = async (req, res) => {
  try {
    res.json(await serviceArInvoiceService.getCustomerFilterOptions({
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

const getServiceARInvoiceList = async (req, res) => {
  try {
    res.json(await serviceArInvoiceService.getServiceARInvoiceList(req.query));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load Service A/R Invoices.'));
  }
};

const getServiceARInvoice = async (req, res) => {
  try {
    res.json(await serviceArInvoiceService.getServiceARInvoice(req.params.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load Service A/R Invoice.'));
  }
};

const submitServiceARInvoice = async (req, res) => {
  try {
    res.json(await serviceArInvoiceService.submitServiceARInvoice(req.body));
  } catch (error) {
    res.status(error.response?.status || 500).json(getErrorPayload(error, 'Failed to submit Service A/R Invoice.'));
  }
};

const updateServiceARInvoice = async (req, res) => {
  try {
    res.json(await serviceArInvoiceService.updateServiceARInvoice(req.params.docEntry, req.body));
  } catch (error) {
    res.status(error.response?.status || 500).json(getErrorPayload(error, 'Failed to update Service A/R Invoice.'));
  }
};

const getDocumentSeries = async (req, res) => {
  try {
    const data = await resolveMarketingDocumentSeries({ db: seriesDatabase, objectCode: '13', targetDate: req.query.date, branch: req.query.branch || '', docSubType: req.query.docSubType, transactionType: req.query.transactionType });
    res.json(data);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message, error: error.message, code: error.code || 'SAP_DOCUMENT_SERIES' });
  }
};

const getNextNumber = async (req, res) => {
  try {
    res.json(await getDocumentSeriesNumberPreview({ db: seriesDatabase, objectCode: '13', seriesId: req.query.series ?? req.params.series,
      targetDate: req.query.date || req.query.postingDate || req.query.targetDate, branch: req.query.branch || '',
      docSubType: req.query.docSubType, transactionType: req.query.transactionType }));
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message, error: error.message, code: error.code || 'SAP_DOCUMENT_SERIES' });
  }
};

const getOpenServiceSalesQuotations = async (req, res) => {
  try {
    res.json(await serviceArInvoiceService.getOpenServiceSalesQuotations(req.query.customerCode || null));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load service sales quotations.'));
  }
};

const getOpenServiceSalesOrders = async (req, res) => {
  try {
    res.json(await serviceArInvoiceService.getOpenServiceSalesOrders(req.query.customerCode || null));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load service sales orders.'));
  }
};

const getOpenServiceDeliveries = async (req, res) => {
  try {
    res.json(await serviceArInvoiceService.getOpenServiceDeliveries(req.query.customerCode || null));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load service deliveries.'));
  }
};

const getServiceSalesQuotationForCopy = async (req, res) => {
  try {
    res.json(await serviceArInvoiceService.getServiceSalesQuotationForCopy(req.params.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to copy service sales quotation.'));
  }
};

const getServiceSalesOrderForCopy = async (req, res) => {
  try {
    res.json(await serviceArInvoiceService.getServiceSalesOrderForCopy(req.params.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to copy service sales order.'));
  }
};

const getServiceDeliveryForCopy = async (req, res) => {
  try {
    res.json(await serviceArInvoiceService.getServiceDeliveryForCopy(req.params.docEntry));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to copy service delivery.'));
  }
};

module.exports = {
  getReferenceData,
  getCustomerDetails,
  getCustomerFilterOptions,
  getServiceARInvoiceList,
  getServiceARInvoice,
  submitServiceARInvoice,
  updateServiceARInvoice,
  getDocumentSeries,
  getNextNumber,
  getOpenServiceSalesQuotations,
  getOpenServiceSalesOrders,
  getOpenServiceDeliveries,
  getServiceSalesQuotationForCopy,
  getServiceSalesOrderForCopy,
  getServiceDeliveryForCopy,
};
