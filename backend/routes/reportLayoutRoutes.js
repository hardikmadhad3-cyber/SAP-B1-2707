const express = require('express');
const reportLayoutController = require('../controllers/reportLayoutController');

const router = express.Router();

/**
 * @openapi
 * /api/reports:
 *   get:
 *     summary: List available reports
 *     tags: [Report Layout]
 *     responses:
 *       200:
 *         description: List of reports
 */
/*  */router.get('/reports', reportLayoutController.listReports);

/**
 * @openapi
 * /api/reports/fields:
 *   get:
 *     summary: Get available fields for a report
 *     tags: [Report Layout]
 *     parameters:
 *       - in: query
 *         name: report
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Report field definitions
 */
router.get('/reports/fields', reportLayoutController.getReportFields);

/**
 * @openapi
 * /api/layout-manager/catalog:
 *   get:
 *     summary: List the layout manager catalog
 *     tags: [Report Layout]
 *     parameters:
 *       - in: query
 *         name: includeLayouts
 *         schema:
 *           type: string
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *       - in: query
 *         name: entryType
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Layout manager catalog entries
 */
router.get('/layout-manager/catalog', reportLayoutController.listManagerCatalog);

/**
 * @openapi
 * /api/layout-manager/search:
 *   get:
 *     summary: Search the layout manager catalog
 *     tags: [Report Layout]
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *       - in: query
 *         name: entryType
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Matching catalog entries
 */
router.get('/layout-manager/search', reportLayoutController.searchManagerCatalog);

/**
 * @openapi
 * /api/layout-manager/menu-entries:
 *   post:
 *     summary: Create a layout manager menu entry
 *     tags: [Report Layout]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Menu entry created
 */
router.post('/layout-manager/menu-entries', reportLayoutController.createMenuEntry);

/**
 * @openapi
 * /api/layout-manager/menu-entries/{id}:
 *   put:
 *     summary: Update a layout manager menu entry
 *     tags: [Report Layout]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Menu entry updated
 */
router.put('/layout-manager/menu-entries/:id', reportLayoutController.updateMenuEntry);

/**
 * @openapi
 * /api/layout-manager/menu-entries/{id}:
 *   delete:
 *     summary: Delete a layout manager menu entry
 *     tags: [Report Layout]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Menu entry deleted
 */
router.delete('/layout-manager/menu-entries/:id', reportLayoutController.deleteMenuEntry);

/**
 * @openapi
 * /api/layouts:
 *   get:
 *     summary: List report layouts
 *     tags: [Report Layout]
 *     parameters:
 *       - in: query
 *         name: report
 *         schema:
 *           type: string
 *       - in: query
 *         name: menuEntryId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of layouts
 */
router.get('/layouts', reportLayoutController.listLayouts);

/**
 * @openapi
 * /api/layouts:
 *   post:
 *     summary: Create a report layout
 *     tags: [Report Layout]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Layout created
 */
router.post('/layouts', reportLayoutController.createLayout);

/**
 * @openapi
 * /api/layouts/{id}:
 *   put:
 *     summary: Update a report layout
 *     tags: [Report Layout]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Layout updated
 */
router.put('/layouts/:id', reportLayoutController.updateLayout);

/**
 * @openapi
 * /api/layouts/{id}:
 *   delete:
 *     summary: Delete a report layout
 *     tags: [Report Layout]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Layout deleted
 */
router.delete('/layouts/:id', reportLayoutController.deleteLayout);

/**
 * @openapi
 * /api/layouts/set-default:
 *   post:
 *     summary: Set a layout as the default for a report
 *     tags: [Report Layout]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Default layout set
 */
router.post('/layouts/set-default', reportLayoutController.setDefaultLayout);

/**
 * @openapi
 * /api/layouts/preview:
 *   post:
 *     summary: Preview a report layout
 *     tags: [Report Layout]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Layout preview result
 */
router.post('/layouts/preview', reportLayoutController.previewLayout);

/**
 * @openapi
 * /api/layouts/{id}/copy:
 *   post:
 *     summary: Copy a report layout
 *     tags: [Report Layout]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Layout copied
 */
router.post('/layouts/:id/copy', reportLayoutController.copyLayout);

/**
 * @openapi
 * /api/layouts/{id}/versions:
 *   get:
 *     summary: Get version history for a report layout
 *     tags: [Report Layout]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Layout version history
 */
router.get('/layouts/:id/versions', reportLayoutController.getLayoutVersions);

module.exports = router;
