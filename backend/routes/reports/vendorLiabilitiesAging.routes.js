const express = require("express");
const controller = require("../../controllers/reports/vendorLiabilitiesAging.controller");

const router = express.Router();

/**
 * @openapi
 * /api/reports/vendor-liabilities-aging/lookups:
 *   get:
 *     summary: Get lookup data for the Vendor Liabilities Aging report
 *     tags: [Vendor Liabilities Aging Report]
 *     responses:
 *       200:
 *         description: Lookup data
 */
router.get("/vendor-liabilities-aging/lookups", controller.getLookups);

/**
 * @openapi
 * /api/reports/vendor-liabilities-aging:
 *   post:
 *     summary: Run the Vendor Liabilities Aging report
 *     tags: [Vendor Liabilities Aging Report]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Report filter criteria
 *     responses:
 *       200:
 *         description: Report data
 */
router.post("/vendor-liabilities-aging", controller.postReport);

module.exports = router;
