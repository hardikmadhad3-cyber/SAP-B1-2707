const express = require("express");
const controller = require("../../controllers/reports/glAccountsBusinessPartners.controller");

const router = express.Router();

/**
 * @openapi
 * /api/reports/gl-accounts-business-partners/lookups:
 *   get:
 *     summary: Get lookup data for the GL Accounts & Business Partners report
 *     tags: [GL Accounts Business Partners Report]
 *     responses:
 *       200:
 *         description: Lookup data
 */
router.get("/gl-accounts-business-partners/lookups", controller.getLookups);

/**
 * @openapi
 * /api/reports/gl-accounts-business-partners/business-partners:
 *   get:
 *     summary: Search business partners for the GL Accounts & Business Partners report
 *     tags: [GL Accounts Business Partners Report]
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Search text
 *     responses:
 *       200:
 *         description: Matching business partners
 */
router.get("/gl-accounts-business-partners/business-partners", controller.lookupBusinessPartners);

/**
 * @openapi
 * /api/reports/gl-accounts-business-partners:
 *   post:
 *     summary: Run the GL Accounts & Business Partners report
 *     tags: [GL Accounts Business Partners Report]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Report filter criteria (includeBusinessPartners, includeGlAccounts, etc.)
 *     responses:
 *       200:
 *         description: Report data
 */
router.post("/gl-accounts-business-partners", controller.postReport);

module.exports = router;
