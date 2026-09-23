const express = require("express");
const controller = require("../../controllers/reports/productionOpenItems.controller");

const router = express.Router();

/**
 * @openapi
 * /api/reports/production/open-items-list:
 *   post:
 *     summary: Run the Production Open Items report
 *     tags: [Production Open Items Report]
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
router.post("/production/open-items-list", controller.postProductionOpenItemsReport);

module.exports = router;
