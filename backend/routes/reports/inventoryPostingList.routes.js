const express = require("express");
const controller = require("../../controllers/reports/inventoryPostingList.controller");

const router = express.Router();

/**
 * @openapi
 * /api/reports/inventory-posting-list/lookups:
 *   get:
 *     summary: Get lookup data for the Inventory Posting List report
 *     tags: [Inventory Posting List Report]
 *     responses:
 *       200:
 *         description: Lookup data
 */
router.get("/inventory-posting-list/lookups", controller.getInventoryPostingListLookups);

/**
 * @openapi
 * /api/reports/inventory-posting-list:
 *   post:
 *     summary: Run the Inventory Posting List report
 *     tags: [Inventory Posting List Report]
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
router.post("/inventory-posting-list", controller.postInventoryPostingList);

module.exports = router;
