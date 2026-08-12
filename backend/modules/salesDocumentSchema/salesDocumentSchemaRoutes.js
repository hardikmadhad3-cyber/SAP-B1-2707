'use strict';

const express = require('express');
const { authenticateAccessToken } = require('../../middleware/authMiddleware');
const contextService = require('../newSalesOrder/newSalesOrderContextService');
const controller = require('../newSalesOrder/newSalesOrderController');

const createSalesDocumentSchemaRouter = ({
  authenticate = authenticateAccessToken,
  contextMiddleware = contextService.middleware,
  handlers = controller,
} = {}) => {
  const router = express.Router();

  router.use(authenticate);
  router.use(contextMiddleware);
  router.get('/schema', handlers.getSchema);
  router.get('/lookups/:source', handlers.getLookup);

  return router;
};

const router = createSalesDocumentSchemaRouter();

module.exports = router;
module.exports.createSalesDocumentSchemaRouter = createSalesDocumentSchemaRouter;
