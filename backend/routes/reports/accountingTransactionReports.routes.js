const express = require("express");
const controller = require("../../controllers/reports/accountingTransactionReports.controller");

const router = express.Router();

/**
 * @openapi
 * /api/reports/accounting-transactions/lookups:
 *   get:
 *     summary: Get lookup/reference data for accounting transaction reports
 *     tags: [Accounting Transaction Reports]
 *     responses:
 *       200:
 *         description: Lookup data
 */
router.get("/accounting-transactions/lookups", controller.getLookups);

/**
 * @openapi
 * /api/reports/accounting-transactions/{reportKey}:
 *   post:
 *     summary: Generate an accounting transaction report for the given report key
 *     tags: [Accounting Transaction Reports]
 *     parameters:
 *       - in: path
 *         name: reportKey
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Report data
 */
router.post("/accounting-transactions/:reportKey", controller.postReport);

module.exports = router;
