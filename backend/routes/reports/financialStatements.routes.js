const express = require("express");
const controller = require("../../controllers/reports/financialStatements.controller");

const router = express.Router();

/**
 * @openapi
 * /api/reports/financial-statements/lookups:
 *   get:
 *     summary: Get lookup/reference data for financial statement reports
 *     tags: [Financial Statements Report]
 *     responses:
 *       200:
 *         description: Lookup data
 */
router.get("/financial-statements/lookups", controller.getLookups);

/**
 * @openapi
 * /api/reports/financial-statements/{reportKey}:
 *   post:
 *     summary: Generate a financial statement report for the given report key
 *     tags: [Financial Statements Report]
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
router.post("/financial-statements/:reportKey", controller.postReport);

module.exports = router;
