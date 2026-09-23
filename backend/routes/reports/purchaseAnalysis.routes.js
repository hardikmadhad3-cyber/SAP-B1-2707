const express = require("express");
const controller = require("../../controllers/reports/purchaseAnalysis.controller");

const router = express.Router();

/**
 * @openapi
 * /api/reports/purchase-analysis:
 *   post:
 *     summary: Run the Purchase Analysis report
 *     tags: [Purchase Analysis Report]
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
router.post("/purchase-analysis", controller.postPurchaseAnalysis);

module.exports = router;
