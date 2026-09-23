const express = require("express");
const controller = require("../../controllers/reports/itemListReport.controller");

const router = express.Router();

/**
 * @openapi
 * /api/reports/item-list:
 *   post:
 *     summary: Run the Item List report
 *     tags: [Item List Report]
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
router.post("/item-list", controller.postItemListReport);

module.exports = router;
