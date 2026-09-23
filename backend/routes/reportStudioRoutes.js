const express = require('express');
const reportStudioController = require('../controllers/reportStudioController');

const router = express.Router();

/**
 * @openapi
 * /api/report-menus:
 *   get:
 *     summary: List Report Studio report menus
 *     tags: [Report Studio]
 *     responses:
 *       200:
 *         description: List of report menus
 */
router.get('/report-menus', reportStudioController.listReportMenus);

/**
 * @openapi
 * /api/report-codes:
 *   get:
 *     summary: List report codes the current user is authorized for
 *     tags: [Report Studio]
 *     responses:
 *       200:
 *         description: List of authorized report codes
 */
router.get('/report-codes', reportStudioController.listAuthorizedReportCodes);

/**
 * @openapi
 * /api/report-codes/{code}/parameters:
 *   get:
 *     summary: Get parameter definitions for a report code
 *     tags: [Report Studio]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Report parameter definitions
 */
router.get('/report-codes/:code/parameters', reportStudioController.getReportCodeParameters);

/**
 * @openapi
 * /api/report-menus:
 *   post:
 *     summary: Create a Report Studio report menu
 *     tags: [Report Studio]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Report menu created
 */
router.post('/report-menus', reportStudioController.createReportMenu);

/**
 * @openapi
 * /api/reports:
 *   post:
 *     summary: Create a Report Studio report
 *     tags: [Report Studio]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Report created
 */
router.post('/reports', reportStudioController.createReport);

/**
 * @openapi
 * /api/reports/{id}:
 *   get:
 *     summary: Get a Report Studio report by id
 *     tags: [Report Studio]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Report details
 */
router.get('/reports/:id', reportStudioController.getReportById);

/**
 * @openapi
 * /api/reports/run:
 *   post:
 *     summary: Run a Report Studio report
 *     tags: [Report Studio]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Report results
 */
router.post('/reports/run', reportStudioController.runReport);

/**
 * @openapi
 * /api/report-parameters:
 *   post:
 *     summary: Add a parameter to a Report Studio report
 *     tags: [Report Studio]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Report parameter added
 */
router.post('/report-parameters', reportStudioController.addReportParameter);

module.exports = router;
