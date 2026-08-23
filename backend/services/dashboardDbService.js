const db = require('./dbService');
const { getActiveCompanyConfig } = require('./companyConfigService');

const DOCUMENT_DEFINITIONS = Object.freeze([
  {
    objectType: 'salesQuotation',
    label: 'Sales Quotation',
    table: 'OQUT',
    route: '/sales-quotation',
    stateKey: 'salesQuotationDocEntry',
  },
  {
    objectType: 'salesOrder',
    label: 'Sales Order',
    table: 'ORDR',
    route: '/sales-order',
    stateKey: 'salesOrderDocEntry',
  },
  {
    objectType: 'delivery',
    label: 'Delivery',
    table: 'ODLN',
    route: '/delivery',
    stateKey: 'deliveryDocEntry',
  },
  {
    objectType: 'arInvoice',
    label: 'A/R Invoice',
    table: 'OINV',
    route: '/ar-invoice',
    stateKey: 'arInvoiceDocEntry',
  },
]);

const SALES_TOTAL_SQL = `
  WITH NetSales AS (
    SELECT doc.DocDate, CAST(ISNULL(line.LineTotal, 0) AS DECIMAL(19, 6)) AS Amount
    FROM OINV doc
    INNER JOIN INV1 line ON line.DocEntry = doc.DocEntry
    WHERE doc.CANCELED = 'N'
      AND doc.DocDate BETWEEN @previousFrom AND @currentTo

    UNION ALL

    SELECT doc.DocDate, CAST(-ISNULL(line.LineTotal, 0) AS DECIMAL(19, 6)) AS Amount
    FROM ORIN doc
    INNER JOIN RIN1 line ON line.DocEntry = doc.DocEntry
    WHERE doc.CANCELED = 'N'
      AND doc.DocDate BETWEEN @previousFrom AND @currentTo
  )
  SELECT
    CAST(SUM(CASE WHEN DocDate BETWEEN @currentFrom AND @currentTo THEN Amount ELSE 0 END) AS DECIMAL(19, 2)) AS CurrentAmount,
    CAST(SUM(CASE WHEN DocDate BETWEEN @previousFrom AND @previousTo THEN Amount ELSE 0 END) AS DECIMAL(19, 2)) AS PreviousAmount
  FROM NetSales
`;

const RECEIVABLE_SQL = `
  SELECT
    CAST(SUM(ISNULL(line.BalDueDeb, 0) - ISNULL(line.BalDueCred, 0)) AS DECIMAL(19, 2)) AS ReceivableAmount
  FROM JDT1 line
  INNER JOIN OCRD bp ON bp.CardCode = line.ShortName
  WHERE bp.CardType = 'C'
    AND line.RefDate <= @asOfDate
`;

const TOP_ITEMS_SQL = `
  WITH NetItemSales AS (
    SELECT
      line.ItemCode,
      MAX(ISNULL(item.ItemName, line.Dscription)) AS ItemName,
      CAST(SUM(ISNULL(line.LineTotal, 0)) AS DECIMAL(19, 6)) AS Amount
    FROM OINV doc
    INNER JOIN INV1 line ON line.DocEntry = doc.DocEntry
    LEFT JOIN OITM item ON item.ItemCode = line.ItemCode
    WHERE doc.CANCELED = 'N'
      AND doc.DocDate BETWEEN @currentFrom AND @currentTo
      AND line.ItemCode IS NOT NULL
      AND line.ItemCode <> ''
    GROUP BY line.ItemCode

    UNION ALL

    SELECT
      line.ItemCode,
      MAX(ISNULL(item.ItemName, line.Dscription)) AS ItemName,
      CAST(-SUM(ISNULL(line.LineTotal, 0)) AS DECIMAL(19, 6)) AS Amount
    FROM ORIN doc
    INNER JOIN RIN1 line ON line.DocEntry = doc.DocEntry
    LEFT JOIN OITM item ON item.ItemCode = line.ItemCode
    WHERE doc.CANCELED = 'N'
      AND doc.DocDate BETWEEN @currentFrom AND @currentTo
      AND line.ItemCode IS NOT NULL
      AND line.ItemCode <> ''
    GROUP BY line.ItemCode
  )
  SELECT TOP 5
    ItemCode,
    MAX(ItemName) AS ItemName,
    CAST(SUM(Amount) AS DECIMAL(19, 2)) AS Amount
  FROM NetItemSales
  GROUP BY ItemCode
  HAVING SUM(Amount) <> 0
  ORDER BY Amount DESC, ItemCode
`;

const TOP_CUSTOMERS_SQL = `
  WITH NetCustomerSales AS (
    SELECT
      doc.CardCode,
      MAX(doc.CardName) AS CardName,
      CAST(SUM(ISNULL(line.LineTotal, 0)) AS DECIMAL(19, 6)) AS Amount
    FROM OINV doc
    INNER JOIN INV1 line ON line.DocEntry = doc.DocEntry
    WHERE doc.CANCELED = 'N'
      AND doc.DocDate BETWEEN @currentFrom AND @currentTo
    GROUP BY doc.CardCode

    UNION ALL

    SELECT
      doc.CardCode,
      MAX(doc.CardName) AS CardName,
      CAST(-SUM(ISNULL(line.LineTotal, 0)) AS DECIMAL(19, 6)) AS Amount
    FROM ORIN doc
    INNER JOIN RIN1 line ON line.DocEntry = doc.DocEntry
    WHERE doc.CANCELED = 'N'
      AND doc.DocDate BETWEEN @currentFrom AND @currentTo
    GROUP BY doc.CardCode
  )
  SELECT TOP 5
    CardCode,
    MAX(CardName) AS CardName,
    CAST(SUM(Amount) AS DECIMAL(19, 2)) AS Amount
  FROM NetCustomerSales
  GROUP BY CardCode
  HAVING SUM(Amount) <> 0
  ORDER BY Amount DESC, CardCode
`;

const REVENUE_GROSS_PROFIT_SQL = `
  WITH MonthlySales AS (
    SELECT
      YEAR(doc.DocDate) AS SalesYear,
      MONTH(doc.DocDate) AS SalesMonth,
      CAST(SUM(ISNULL(line.LineTotal, 0)) AS DECIMAL(19, 6)) AS Revenue,
      CAST(SUM(ISNULL(line.GrssProfit, 0)) AS DECIMAL(19, 6)) AS GrossProfit
    FROM OINV doc
    INNER JOIN INV1 line ON line.DocEntry = doc.DocEntry
    WHERE doc.CANCELED = 'N'
      AND doc.DocDate BETWEEN @currentFrom AND @currentTo
    GROUP BY YEAR(doc.DocDate), MONTH(doc.DocDate)

    UNION ALL

    SELECT
      YEAR(doc.DocDate) AS SalesYear,
      MONTH(doc.DocDate) AS SalesMonth,
      CAST(-SUM(ISNULL(line.LineTotal, 0)) AS DECIMAL(19, 6)) AS Revenue,
      CAST(-SUM(ISNULL(line.GrssProfit, 0)) AS DECIMAL(19, 6)) AS GrossProfit
    FROM ORIN doc
    INNER JOIN RIN1 line ON line.DocEntry = doc.DocEntry
    WHERE doc.CANCELED = 'N'
      AND doc.DocDate BETWEEN @currentFrom AND @currentTo
    GROUP BY YEAR(doc.DocDate), MONTH(doc.DocDate)
  )
  SELECT
    SalesYear,
    SalesMonth,
    CAST(SUM(Revenue) AS DECIMAL(19, 2)) AS Revenue,
    CAST(SUM(GrossProfit) AS DECIMAL(19, 2)) AS GrossProfit
  FROM MonthlySales
  GROUP BY SalesYear, SalesMonth
  ORDER BY SalesYear, SalesMonth
`;

const normalizeText = (value) => String(value ?? '').trim();

const numberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const rowValue = (row, key) => {
  if (!row || typeof row !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  const actualKey = Object.keys(row).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
  return actualKey ? row[actualKey] : undefined;
};

const rowsFrom = (result) => result?.recordset || (Array.isArray(result) ? result : []);

const formatDate = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return normalizeText(value).slice(0, 10);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

const parseDate = (value) => {
  const normalized = formatDate(value);
  const date = new Date(`${normalized}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const shiftDays = (dateValue, dayCount) => {
  const date = parseDate(dateValue);
  if (!date) return '';
  date.setDate(date.getDate() + dayCount);
  return formatDate(date);
};

const buildCalendarFiscalPeriod = (asOfDate) => ({
  indicator: String(new Date(`${asOfDate}T00:00:00`).getFullYear()),
  from: `${String(asOfDate).slice(0, 4)}-01-01`,
  to: `${String(asOfDate).slice(0, 4)}-12-31`,
  source: 'calendar-fallback',
});

const buildComparisonWindow = (periodFrom, asOfDate) => {
  const from = parseDate(periodFrom);
  const to = parseDate(asOfDate);
  if (!from || !to) {
    return {
      currentFrom: periodFrom,
      currentTo: asOfDate,
      previousFrom: periodFrom,
      previousTo: asOfDate,
    };
  }

  const elapsedDays = Math.max(0, Math.round((to.getTime() - from.getTime()) / 86400000));
  const previousTo = shiftDays(periodFrom, -1);
  const previousFrom = shiftDays(previousTo, -elapsedDays);
  return {
    currentFrom: formatDate(from),
    currentTo: formatDate(to),
    previousFrom,
    previousTo,
  };
};

const calculateChangePercent = (current, previous) => {
  const currentAmount = numberValue(current);
  const previousAmount = numberValue(previous);
  if (Math.abs(previousAmount) < 0.000001) return null;
  return ((currentAmount - previousAmount) / Math.abs(previousAmount)) * 100;
};

const getTableColumns = async (database, tableNames, options = {}) => {
  const normalizedNames = [...new Set(tableNames.map(normalizeText).filter(Boolean))];
  if (!normalizedNames.length) return new Map();

  const params = {};
  const placeholders = normalizedNames.map((name, index) => {
    params[`table${index}`] = name;
    return `@table${index}`;
  });
  const result = await database.query(`
    SELECT TABLE_NAME, COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME IN (${placeholders.join(', ')})
  `, params, options);

  return rowsFrom(result).reduce((tables, row) => {
    const tableName = normalizeText(rowValue(row, 'TABLE_NAME')).toUpperCase();
    const columnName = normalizeText(rowValue(row, 'COLUMN_NAME'));
    if (!tableName || !columnName) return tables;
    if (!tables.has(tableName)) tables.set(tableName, new Map());
    tables.get(tableName).set(columnName.toLowerCase(), columnName);
    return tables;
  }, new Map());
};

const columnName = (columns, requestedName) => columns?.get(String(requestedName).toLowerCase()) || '';
const quotedColumn = (columns, requestedName, alias) => {
  const physicalName = columnName(columns, requestedName);
  return physicalName ? `${alias}.[${physicalName}]` : '';
};

const loadFiscalPeriod = async (database, asOfDate, options = {}) => {
  try {
    const result = await database.query(`
      SELECT TOP 1
        currentPeriod.Indicator AS Indicator,
        bounds.FiscalStart AS FiscalStart,
        bounds.FiscalEnd AS FiscalEnd
      FROM OFPR currentPeriod
      INNER JOIN (
        SELECT Indicator, MIN(F_RefDate) AS FiscalStart, MAX(T_RefDate) AS FiscalEnd
        FROM OFPR
        GROUP BY Indicator
      ) bounds ON bounds.Indicator = currentPeriod.Indicator
      WHERE @asOfDate BETWEEN currentPeriod.F_RefDate AND currentPeriod.T_RefDate
      ORDER BY currentPeriod.F_RefDate DESC
    `, { asOfDate }, options);
    const row = rowsFrom(result)[0];
    const from = formatDate(rowValue(row, 'FiscalStart'));
    const to = formatDate(rowValue(row, 'FiscalEnd'));
    if (from && to) {
      return {
        indicator: normalizeText(rowValue(row, 'Indicator')) || from.slice(0, 4),
        from,
        to,
        source: 'sap-posting-periods',
      };
    }
  } catch (_error) {
    // Older or customized companies may not expose the standard posting-period fields.
  }

  return buildCalendarFiscalPeriod(asOfDate);
};

const loadCurrencies = async (database, options = {}) => {
  try {
    const result = await database.query(`
      SELECT TOP 1 MainCurncy AS LocalCurrency, SysCurrncy AS SystemCurrency
      FROM OADM
    `, {}, options);
    const row = rowsFrom(result)[0] || {};
    return {
      local: normalizeText(rowValue(row, 'LocalCurrency')) || 'LC',
      system: normalizeText(rowValue(row, 'SystemCurrency')) || 'SC',
    };
  } catch (_error) {
    return { local: 'LC', system: 'SC' };
  }
};

const resolveSalesEmployeeScope = async (database, options = {}, companyConfigLoader = getActiveCompanyConfig) => {
  let sapUsername = '';
  try {
    const companyConfig = await companyConfigLoader({ databaseName: options.databaseName });
    sapUsername = normalizeText(companyConfig?.userMapping?.sapUserCode);
  } catch (_error) {
    sapUsername = '';
  }

  if (!sapUsername) {
    return { mode: 'company', salesEmployeeCode: null, label: 'Company-wide' };
  }

  try {
    const tables = await getTableColumns(database, ['OUSR', 'OHEM'], options);
    const userColumns = tables.get('OUSR');
    const employeeColumns = tables.get('OHEM');
    const userId = quotedColumn(userColumns, 'USERID', 'usr');
    const employeeUserId = quotedColumn(employeeColumns, 'userId', 'emp');
    const salesPerson = quotedColumn(employeeColumns, 'salesPrson', 'emp');
    const userCode = quotedColumn(userColumns, 'USER_CODE', 'usr');
    const userName = quotedColumn(userColumns, 'U_NAME', 'usr');
    const matchColumns = [userCode, userName].filter(Boolean);

    if (!userId || !employeeUserId || !salesPerson || !matchColumns.length) {
      return { mode: 'company', salesEmployeeCode: null, label: 'Company-wide' };
    }

    const result = await database.query(`
      SELECT TOP 1
        ${salesPerson} AS SalesEmployeeCode,
        slp.SlpName AS SalesEmployeeName
      FROM OUSR usr
      INNER JOIN OHEM emp ON ${employeeUserId} = ${userId}
      LEFT JOIN OSLP slp ON slp.SlpCode = ${salesPerson}
      WHERE ${matchColumns.map((field) => `${field} = @sapUsername`).join(' OR ')}
      ORDER BY ${salesPerson}
    `, { sapUsername }, options);
    const row = rowsFrom(result)[0];
    const code = Number(rowValue(row, 'SalesEmployeeCode'));
    if (Number.isInteger(code) && code >= 0) {
      const name = normalizeText(rowValue(row, 'SalesEmployeeName'));
      return {
        mode: 'sales-employee',
        salesEmployeeCode: code,
        label: name || sapUsername,
      };
    }
  } catch (_error) {
    // A reliable mapping is optional. The caller will use an explicitly company-wide KPI.
  }

  return { mode: 'company', salesEmployeeCode: null, label: 'Company-wide' };
};

const buildOpenOrdersSql = (salesEmployeeScoped) => `
  SELECT COUNT(DISTINCT doc.DocEntry) AS OpenOrderCount
  FROM ORDR doc
  INNER JOIN RDR1 line ON line.DocEntry = doc.DocEntry
  WHERE doc.CANCELED = 'N'
    AND doc.DocStatus = 'O'
    AND ISNULL(line.OpenQty, 0) > 0
    ${salesEmployeeScoped ? 'AND doc.SlpCode = @salesEmployeeCode' : ''}
`;

const buildRecentDocumentsSql = (definitions) => {
  if (!definitions.length) return '';
  const unions = definitions.map((definition) => `
    SELECT
      '${definition.objectType}' AS ObjectType,
      '${definition.label.replace(/'/g, "''")}' AS DocumentLabel,
      doc.DocEntry,
      doc.DocNum,
      doc.CardCode,
      doc.CardName,
      doc.DocDate,
      ISNULL(doc.UpdateDate, doc.DocDate) AS UpdatedAt
    FROM ${definition.table} doc
    WHERE doc.CANCELED = 'N'
  `);

  return `
    WITH RecentDocuments AS (
      ${unions.join('\nUNION ALL\n')}
    )
    SELECT TOP 8
      ObjectType,
      DocumentLabel,
      DocEntry,
      DocNum,
      CardCode,
      CardName,
      DocDate,
      UpdatedAt
    FROM RecentDocuments
    ORDER BY UpdatedAt DESC, DocEntry DESC
  `;
};

const buildMonthBuckets = (periodFrom, asOfDate, rows) => {
  const totalsByMonth = new Map(rows.map((row) => {
    const year = numberValue(rowValue(row, 'SalesYear'));
    const month = numberValue(rowValue(row, 'SalesMonth'));
    return [`${year}-${String(month).padStart(2, '0')}`, row];
  }));
  const start = parseDate(periodFrom);
  const end = parseDate(asOfDate);
  if (!start || !end) return [];

  const buckets = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const finalMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= finalMonth && buckets.length < 24) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    const row = totalsByMonth.get(key) || {};
    buckets.push({
      key,
      label: cursor.toLocaleString('en-US', { month: 'short' }),
      revenue: numberValue(rowValue(row, 'Revenue')),
      grossProfit: numberValue(rowValue(row, 'GrossProfit')),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
};

const createDashboardDbService = ({
  database = db,
  companyConfigLoader = getActiveCompanyConfig,
} = {}) => {
  const getOverview = async ({ asOfDate = formatDate(new Date()), allowedRoutes = [] } = {}, options = {}) => {
    const [period, currency, userScope] = await Promise.all([
      loadFiscalPeriod(database, asOfDate, options),
      loadCurrencies(database, options),
      resolveSalesEmployeeScope(database, options, companyConfigLoader),
    ]);
    const comparison = buildComparisonWindow(period.from, asOfDate);
    const queryParams = { ...comparison, asOfDate };
    const allowedRouteSet = new Set((allowedRoutes || []).map(normalizeText));
    const recentDefinitions = DOCUMENT_DEFINITIONS.filter((definition) => (
      allowedRouteSet.size === 0 || allowedRouteSet.has(definition.route)
    ));

    const tasks = {
      sales: database.query(SALES_TOTAL_SQL, queryParams, options),
      receivables: database.query(RECEIVABLE_SQL, { asOfDate }, options),
      openOrders: database.query(
        buildOpenOrdersSql(userScope.mode === 'sales-employee'),
        userScope.mode === 'sales-employee' ? { salesEmployeeCode: userScope.salesEmployeeCode } : {},
        options,
      ),
      topItems: database.query(TOP_ITEMS_SQL, comparison, options),
      topCustomers: database.query(TOP_CUSTOMERS_SQL, comparison, options),
      revenueGrossProfit: database.query(REVENUE_GROSS_PROFIT_SQL, comparison, options),
      recentUpdates: recentDefinitions.length
        ? database.query(buildRecentDocumentsSql(recentDefinitions), {}, options)
        : Promise.resolve({ recordset: [] }),
    };
    const taskNames = Object.keys(tasks);
    const settled = await Promise.allSettled(Object.values(tasks));
    const results = {};
    const warnings = [];
    settled.forEach((result, index) => {
      const name = taskNames[index];
      if (result.status === 'fulfilled') {
        results[name] = rowsFrom(result.value);
      } else {
        results[name] = [];
        warnings.push(`${name} is temporarily unavailable.`);
      }
    });

    const salesRow = results.sales[0] || {};
    const currentSales = numberValue(rowValue(salesRow, 'CurrentAmount'));
    const previousSales = numberValue(rowValue(salesRow, 'PreviousAmount'));
    const receivableRow = results.receivables[0] || {};
    const openOrdersRow = results.openOrders[0] || {};
    const definitionByType = new Map(DOCUMENT_DEFINITIONS.map((definition) => [definition.objectType, definition]));

    return {
      generatedAt: new Date().toISOString(),
      asOfDate,
      period: {
        ...period,
        currentTo: comparison.currentTo,
        previousFrom: comparison.previousFrom,
        previousTo: comparison.previousTo,
      },
      currency,
      userScope,
      kpis: {
        salesAmount: {
          value: currentSales,
          previousValue: previousSales,
          changePercent: calculateChangePercent(currentSales, previousSales),
        },
        receivableAmount: {
          value: numberValue(rowValue(receivableRow, 'ReceivableAmount')),
        },
        openSalesOrders: {
          value: numberValue(rowValue(openOrdersRow, 'OpenOrderCount')),
          scope: userScope.mode,
        },
      },
      topItems: results.topItems.map((row) => ({
        code: normalizeText(rowValue(row, 'ItemCode')),
        name: normalizeText(rowValue(row, 'ItemName')),
        value: numberValue(rowValue(row, 'Amount')),
      })),
      topCustomers: results.topCustomers.map((row) => ({
        code: normalizeText(rowValue(row, 'CardCode')),
        name: normalizeText(rowValue(row, 'CardName')),
        value: numberValue(rowValue(row, 'Amount')),
      })),
      revenueGrossProfit: buildMonthBuckets(period.from, asOfDate, results.revenueGrossProfit),
      recentUpdates: results.recentUpdates.map((row) => {
        const objectType = normalizeText(rowValue(row, 'ObjectType'));
        const definition = definitionByType.get(objectType) || {};
        return {
          id: `${objectType}:${numberValue(rowValue(row, 'DocEntry'))}`,
          objectType,
          label: normalizeText(rowValue(row, 'DocumentLabel')) || definition.label || 'Document',
          docEntry: numberValue(rowValue(row, 'DocEntry')),
          docNum: numberValue(rowValue(row, 'DocNum')),
          cardCode: normalizeText(rowValue(row, 'CardCode')),
          cardName: normalizeText(rowValue(row, 'CardName')),
          documentDate: formatDate(rowValue(row, 'DocDate')),
          updatedAt: formatDate(rowValue(row, 'UpdatedAt')),
          route: definition.route || '',
          stateKey: definition.stateKey || '',
        };
      }),
      warnings,
    };
  };

  return { getOverview };
};

const dashboardDbService = createDashboardDbService();

module.exports = {
  DOCUMENT_DEFINITIONS,
  RECEIVABLE_SQL,
  REVENUE_GROSS_PROFIT_SQL,
  SALES_TOTAL_SQL,
  TOP_CUSTOMERS_SQL,
  TOP_ITEMS_SQL,
  buildComparisonWindow,
  buildMonthBuckets,
  buildOpenOrdersSql,
  buildRecentDocumentsSql,
  calculateChangePercent,
  createDashboardDbService,
  ...dashboardDbService,
};
