const express = require("express");
const controller = require("../../controllers/reports/campaignsList.controller");

const router = express.Router();

/**
 * @openapi
 * /api/reports/campaigns-list/lookups:
 *   get:
 *     summary: Get lookup/reference data for the campaigns list report
 *     tags: [Campaigns List Report]
 *     responses:
 *       200:
 *         description: Lookup data
 */
router.get("/campaigns-list/lookups", controller.getLookups);

/**
 * @openapi
 * /api/reports/campaigns-list:
 *   post:
 *     summary: Generate the campaigns list report
 *     tags: [Campaigns List Report]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Report data
 */
router.post("/campaigns-list", controller.postCampaignsListReport);

module.exports = router;
