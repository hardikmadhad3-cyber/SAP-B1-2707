const express = require("express");
const {
  searchBP,
  lookupBPGroups,
  lookupSalesPersons,
} = require("../controllers/businessPartnerController");
const {
  searchItems,
  lookupItemGroups,
  lookupItemProperties,
} = require("../controllers/itemController");
const purchaseController = require("../controllers/reports/purchaseAnalysis.controller");
const purchaseRequestReportController = require("../controllers/reports/purchaseRequestReport.controller");
const reportParameterLookupService = require("../services/reportParameterLookupService");

const router = express.Router();

const lookupCustomerProperties = async (_req, res) => {
  res.json(
    Array.from({ length: 64 }, (_, index) => ({
      number: index + 1,
      name: `Business Partners Property ${index + 1}`,
    })),
  );
};

/**
 * @openapi
 * /api/lookups/customers:
 *   get:
 *     summary: Search business partner customers for report parameters
 *     tags: [Report Lookups]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: top
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Matching customers
 */
router.get("/customers", (req, _res, next) => {
  req.query.type = req.query.type || "cCustomer";
  req.query.top = req.query.top || "200";
  return searchBP(req, _res, next);
});

/**
 * @openapi
 * /api/lookups/items:
 *   get:
 *     summary: Search items for report parameters
 *     tags: [Report Lookups]
 *     parameters:
 *       - in: query
 *         name: top
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Matching items
 */
router.get("/items", (req, _res, next) => {
  req.query.top = req.query.top || "200";
  return searchItems(req, _res, next);
});

/**
 * @openapi
 * /api/lookups/sales-employees:
 *   get:
 *     summary: Look up sales employees for report parameters
 *     tags: [Report Lookups]
 *     responses:
 *       200:
 *         description: List of sales employees
 */
router.get("/sales-employees", lookupSalesPersons);

/**
 * @openapi
 * /api/lookups/customer-groups:
 *   get:
 *     summary: Look up business partner groups for report parameters
 *     tags: [Report Lookups]
 *     responses:
 *       200:
 *         description: List of customer groups
 */
router.get("/customer-groups", lookupBPGroups);

/**
 * @openapi
 * /api/lookups/item-groups:
 *   get:
 *     summary: Look up item groups for report parameters
 *     tags: [Report Lookups]
 *     responses:
 *       200:
 *         description: List of item groups
 */
router.get("/item-groups", lookupItemGroups);

/**
 * @openapi
 * /api/lookups/customer-properties:
 *   get:
 *     summary: Look up business partner properties for report parameters
 *     tags: [Report Lookups]
 *     responses:
 *       200:
 *         description: List of customer properties
 */
router.get("/customer-properties", lookupCustomerProperties);

/**
 * @openapi
 * /api/lookups/item-properties:
 *   get:
 *     summary: Look up item properties for report parameters
 *     tags: [Report Lookups]
 *     responses:
 *       200:
 *         description: List of item properties
 */
router.get("/item-properties", lookupItemProperties);

/**
 * @openapi
 * /api/lookups/purchase-vendors:
 *   get:
 *     summary: Look up vendors for purchase analysis report parameters
 *     tags: [Report Lookups]
 *     responses:
 *       200:
 *         description: List of vendors
 */
router.get("/purchase-vendors", purchaseController.lookupVendors);

/**
 * @openapi
 * /api/lookups/purchase-items:
 *   get:
 *     summary: Look up items for purchase analysis report parameters
 *     tags: [Report Lookups]
 *     responses:
 *       200:
 *         description: List of items
 */
router.get("/purchase-items", purchaseController.lookupItems);

/**
 * @openapi
 * /api/lookups/purchasing-employees:
 *   get:
 *     summary: Look up purchasing employees for report parameters
 *     tags: [Report Lookups]
 *     responses:
 *       200:
 *         description: List of purchasing employees
 */
router.get("/purchasing-employees", purchaseController.lookupPurchasingEmployees);

/**
 * @openapi
 * /api/lookups/purchase-vendor-groups:
 *   get:
 *     summary: Look up vendor groups for purchase analysis report parameters
 *     tags: [Report Lookups]
 *     responses:
 *       200:
 *         description: List of vendor groups
 */
router.get("/purchase-vendor-groups", purchaseController.lookupVendorGroups);

/**
 * @openapi
 * /api/lookups/purchase-item-groups:
 *   get:
 *     summary: Look up item groups for purchase analysis report parameters
 *     tags: [Report Lookups]
 *     responses:
 *       200:
 *         description: List of item groups
 */
router.get("/purchase-item-groups", purchaseController.lookupItemGroups);

/**
 * @openapi
 * /api/lookups/purchase-vendor-properties:
 *   get:
 *     summary: Look up vendor properties for purchase analysis report parameters
 *     tags: [Report Lookups]
 *     responses:
 *       200:
 *         description: List of vendor properties
 */
router.get("/purchase-vendor-properties", purchaseController.lookupVendorProperties);

/**
 * @openapi
 * /api/lookups/purchase-item-properties:
 *   get:
 *     summary: Look up item properties for purchase analysis report parameters
 *     tags: [Report Lookups]
 *     responses:
 *       200:
 *         description: List of item properties
 */
router.get("/purchase-item-properties", purchaseController.lookupItemProperties);

/**
 * @openapi
 * /api/lookups/purchase-request-report/items:
 *   get:
 *     summary: Look up items for the purchase request report
 *     tags: [Report Lookups]
 *     responses:
 *       200:
 *         description: List of items
 */
router.get("/purchase-request-report/items", purchaseRequestReportController.lookupItems);

/**
 * @openapi
 * /api/lookups/purchase-request-report/vendors:
 *   get:
 *     summary: Look up vendors for the purchase request report
 *     tags: [Report Lookups]
 *     responses:
 *       200:
 *         description: List of vendors
 */
router.get("/purchase-request-report/vendors", purchaseRequestReportController.lookupVendors);

/**
 * @openapi
 * /api/lookups/purchase-request-report/item-groups:
 *   get:
 *     summary: Look up item groups for the purchase request report
 *     tags: [Report Lookups]
 *     responses:
 *       200:
 *         description: List of item groups
 */
router.get("/purchase-request-report/item-groups", purchaseRequestReportController.lookupItemGroups);

/**
 * @openapi
 * /api/lookups/purchase-request-report/item-properties:
 *   get:
 *     summary: Look up item properties for the purchase request report
 *     tags: [Report Lookups]
 *     responses:
 *       200:
 *         description: List of item properties
 */
router.get("/purchase-request-report/item-properties", purchaseRequestReportController.lookupItemProperties);

/**
 * @openapi
 * /api/lookups/purchase-request-report/branches:
 *   get:
 *     summary: Look up branches for the purchase request report
 *     tags: [Report Lookups]
 *     responses:
 *       200:
 *         description: List of branches
 */
router.get("/purchase-request-report/branches", purchaseRequestReportController.lookupBranches);

/**
 * @openapi
 * /api/lookups/purchase-request-report/departments:
 *   get:
 *     summary: Look up departments for the purchase request report
 *     tags: [Report Lookups]
 *     responses:
 *       200:
 *         description: List of departments
 */
router.get("/purchase-request-report/departments", purchaseRequestReportController.lookupDepartments);

/**
 * @openapi
 * /api/lookups/purchase-request-report/projects:
 *   get:
 *     summary: Look up projects for the purchase request report
 *     tags: [Report Lookups]
 *     responses:
 *       200:
 *         description: List of projects
 */
router.get("/purchase-request-report/projects", purchaseRequestReportController.lookupProjects);

/**
 * @openapi
 * /api/lookups/purchase-request-report/users:
 *   get:
 *     summary: Look up users for the purchase request report
 *     tags: [Report Lookups]
 *     responses:
 *       200:
 *         description: List of users
 */
router.get("/purchase-request-report/users", purchaseRequestReportController.lookupUsers);

/**
 * @openapi
 * /api/lookups/purchase-request-report/employees:
 *   get:
 *     summary: Look up employees for the purchase request report
 *     tags: [Report Lookups]
 *     responses:
 *       200:
 *         description: List of employees
 */
router.get("/purchase-request-report/employees", purchaseRequestReportController.lookupEmployees);

/**
 * @openapi
 * /api/lookups/report-parameters/options:
 *   get:
 *     summary: Search generic lookup options for a report parameter table
 *     tags: [Report Lookups]
 *     parameters:
 *       - in: query
 *         name: table
 *         schema:
 *           type: string
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Matching lookup options
 */
router.get("/report-parameters/options", async (req, res, next) => {
  try {
    const data = await reportParameterLookupService.searchLookupOptions({
      table: req.query.table,
      query: req.query.query || "",
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
