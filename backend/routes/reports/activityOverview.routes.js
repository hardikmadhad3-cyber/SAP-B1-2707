const express = require("express");
const controller = require("../../controllers/reports/activityOverview.controller");

const router = express.Router();

/**
 * @openapi
 * /api/reports/activity-overview/lookups:
 *   get:
 *     summary: Get lookup/reference data for the activity overview report
 *     tags: [Activity Overview Report]
 *     responses:
 *       200:
 *         description: Lookup data
 */
router.get("/activity-overview/lookups", controller.getLookups);

/**
 * @openapi
 * /api/reports/activity-overview/users:
 *   get:
 *     summary: Search users for the activity overview report
 *     tags: [Activity Overview Report]
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Matching users
 */
router.get("/activity-overview/users", controller.lookupUsers);

/**
 * @openapi
 * /api/reports/activity-overview/employees:
 *   get:
 *     summary: Search employees for the activity overview report
 *     tags: [Activity Overview Report]
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Matching employees
 */
router.get("/activity-overview/employees", controller.lookupEmployees);

/**
 * @openapi
 * /api/reports/activity-overview/recipient-lists:
 *   get:
 *     summary: Search recipient lists for the activity overview report
 *     tags: [Activity Overview Report]
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Matching recipient lists
 */
router.get("/activity-overview/recipient-lists", controller.lookupRecipientLists);

/**
 * @openapi
 * /api/reports/activity-overview/user-defined-fields:
 *   get:
 *     summary: Search user-defined fields for the activity overview report
 *     tags: [Activity Overview Report]
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Matching user-defined fields
 */
router.get("/activity-overview/user-defined-fields", controller.lookupUserDefinedFields);

/**
 * @openapi
 * /api/reports/activity-overview/activity/{activityNo}:
 *   get:
 *     summary: Get a single activity by activity number
 *     tags: [Activity Overview Report]
 *     parameters:
 *       - in: path
 *         name: activityNo
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Activity details
 */
router.get("/activity-overview/activity/:activityNo", controller.getActivity);

/**
 * @openapi
 * /api/reports/activity-overview:
 *   post:
 *     summary: Generate the activity overview report
 *     tags: [Activity Overview Report]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Report data
 */
router.post("/activity-overview", controller.postActivityOverview);

module.exports = router;
