const express = require("express");
const controller = require("../../controllers/reports/inactiveCustomers.controller");

const router = express.Router();

/**
 * @openapi
 * /api/reports/inactive-customers/lookups:
 *   get:
 *     summary: Get lookup data for the Inactive Customers report
 *     tags: [Inactive Customers Report]
 *     responses:
 *       200:
 *         description: Lookup data
 */
router.get("/inactive-customers/lookups", controller.getLookups);

/**
 * @openapi
 * /api/reports/inactive-customers:
 *   post:
 *     summary: Run the Inactive Customers report
 *     tags: [Inactive Customers Report]
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
router.post("/inactive-customers", controller.postReport);

module.exports = router;
