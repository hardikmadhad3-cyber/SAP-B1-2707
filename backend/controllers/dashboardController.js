const authService = require('../services/authService');
const dashboardDbService = require('../services/dashboardDbService');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isValidDate = (value) => {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const flattenMenuPaths = (menus = []) => menus.flatMap((menu) => [
  String(menu?.menuPath || '').trim(),
  ...flattenMenuPaths(menu?.children || []),
]).filter(Boolean);

const getOverview = async (req, res, next) => {
  try {
    const requestedDate = String(req.query.asOfDate || '').trim();
    if (requestedDate && !isValidDate(requestedDate)) {
      res.status(400).json({ message: 'asOfDate must use YYYY-MM-DD format.' });
      return;
    }

    const menuResult = await authService.getMenuForRole(req.auth.roleId, req.auth.companyId);
    const data = await dashboardDbService.getOverview({
      asOfDate: requestedDate || undefined,
      allowedRoutes: flattenMenuPaths(menuResult?.menus || []),
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  flattenMenuPaths,
  getOverview,
  isValidDate,
};
