'use strict';

const contextService = require('../newSalesOrder/newSalesOrderContextService');
const schemaService = require('../newSalesOrder/newSalesOrderSchemaService');
const lookupService = require('../newSalesOrder/newSalesOrderLookupService');
const fieldConfigService = require('./salesDocumentFieldConfigService');

const setReadOnlyResponseHeaders = (res) => {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  res.set('Pragma', 'no-cache');
};

const createSalesDocumentSchemaController = ({
  contexts = contextService,
  schemas = schemaService,
  lookups = lookupService,
  fieldConfigurations = fieldConfigService,
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

  const getFieldConfiguration = async (req, res, next) => {
    try {
      const context = await getContext(req);
      const result = await fieldConfigurations.getConfiguration(context, req.query?.documentType);
      setReadOnlyResponseHeaders(res);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  const saveFieldConfiguration = async (req, res, next) => {
    try {
      const context = await getContext(req);
      const result = await fieldConfigurations.saveConfiguration(context, req.body);
      setReadOnlyResponseHeaders(res);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  return { getFieldConfiguration, getLookup, getSchema, saveFieldConfiguration };
};

const defaultController = createSalesDocumentSchemaController();

module.exports = defaultController;
module.exports.createSalesDocumentSchemaController = createSalesDocumentSchemaController;
module.exports.setReadOnlyResponseHeaders = setReadOnlyResponseHeaders;
