const jobWorkService = require('../services/jobWorkService');
const jobWorkProvisioningService = require('../services/jobWorkProvisioningService');
const { TRANSACTIONS } = require('../services/jobWorkSchema');

const getErrorPayload = (error, fallbackMessage) => ({
  detail:
    error.response?.data?.error?.message?.value ||
    error.response?.data?.error?.message ||
    error.response?.data ||
    error.message ||
    fallbackMessage,
});

const validateTransactionKey = (req, res, next) => {
  if (!TRANSACTIONS[req.params.transactionKey]) {
    return res.status(404).json({ detail: `Unknown Job Work transaction: ${req.params.transactionKey}` });
  }
  return next();
};

const ensureSchemaMiddleware = async (req, res, next) => {
  try {
    await jobWorkProvisioningService.ensureSchema({ transactionKey: req.params.transactionKey });
    next();
  } catch (error) {
    console.error('[JobWork] Schema provisioning failed:', error.message);
    if (error.response?.data) {
      console.error('[JobWork] SAP error response:', JSON.stringify(error.response.data, null, 2));
    }
    res.status(500).json(getErrorPayload(error, 'Failed to provision Job Work schema in SAP.'));
  }
};

const getReferenceData = async (req, res) => {
  try {
    res.json(await jobWorkService.getReferenceData(req.params.transactionKey));
  } catch (error) {
    console.error('[JobWork] reference-data failed:', error.stack || error.message);
    res.status(500).json(getErrorPayload(error, 'Failed to load reference data.'));
  }
};

const getPartyAddresses = async (req, res) => {
  try {
    res.json(await jobWorkService.getPartyAddresses(req.params.transactionKey, req.params.partyCode));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load party addresses.'));
  }
};

const getBinsByWarehouse = async (req, res) => {
  try {
    res.json({ bins: await jobWorkService.getBinsByWarehouse(req.params.transactionKey, req.params.whsCode) });
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load bin locations.'));
  }
};

const getList = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 25));
    res.json(await jobWorkService.getList(req.params.transactionKey, { query: req.query.query, page, pageSize }));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load documents.'));
  }
};

const getByDocEntry = async (req, res) => {
  try {
    res.json(await jobWorkService.getByDocEntry(req.params.transactionKey, req.params.docEntry));
  } catch (error) {
    res.status(error.statusCode || 500).json(getErrorPayload(error, 'Failed to load document.'));
  }
};

const getDocumentSeries = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await jobWorkService.getDocumentSeries(req.params.transactionKey));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load document series.'));
  }
};

const getNextNumber = async (req, res) => {
  try {
    res.json(await jobWorkService.getNextNumber(req.params.transactionKey, req.params.series));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to get next number.'));
  }
};

const getGoodsReceiptSeries = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await jobWorkService.getGoodsReceiptSeries(req.query.date, req.query.branch));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load Goods Receipt numbering series.'));
  }
};

const getConsumableIssues = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await jobWorkService.getConsumableIssues(req.query.vendorCode));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load consumable Jobwork Issue Note lines.'));
  }
};

const submitDocument = async (req, res) => {
  try {
    res.json(await jobWorkService.submitDocument(req.params.transactionKey, req.body));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to submit document.'));
  }
};

const updateDocument = async (req, res) => {
  try {
    res.json(await jobWorkService.updateDocument(req.params.transactionKey, req.params.docEntry, req.body));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to update document.'));
  }
};

const reprovisionSchema = async (req, res) => {
  try {
    res.json(await jobWorkProvisioningService.ensureSchema({ force: true }));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to re-provision Job Work schema.'));
  }
};

module.exports = {
  validateTransactionKey,
  ensureSchemaMiddleware,
  getReferenceData,
  getPartyAddresses,
  getBinsByWarehouse,
  getList,
  getByDocEntry,
  getDocumentSeries,
  getNextNumber,
  getGoodsReceiptSeries,
  getConsumableIssues,
  submitDocument,
  updateDocument,
  reprovisionSchema,
};
