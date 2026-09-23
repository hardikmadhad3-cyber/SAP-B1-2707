const express = require("express");
const controller = require("../../controllers/reports/inventoryInWarehouse.controller");

const router = express.Router();

/**
 * @openapi
 * /api/reports/inventory-in-warehouse/lookups:
 *   get:
 *     summary: Get lookup data for the Inventory in Warehouse report
 *     tags: [Inventory In Warehouse Report]
 *     responses:
 *       200:
 *         description: Lookup data
 */
router.get("/inventory-in-warehouse/lookups", controller.getLookups);

/**
 * @openapi
 * /api/reports/inventory-in-warehouse:
 *   post:
 *     summary: Run the Inventory in Warehouse report
 *     tags: [Inventory In Warehouse Report]
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
router.post("/inventory-in-warehouse", controller.postReport);

module.exports = router;
