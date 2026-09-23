const express = require('express');
const jobWorkController = require('../controllers/jobWorkController');

const router = express.Router();

/**
 * @openapi
 * /api/job-work/schema/reprovision:
 *   post:
 *     summary: Manually re-run job work schema provisioning
 *     tags: [Job Work]
 *     responses:
 *       200:
 *         description: Schema re-provisioned
 */
// Manual re-provisioning trigger (Admin Panel "Re-check Job Work Schema" action).
router.post('/schema/reprovision', jobWorkController.ensureSchemaMiddleware, jobWorkController.reprovisionSchema);

router.use('/:transactionKey', jobWorkController.validateTransactionKey);

/**
 * @openapi
 * /api/job-work/{transactionKey}/reference-data:
 *   get:
 *     summary: Get reference/lookup data for a job work transaction type
 *     tags: [Job Work]
 *     parameters:
 *       - $ref: '#/components/parameters/JobWorkTransactionKey'
 *     responses:
 *       200:
 *         description: Reference data for the transaction
 */
router.get('/:transactionKey/reference-data', jobWorkController.getReferenceData);

/**
 * @openapi
 * /api/job-work/{transactionKey}/party-addresses/{partyCode}:
 *   get:
 *     summary: Get addresses for a business partner used in job work documents
 *     tags: [Job Work]
 *     parameters:
 *       - $ref: '#/components/parameters/JobWorkTransactionKey'
 *       - in: path
 *         name: partyCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of addresses for the business partner
 */
router.get('/:transactionKey/party-addresses/:partyCode', jobWorkController.getPartyAddresses);

/**
 * @openapi
 * /api/job-work/{transactionKey}/bins/{whsCode}:
 *   get:
 *     summary: Get active bin locations for a bin-managed warehouse
 *     tags: [Job Work]
 *     parameters:
 *       - $ref: '#/components/parameters/JobWorkTransactionKey'
 *       - in: path
 *         name: whsCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of bin locations for the warehouse
 */
router.get('/:transactionKey/bins/:whsCode', jobWorkController.getBinsByWarehouse);

/**
 * @openapi
 * /api/job-work/{transactionKey}/list:
 *   get:
 *     summary: List job work documents of a given transaction type
 *     tags: [Job Work]
 *     parameters:
 *       - $ref: '#/components/parameters/JobWorkTransactionKey'
 *     responses:
 *       200:
 *         description: List of job work documents
 */
router.get('/:transactionKey/list', jobWorkController.ensureSchemaMiddleware, jobWorkController.getList);

/**
 * @openapi
 * /api/job-work/{transactionKey}/series:
 *   get:
 *     summary: List document numbering series for a job work transaction type
 *     tags: [Job Work]
 *     parameters:
 *       - $ref: '#/components/parameters/JobWorkTransactionKey'
 *     responses:
 *       200:
 *         description: List of numbering series
 */
router.get('/:transactionKey/series', jobWorkController.getDocumentSeries);

/**
 * @openapi
 * /api/job-work/{transactionKey}/series/{series}/next-number:
 *   get:
 *     summary: Get the next document number for a series
 *     tags: [Job Work]
 *     parameters:
 *       - $ref: '#/components/parameters/JobWorkTransactionKey'
 *       - in: path
 *         name: series
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Next available document number
 */
router.get('/:transactionKey/series/:series/next-number', jobWorkController.getNextNumber);

/**
 * @openapi
 * /api/job-work/{transactionKey}/goods-receipt-series:
 *   get:
 *     summary: List numbering series for the linked Inventory Goods Receipt (SAP object 59)
 *     tags: [Job Work]
 *     parameters:
 *       - $ref: '#/components/parameters/JobWorkTransactionKey'
 *     responses:
 *       200:
 *         description: List of numbering series for Inventory Goods Receipt
 */
router.get('/:transactionKey/goods-receipt-series', jobWorkController.getGoodsReceiptSeries);

/**
 * @openapi
 * /api/job-work/{transactionKey}/consumable-issues:
 *   get:
 *     summary: List open Jobwork Issue Note lines for a vendor with live Balance Qty
 *     tags: [Job Work]
 *     parameters:
 *       - $ref: '#/components/parameters/JobWorkTransactionKey'
 *       - in: query
 *         name: vendorCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of consumable Issue Note lines
 */
router.get('/:transactionKey/consumable-issues', jobWorkController.getConsumableIssues);

/**
 * @openapi
 * /api/job-work/{transactionKey}/{docEntry}:
 *   get:
 *     summary: Get a job work document by DocEntry
 *     tags: [Job Work]
 *     parameters:
 *       - $ref: '#/components/parameters/JobWorkTransactionKey'
 *       - in: path
 *         name: docEntry
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: The job work document
 *       404:
 *         description: Document not found
 */
router.get('/:transactionKey/:docEntry', jobWorkController.ensureSchemaMiddleware, jobWorkController.getByDocEntry);

/**
 * @openapi
 * /api/job-work/{transactionKey}:
 *   post:
 *     summary: Create a new job work document
 *     tags: [Job Work]
 *     parameters:
 *       - $ref: '#/components/parameters/JobWorkTransactionKey'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Document created
 */
router.post('/:transactionKey', jobWorkController.ensureSchemaMiddleware, jobWorkController.submitDocument);

/**
 * @openapi
 * /api/job-work/{transactionKey}/{docEntry}:
 *   patch:
 *     summary: Update an existing job work document
 *     tags: [Job Work]
 *     parameters:
 *       - $ref: '#/components/parameters/JobWorkTransactionKey'
 *       - in: path
 *         name: docEntry
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Document updated
 */
router.patch('/:transactionKey/:docEntry', jobWorkController.ensureSchemaMiddleware, jobWorkController.updateDocument);

module.exports = router;
