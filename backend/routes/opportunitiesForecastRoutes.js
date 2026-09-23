const express = require('express');
const {
  getOpportunitiesForecastReport,
  getOpportunitiesForecastOverTimeReport,
  getInformationSourceDistributionOverTimeReport,
  getOpportunitiesStatisticsReport,
  getOpportunitiesReport,
  getOpportunitiesPipelineReport,
  getOpportunitiesStageAnalysisReport,
  getWonOpportunitiesReport,
  getLostOpportunitiesReport,
  getCrmStages,
  getTerritories,
  getIndustries,
  getInterestLevels,
  getOpportunityForecastLookups,
} = require('../controllers/opportunitiesForecastController');

const router = express.Router();

/**
 * @openapi
 * /api/reports/opportunities-forecast/report:
 *   post:
 *     summary: Generate the opportunities forecast report
 *     tags: [Opportunities Forecast]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Opportunities forecast report data
 */
router.post('/opportunities-forecast/report', getOpportunitiesForecastReport);

/**
 * @openapi
 * /api/reports/opportunities-forecast/over-time/report:
 *   post:
 *     summary: Generate the opportunities forecast over-time report
 *     tags: [Opportunities Forecast]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Opportunities forecast over-time report data
 */
router.post('/opportunities-forecast/over-time/report', getOpportunitiesForecastOverTimeReport);

/**
 * @openapi
 * /api/reports/information-source-distribution-over-time/report:
 *   post:
 *     summary: Generate the information source distribution over-time report
 *     tags: [Opportunities Forecast]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Information source distribution over-time report data
 */
router.post('/information-source-distribution-over-time/report', getInformationSourceDistributionOverTimeReport);

/**
 * @openapi
 * /api/reports/opportunities-statistics/report:
 *   post:
 *     summary: Generate the opportunities statistics report
 *     tags: [Opportunities Forecast]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Opportunities statistics report data
 */
router.post('/opportunities-statistics/report', getOpportunitiesStatisticsReport);

/**
 * @openapi
 * /api/reports/opportunities/report:
 *   post:
 *     summary: Generate the opportunities report
 *     tags: [Opportunities Forecast]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Opportunities report data
 */
router.post('/opportunities/report', getOpportunitiesReport);

/**
 * @openapi
 * /api/reports/opportunities-pipeline/report:
 *   post:
 *     summary: Generate the opportunities pipeline report
 *     tags: [Opportunities Forecast]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Opportunities pipeline report data
 */
router.post('/opportunities-pipeline/report', getOpportunitiesPipelineReport);

/**
 * @openapi
 * /api/reports/opportunities-stage-analysis/report:
 *   post:
 *     summary: Generate the opportunities stage-analysis report
 *     tags: [Opportunities Forecast]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Opportunities stage-analysis report data
 */
router.post('/opportunities-stage-analysis/report', getOpportunitiesStageAnalysisReport);

/**
 * @openapi
 * /api/reports/opportunities-won/report:
 *   post:
 *     summary: Generate the won opportunities report
 *     tags: [Opportunities Forecast]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Won opportunities report data
 */
router.post('/opportunities-won/report', getWonOpportunitiesReport);

/**
 * @openapi
 * /api/reports/opportunities-lost/report:
 *   post:
 *     summary: Generate the lost opportunities report
 *     tags: [Opportunities Forecast]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Lost opportunities report data
 */
router.post('/opportunities-lost/report', getLostOpportunitiesReport);

/**
 * @openapi
 * /api/reports/opportunities-forecast/stages:
 *   get:
 *     summary: List CRM stages
 *     tags: [Opportunities Forecast]
 *     responses:
 *       200:
 *         description: List of CRM stages
 */
router.get('/opportunities-forecast/stages', getCrmStages);

/**
 * @openapi
 * /api/reports/opportunities-forecast/territories:
 *   get:
 *     summary: List territories
 *     tags: [Opportunities Forecast]
 *     responses:
 *       200:
 *         description: List of territories
 */
router.get('/opportunities-forecast/territories', getTerritories);

/**
 * @openapi
 * /api/reports/opportunities-forecast/industries:
 *   get:
 *     summary: List industries
 *     tags: [Opportunities Forecast]
 *     responses:
 *       200:
 *         description: List of industries
 */
router.get('/opportunities-forecast/industries', getIndustries);

/**
 * @openapi
 * /api/reports/opportunities-forecast/interest-levels:
 *   get:
 *     summary: List interest levels
 *     tags: [Opportunities Forecast]
 *     responses:
 *       200:
 *         description: List of interest levels
 */
router.get('/opportunities-forecast/interest-levels', getInterestLevels);

/**
 * @openapi
 * /api/reports/opportunities-forecast/lookups:
 *   get:
 *     summary: Get combined lookup data for opportunities forecast filters
 *     tags: [Opportunities Forecast]
 *     responses:
 *       200:
 *         description: Lookup data
 */
router.get('/opportunities-forecast/lookups', getOpportunityForecastLookups);

module.exports = router;
