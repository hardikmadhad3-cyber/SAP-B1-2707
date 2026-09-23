const express = require("express");
const controller = require("../../controllers/reports/inventoryAudit.controller");

const router = express.Router();

/**
 * @openapi
 * /api/reports/inventory-audit/lookups:
 *   get:
 *     summary: Get lookup data for the Inventory Audit report
 *     tags: [Inventory Audit Report]
 *     responses:
 *       200:
 *         description: Lookup data
 */
router.get("/inventory-audit/lookups", controller.getLookups);

/**
 * @openapi
 * /api/reports/inventory-audit:
 *   post:
 *     summary: Run the Inventory Audit report
 *     tags: [Inventory Audit Report]
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
router.post("/inventory-audit", controller.postReport);

module.exports = router;
