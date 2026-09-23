const express = require('express');
const {
  getCustomerSalesAnalysisReport,
  getCustomerSalesAnalysisDetailReport,
  getItemSalesAnalysisReport,
  getSalesEmployeeSalesAnalysisReport,
} = require('../controllers/salesAnalysisController');

const router = express.Router();

/**
 * @openapi
 * /api/reports/sales-analysis/customers:
 *   post:
 *     summary: Get the customer sales analysis report
 *     tags: [Sales Analysis]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Customer sales analysis report
 */
router.post('/sales-analysis/customers', getCustomerSalesAnalysisReport);

/**
 * @openapi
 * /api/reports/sales-analysis/customers/{customerCode}/detail:
 *   post:
 *     summary: Get the customer sales analysis detail report
 *     tags: [Sales Analysis]
 *     parameters:
 *       - in: path
 *         name: customerCode
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
 *         description: Customer sales analysis detail report
 */
router.post('/sales-analysis/customers/:customerCode/detail', getCustomerSalesAnalysisDetailReport);

/**
 * @openapi
 * /api/reports/sales-analysis/items:
 *   post:
 *     summary: Get the item sales analysis report
 *     tags: [Sales Analysis]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Item sales analysis report
 */
router.post('/sales-analysis/items', getItemSalesAnalysisReport);

/**
 * @openapi
 * /api/reports/sales-analysis/sales-employees:
 *   post:
 *     summary: Get the sales employee sales analysis report
 *     tags: [Sales Analysis]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Sales employee sales analysis report
 */
router.post('/sales-analysis/sales-employees', getSalesEmployeeSalesAnalysisReport);

module.exports = router;
