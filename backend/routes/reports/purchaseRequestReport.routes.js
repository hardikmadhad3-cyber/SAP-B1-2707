const express = require("express");
const controller = require("../../controllers/reports/purchaseRequestReport.controller");

const router = express.Router();

/**
 * @openapi
 * /api/reports/purchase-request-report:
 *   post:
 *     summary: Run the Purchase Request report
 *     tags: [Purchase Request Report]
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
router.post("/purchase-request-report", controller.postPurchaseRequestReport);

module.exports = router;
