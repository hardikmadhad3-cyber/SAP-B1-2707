const express = require("express");
const controller = require("../../controllers/reports/billOfMaterials.controller");

const router = express.Router();

/**
 * @openapi
 * /api/reports/production/bill-of-materials:
 *   post:
 *     summary: Generate the bill of materials report
 *     tags: [Bill Of Materials Report]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Report data
 */
router.post("/production/bill-of-materials", controller.postBillOfMaterialsReport);

module.exports = router;
