const express = require("express");
const controller = require("../../controllers/reports/customerReceivablesAging.controller");

const router = express.Router();

/**
 * @openapi
 * /api/reports/customer-receivables-aging/lookups:
 *   get:
 *     summary: Get lookup/reference data for the customer receivables aging report
 *     tags: [Customer Receivables Aging Report]
 *     responses:
 *       200:
 *         description: Lookup data
 */
router.get("/customer-receivables-aging/lookups", controller.getLookups);

/**
 * @openapi
 * /api/reports/customer-receivables-aging:
 *   post:
 *     summary: Generate the customer receivables aging report
 *     tags: [Customer Receivables Aging Report]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Report data
 */
router.post("/customer-receivables-aging", controller.postReport);

module.exports = router;
