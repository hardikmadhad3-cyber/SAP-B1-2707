const express = require('express');
const queryManagerController = require('../controllers/queryManagerController');
const { requireAdminPanelAccess } = require('../middleware/adminPanelAccess');

const router = express.Router();

router.use(requireAdminPanelAccess);

/**
 * @openapi
 * /api/query-manager/folders:
 *   get:
 *     summary: Get the query folder tree
 *     tags: [Query Manager]
 *     responses:
 *       200:
 *         description: Folder tree
 */
router.get('/folders', queryManagerController.getFolderTree);

/**
 * @openapi
 * /api/query-manager/folders:
 *   post:
 *     summary: Create a new query folder
 *     tags: [Query Manager]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Folder created
 */
router.post('/folders', queryManagerController.createFolder);

/**
 * @openapi
 * /api/query-manager/folders/{folderId}:
 *   put:
 *     summary: Rename or move a query folder
 *     tags: [Query Manager]
 *     parameters:
 *       - in: path
 *         name: folderId
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
 *         description: Folder renamed or moved
 */
router.put('/folders/:folderId', queryManagerController.renameOrMoveFolder);

/**
 * @openapi
 * /api/query-manager/folders/{folderId}:
 *   delete:
 *     summary: Delete a query folder
 *     tags: [Query Manager]
 *     parameters:
 *       - in: path
 *         name: folderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Folder deleted
 */
router.delete('/folders/:folderId', queryManagerController.deleteFolder);

/**
 * @openapi
 * /api/query-manager/queries/preview:
 *   post:
 *     summary: Preview the results of a query definition
 *     tags: [Query Manager]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Preview results
 */
router.post('/queries/preview', queryManagerController.previewQuery);

/**
 * @openapi
 * /api/query-manager/queries/{queryId}:
 *   get:
 *     summary: Get a saved query by id
 *     tags: [Query Manager]
 *     parameters:
 *       - in: path
 *         name: queryId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Saved query
 */
router.get('/queries/:queryId', queryManagerController.getSavedQuery);

/**
 * @openapi
 * /api/query-manager/queries:
 *   post:
 *     summary: Create a new saved query
 *     tags: [Query Manager]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Saved query created
 */
router.post('/queries', queryManagerController.createSavedQuery);

/**
 * @openapi
 * /api/query-manager/queries/{queryId}:
 *   put:
 *     summary: Update a saved query
 *     tags: [Query Manager]
 *     parameters:
 *       - in: path
 *         name: queryId
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
 *         description: Saved query updated
 */
router.put('/queries/:queryId', queryManagerController.updateSavedQuery);

/**
 * @openapi
 * /api/query-manager/queries/{queryId}:
 *   delete:
 *     summary: Delete a saved query
 *     tags: [Query Manager]
 *     parameters:
 *       - in: path
 *         name: queryId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Saved query deleted
 */
router.delete('/queries/:queryId', queryManagerController.deleteSavedQuery);

/**
 * @openapi
 * /api/query-manager/queries/{queryId}/run:
 *   post:
 *     summary: Run a saved query
 *     tags: [Query Manager]
 *     parameters:
 *       - in: path
 *         name: queryId
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
 *         description: Query results
 */
router.post('/queries/:queryId/run', queryManagerController.runSavedQuery);

module.exports = router;
