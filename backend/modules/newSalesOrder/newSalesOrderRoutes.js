'use strict';

const express = require('express');
const { authenticateAccessToken } = require('../../middleware/authMiddleware');
const contextService = require('./newSalesOrderContextService');
const controller = require('./newSalesOrderController');
const { requireDummySaveEnabled } = require('./newSalesOrderWriteProtection');

const createNewSalesOrderRouter = ({
  authenticate = authenticateAccessToken,
  contextMiddleware = contextService.middleware,
  handlers = controller,
  dummySaveGuard = requireDummySaveEnabled(),
} = {}) => {
  const router = express.Router();

  // The server already authenticates /api globally. Keeping authentication and
  // company revalidation on this isolated router provides defense in depth if
  // it is mounted elsewhere during development or route tests.
  router.use(authenticate);
  router.use(contextMiddleware);
  router.get('/schema', handlers.getSchema);
  router.get('/lookups/:source', handlers.getLookup);
  router.post('/validate', handlers.validate);
  router.post('/dummy-drafts', dummySaveGuard, handlers.saveDummyDraft);

  return router;
};

const router = createNewSalesOrderRouter();

module.exports = router;
module.exports.createNewSalesOrderRouter = createNewSalesOrderRouter;
