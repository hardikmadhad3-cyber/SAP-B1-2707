const express = require('express');
const gatePassController = require('../controllers/gatePassController');

const router = express.Router();

/**
 * @openapi
 * /api/gate-pass/schema/reprovision:
 *   post:
 *     summary: Manually re-run Gate Pass schema provisioning
 *     tags: [Gate Pass]
 *     responses:
 *       200:
 *         description: Schema re-provisioned
 */
router.post('/schema/reprovision', gatePassController.reprovisionSchema);

// --- Masters: Visitor Type, Visit Type ---

router.use('/masters/:masterKey', gatePassController.validateMasterKey, gatePassController.ensureMasterSchemaMiddleware);

/**
 * @openapi
 * /api/gate-pass/masters/{masterKey}:
 *   get:
 *     summary: List rows of a Gate Pass master (visitorType, visitType)
 *     tags: [Gate Pass]
 *   post:
 *     summary: Create a row in a Gate Pass master
 *     tags: [Gate Pass]
 */
router.get('/masters/:masterKey', gatePassController.getMasterList);
router.post('/masters/:masterKey', gatePassController.createMasterRow);

/**
 * @openapi
 * /api/gate-pass/masters/{masterKey}/{code}:
 *   patch:
 *     summary: Update a row in a Gate Pass master
 *     tags: [Gate Pass]
 *   delete:
 *     summary: Delete a row from a Gate Pass master
 *     tags: [Gate Pass]
 */
router.patch('/masters/:masterKey/:code', gatePassController.updateMasterRow);
router.delete('/masters/:masterKey/:code', gatePassController.deleteMasterRow);

// --- Transactions: Visitor Log, Gate In, Gate Out ---

router.use('/:transactionKey', gatePassController.validateTransactionKey, gatePassController.ensureTransactionSchemaMiddleware);

/**
 * @openapi
 * /api/gate-pass/{transactionKey}/list:
 *   get:
 *     summary: List Gate Pass documents of a given transaction type
 *     tags: [Gate Pass]
 */
router.get('/:transactionKey/list', gatePassController.getList);

/**
 * @openapi
 * /api/gate-pass/{transactionKey}/{docEntry}:
 *   get:
 *     summary: Get a Gate Pass document by DocEntry
 *     tags: [Gate Pass]
 */
router.get('/:transactionKey/:docEntry', gatePassController.getByDocEntry);

/**
 * @openapi
 * /api/gate-pass/{transactionKey}:
 *   post:
 *     summary: Create a new Gate Pass document
 *     tags: [Gate Pass]
 */
router.post('/:transactionKey', gatePassController.submitDocument);

/**
 * @openapi
 * /api/gate-pass/{transactionKey}/{docEntry}:
 *   patch:
 *     summary: Update an existing Gate Pass document
 *     tags: [Gate Pass]
 */
router.patch('/:transactionKey/:docEntry', gatePassController.updateDocument);

module.exports = router;
