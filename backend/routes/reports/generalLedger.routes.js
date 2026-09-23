const express = require("express");
const controller = require("../../controllers/reports/generalLedger.controller");

const router = express.Router();

/**
 * @openapi
 * /api/reports/general-ledger/lookups:
 *   get:
 *     summary: Get lookup/reference data for the general ledger report
 *     tags: [General Ledger Report]
 *     responses:
 *       200:
 *         description: Lookup data
 */
router.get("/general-ledger/lookups", controller.getLookups);

/**
 * @openapi
 * /api/reports/general-ledger:
 *   post:
 *     summary: Generate the general ledger report
 *     tags: [General Ledger Report]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Report data
 */
router.post("/general-ledger", controller.postReport);

module.exports = router;
