'use strict';

const contextService = require('./newSalesOrderContextService');
const schemaService = require('./newSalesOrderSchemaService');
const lookupService = require('./newSalesOrderLookupService');
const { createNewSalesOrderDummyService } = require('./newSalesOrderDummyService');

const defaultDummyService = createNewSalesOrderDummyService({
  getCurrentSchema: schemaService.getCurrentSchema,
  validateLookupValue: lookupService.validateLookupValue,
});

const setReadOnlyResponseHeaders = (res) => {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  res.set('Pragma', 'no-cache');
};

const getDummyRequest = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const error = new Error('A JSON request body is required.');
    error.statusCode = 400;
    error.code = 'INVALID_NEW_SALES_ORDER_REQUEST';
    throw error;
  }

  const unknownKey = Object.keys(body).find((key) => !['schemaVersion', 'formData'].includes(key));
  if (unknownKey) {
    const error = new Error(`Unknown request field ${unknownKey}.`);
    error.statusCode = 400;
    error.code = 'UNKNOWN_NEW_SALES_ORDER_REQUEST_FIELD';
    throw error;
  }

  return {
    schemaVersion: body.schemaVersion,
    formData: body.formData,
  };
};

const createNewSalesOrderController = ({
  contexts = contextService,
  schemas = schemaService,
  lookups = lookupService,
  dummies = defaultDummyService,
} = {}) => {
  const getContext = async (req) => req.newSalesOrderContext || contexts.resolve(req);

  const getSchema = async (req, res, next) => {
    try {
      const context = await getContext(req);
      const schema = await schemas.getSchema(context, req.query?.documentType);
      setReadOnlyResponseHeaders(res);
      res.json(schema);
    } catch (error) {
      next(error);
    }
  };

  const getLookup = async (req, res, next) => {
    try {
      const context = await getContext(req);
      const result = await lookups.getLookup(context, req.params.source, req.query || {});
      setReadOnlyResponseHeaders(res);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  const validate = async (req, res, next) => {
    try {
      const trustedContext = await getContext(req);
      const result = await dummies.validateDummy({
        trustedContext,
        ...getDummyRequest(req.body),
      });
      setReadOnlyResponseHeaders(res);
      res.json({
        success: true,
        valid: result.valid,
        errors: result.errors,
        payload: result.payload,
      });
    } catch (error) {
      next(error);
    }
  };

  const saveDummyDraft = async (req, res, next) => {
    try {
      const trustedContext = await getContext(req);
      const result = await dummies.saveDummy({
        trustedContext,
        ...getDummyRequest(req.body),
      });
      setReadOnlyResponseHeaders(res);
      res.status(201).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  return { getLookup, getSchema, saveDummyDraft, validate };
};

const defaultController = createNewSalesOrderController();

module.exports = defaultController;
module.exports.createNewSalesOrderController = createNewSalesOrderController;
module.exports.getDummyRequest = getDummyRequest;
module.exports.setReadOnlyResponseHeaders = setReadOnlyResponseHeaders;
