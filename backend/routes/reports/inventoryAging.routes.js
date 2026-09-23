const express = require("express");
const controller = require("../../controllers/reports/inventoryAging.controller");

const router = express.Router();

/**
 * @openapi
 * /api/reports/inventory-aging/lookups:
 *   get:
 *     summary: Get lookup data for the Inventory Aging report
 *     tags: [Inventory Aging Report]
 *     responses:
 *       200:
 *         description: Lookup data
 */
router.get("/inventory-aging/lookups", controller.getLookups);

/**
 * @openapi
 * /api/reports/inventory-aging:
 *   post:
 *     summary: Run the Inventory Aging report
 *     tags: [Inventory Aging Report]
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
router.post("/inventory-aging", controller.postReport);

module.exports = router;
