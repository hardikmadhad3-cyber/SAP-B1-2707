const gatePassService = require('../services/gatePassService');
const gatePassProvisioningService = require('../services/gatePassProvisioningService');
const { MASTERS, TRANSACTIONS } = require('../services/gatePassSchema');

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
    return res.status(404).json({ detail: `Unknown Gate Pass transaction: ${req.params.transactionKey}` });
  }
  return next();
};

const validateMasterKey = (req, res, next) => {
  if (!MASTERS[req.params.masterKey]) {
    return res.status(404).json({ detail: `Unknown Gate Pass master: ${req.params.masterKey}` });
  }
  return next();
};

const ensureTransactionSchemaMiddleware = async (req, res, next) => {
  try {
    await gatePassProvisioningService.ensureSchema({ transactionKey: req.params.transactionKey });
    next();
  } catch (error) {
    console.error('[GatePass] Transaction schema provisioning failed:', error.message);
    res.status(500).json(getErrorPayload(error, 'Failed to provision Gate Pass schema in SAP.'));
  }
};

const ensureMasterSchemaMiddleware = async (req, res, next) => {
  try {
    await gatePassProvisioningService.ensureSchema({ masterKey: req.params.masterKey });
    next();
  } catch (error) {
    console.error('[GatePass] Master schema provisioning failed:', error.message);
    res.status(500).json(getErrorPayload(error, 'Failed to provision Gate Pass master in SAP.'));
  }
};

// --- Masters ---

const getMasterList = async (req, res) => {
  try {
    res.json({ rows: await gatePassService.getMasterList(req.params.masterKey, { query: req.query.query }) });
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load master list.'));
  }
};

const createMasterRow = async (req, res) => {
  try {
    res.json(await gatePassService.createMasterRow(req.params.masterKey, req.body));
  } catch (error) {
    res.status(error.statusCode || 500).json(getErrorPayload(error, 'Failed to create row.'));
  }
};

const updateMasterRow = async (req, res) => {
  try {
    res.json(await gatePassService.updateMasterRow(req.params.masterKey, req.params.code, req.body));
  } catch (error) {
    res.status(error.statusCode || 500).json(getErrorPayload(error, 'Failed to update row.'));
  }
};

const deleteMasterRow = async (req, res) => {
  try {
    res.json(await gatePassService.deleteMasterRow(req.params.masterKey, req.params.code));
  } catch (error) {
    res.status(error.statusCode || 500).json(getErrorPayload(error, 'Failed to delete row.'));
  }
};

// --- Transactions ---

const getList = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 25));
    res.json(await gatePassService.getList(req.params.transactionKey, { query: req.query.query, page, pageSize }));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load documents.'));
  }
};

const getByDocEntry = async (req, res) => {
  try {
    res.json(await gatePassService.getByDocEntry(req.params.transactionKey, req.params.docEntry));
  } catch (error) {
    res.status(error.statusCode || 500).json(getErrorPayload(error, 'Failed to load document.'));
  }
};

const submitDocument = async (req, res) => {
  try {
    res.json(await gatePassService.submitDocument(req.params.transactionKey, req.body));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to submit document.'));
  }
};

const updateDocument = async (req, res) => {
  try {
    res.json(await gatePassService.updateDocument(req.params.transactionKey, req.params.docEntry, req.body));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to update document.'));
  }
};

const reprovisionSchema = async (req, res) => {
  try {
    res.json(await gatePassProvisioningService.ensureSchema({ force: true }));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to re-provision Gate Pass schema.'));
  }
};

module.exports = {
  validateTransactionKey,
  validateMasterKey,
  ensureTransactionSchemaMiddleware,
  ensureMasterSchemaMiddleware,
  getMasterList,
  createMasterRow,
  updateMasterRow,
  deleteMasterRow,
  getList,
  getByDocEntry,
  submitDocument,
  updateDocument,
  reprovisionSchema,
};
