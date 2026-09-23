const { buildDocumentConfirmationPayload, updateDocumentConfirmationOnly } = require('./documentConfirmationUtils');
const { createSeriesReader } = require('./documentSeriesDbUtils');
const { buildDocumentSeriesPayload } = require('./documentSeriesPayloadUtils');
const sapService = require('./sapService');
const db = require('./dbService');
const { createPhysicalColumnSetReader, selectPhysicalOptionalColumn } = require('./salesDocumentDbCompatibility');
const { loadBusinessPartnerAddresses } = require('./businessPartnerAddressDbUtils');
const purchaseOrderDb = require('./purchaseOrderDbService');
const { getDocumentFreightCharges } = require('./freightChargesDbService');
const { buildDocumentAdditionalExpenses } = require('./freightPayloadUtils');
const { getMarketingDocumentUdfs, getUdfDefinitions } = require('./udfMetadataService');
const { isSapUdfKey, normalizeUdfValues } = require('./udfPayloadUtils');
const { buildDocumentLineUdfValues } = require('./documentLineUdfPayloadUtils');
const { getMarketingDocumentSeries } = require('./documentSeriesDbUtils');
const { buildDocumentReferencesPayload } = require('./documentReferencesPayloadUtils');
const { buildDocumentRoundingPayload } = require('./documentRoundingPayloadUtils');

const PURCHASE_REQUEST_OBJECT_CODE = '1470000113';

const formatDateForInput = (value) => {
  if (!value) return '';
  return String(value).split('T')[0];
};

const formatDocumentStatus = (value) => {
  const normalized = String(value || '').trim();
  if (normalized === 'bost_Open' || normalized === 'O') return 'Open';
  if (normalized === 'bost_Close' || normalized === 'C') return 'Closed';
  if (normalized === 'bost_Paid') return 'Paid';
  return normalized;
};

const getUdfDefinitionsByKey = async (tableId) => {
  const definitions = await getUdfDefinitions(tableId);
  return new Map(definitions.map((field) => [field.key, field]));
};

const toNumberOrUndefined = (value) => {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const cleanObject = (value) => {
  if (Array.isArray(value)) {
    return value.map(cleanObject).filter((item) => item !== undefined);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, nestedValue]) => {
      const cleanedValue = cleanObject(nestedValue);
      const preserveNullUdf = isSapUdfKey(key) && cleanedValue === null;
      const isEmptyObject =
        cleanedValue &&
        typeof cleanedValue === 'object' &&
        !Array.isArray(cleanedValue) &&
        Object.keys(cleanedValue).length === 0;

      if (
        cleanedValue === undefined ||
        (cleanedValue === null && !preserveNullUdf) ||
        cleanedValue === '' ||
        isEmptyObject
      ) {
        return acc;
      }

      acc[key] = cleanedValue;
      return acc;
    }, {});
  }

  return value;
};

const safeQuery = async (query, params = {}) => {
  try {
    const result = await db.query(query, params);
    return result.recordset || [];
  } catch (_error) {
    return [];
  }
};

const extractUdfValues = (value = {}) => Object.fromEntries(
  Object.entries(value).filter(([key]) => isSapUdfKey(key))
);

const getTableColumns = createPhysicalColumnSetReader(db);

const optionalColumn = (columns, name, fallback, alias = name) => (
  selectPhysicalOptionalColumn(columns, 'T0', name, alias, fallback)
);

const getRequesterReferenceData = async () => {
  const { read } = await createSeriesReader(require('./dbService'));
  const requesterBranches = await read('OUBR', ['Code', 'Name'], {}, { optional: true });
  const [userColumns, employeeColumns, departmentColumns, accountColumns] = await Promise.all([
    getTableColumns('OUSR'),
    getTableColumns('OHEM'),
    getTableColumns('OUDP'),
    getTableColumns('OACT'),
  ]);

  const users = userColumns.size ? await safeQuery(`
    SELECT
      ${optionalColumn(userColumns, 'USERID', 'NULL', 'id')},
      ${optionalColumn(userColumns, 'USER_CODE', "''", 'code')},
      ${optionalColumn(userColumns, 'U_NAME', "''", 'name')},
      ${optionalColumn(userColumns, 'E_Mail', "''", 'email')},
      ${optionalColumn(userColumns, 'Branch', 'NULL', 'branch')},
      ${optionalColumn(userColumns, 'Department', 'NULL', 'department')}
    FROM OUSR T0
    ${userColumns.has('LOCKED') ? "WHERE ISNULL(T0.Locked, 'N') <> 'Y'" : ''}
    ORDER BY ${userColumns.has('USER_CODE') ? 'T0.USER_CODE' : '1'}
  `) : [];

  const employees = employeeColumns.size ? await safeQuery(`
    SELECT
      ${optionalColumn(employeeColumns, 'empID', 'NULL', 'id')},
      ${optionalColumn(employeeColumns, 'firstName', "''", 'firstName')},
      ${optionalColumn(employeeColumns, 'middleName', "''", 'middleName')},
      ${optionalColumn(employeeColumns, 'lastName', "''", 'lastName')},
      ${optionalColumn(employeeColumns, 'email', "''", 'email')},
      ${optionalColumn(employeeColumns, 'branch', 'NULL', 'branch')},
      ${optionalColumn(employeeColumns, 'dept', 'NULL', 'department')},
      ${optionalColumn(employeeColumns, 'userId', 'NULL', 'userId')}
    FROM OHEM T0
    ${employeeColumns.has('ACTIVE') ? "WHERE ISNULL(T0.Active, 'Y') = 'Y'" : ''}
    ORDER BY ${employeeColumns.has('FIRSTNAME') ? 'T0.firstName' : '1'}
  `) : [];

  const departments = departmentColumns.size ? await safeQuery(`
    SELECT
      ${optionalColumn(departmentColumns, 'Code', 'NULL', 'code')},
      ${optionalColumn(departmentColumns, 'Name', "''", 'name')}
    FROM OUDP T0
    ORDER BY ${departmentColumns.has('NAME') ? 'T0.Name' : '1'}
  `) : [];

  const serviceAccounts = accountColumns.size ? await safeQuery(`
    SELECT
      ${optionalColumn(accountColumns, 'AcctCode', "''", 'code')},
      ${optionalColumn(accountColumns, 'AcctName', "''", 'name')}
    FROM OACT T0
    ${accountColumns.has('POSTABLE') ? "WHERE ISNULL(T0.Postable, 'N') = 'Y'" : ''}
    ORDER BY ${accountColumns.has('ACCTCODE') ? 'T0.AcctCode' : '1'}
  `) : [];

  return {
    requester_branches: requesterBranches.map(row => ({ code: String(row.Code), name: String(row.Name || row.Code) })),
    requester_users: users.map((row) => ({
      id: row.id == null ? '' : String(row.id),
      code: String(row.code || row.id || ''),
      name: String(row.name || row.code || ''),
      email: String(row.email || ''),
      branch: row.branch == null ? '' : String(row.branch),
      department: row.department == null ? '' : String(row.department),
    })),
    requester_employees: employees.map((row) => ({
      id: row.id == null ? '' : String(row.id),
      code: row.id == null ? '' : String(row.id),
      name: [row.firstName, row.middleName, row.lastName].map((value) => String(value || '').trim()).filter(Boolean).join(' '),
      email: String(row.email || ''),
      branch: row.branch == null ? '' : String(row.branch),
      department: row.department == null ? '' : String(row.department),
      userId: row.userId == null ? '' : String(row.userId),
    })),
    departments: departments.map((row) => ({
      code: row.code == null ? '' : String(row.code),
      name: String(row.name || row.code || ''),
    })),
    service_accounts: serviceAccounts.map((row) => ({
      code: String(row.code || ''),
      name: String(row.name || row.code || ''),
    })).filter((row) => row.code),
  };
};

const getReferenceData = async (_companyId) => {
  try {
    const [data, requesterData, udfMetadata] = await Promise.all([
      purchaseOrderDb.getReferenceData(),
      getRequesterReferenceData(),
      getMarketingDocumentUdfs({ headerTable: 'OPRQ', lineTable: 'PRQ1' }),
    ]);
    return {
      ...data,
      ...requesterData,
      udf_metadata: udfMetadata,
      line_field_metadata: {
        matrix_columns: [],
        sap_form: {},
      },
      contacts: data.contacts || [],
      pay_to_addresses: data.pay_to_addresses || [],
      ship_to_addresses: data.ship_to_addresses || [],
      bill_to_addresses: data.bill_to_addresses || [],
    };
  } catch (error) {
    return {
      company: '',
      company_state: '',
      vendors: [],
      contacts: [],
      pay_to_addresses: [],
      ship_to_addresses: [],
      bill_to_addresses: [],
      items: [],
      warehouses: [],
      warehouse_addresses: [],
      company_address: {},
      tax_codes: [],
      payment_terms: [],
      shipping_types: [],
      branches: [],
      states: [],
      uom_groups: [],
      requester_branches: [],
      requester_users: [],
      requester_employees: [],
      departments: [],
      service_accounts: [],
      decimal_settings: {
        QtyDec: 2,
        PriceDec: 2,
        SumDec: 2,
        RateDec: 2,
        PercentDec: 2,
      },
      warnings: [`Failed to load reference data: ${error.message}`],
    };
  }
};

const getVendorDetails = async (vendorCode) => {
  if (!vendorCode) {
    return {
      contacts: [],
      pay_to_addresses: [],
      ship_to_addresses: [],
      bill_to_addresses: [],
    };
  }

  const [contacts, addressGroups] = await Promise.all([
    safeQuery(
      `
        SELECT
          T0.CardCode,
          T0.CntctCode,
          T0.Name,
          T0.FirstName,
          T0.LastName,
          T0.E_MailL AS E_Mail,
          T0.Cellolar AS MobilePhone,
          T0.Tel1 AS Phone1
        FROM OCPR T0
        WHERE T0.CardCode = @vendorCode
        ORDER BY T0.Name
      `,
      { vendorCode }
    ),
    loadBusinessPartnerAddresses(db, vendorCode, { context: 'Purchase Request' }),
  ]);

  const { billTo: billToAddresses, shipTo: shipToAddresses } = addressGroups;

  return {
    contacts,
    pay_to_addresses: billToAddresses,
    ship_to_addresses: shipToAddresses,
    bill_to_addresses: billToAddresses,
  };
};

const getDocumentSeries = async (targetDate = null, { branch = '' } = {}) => ({
  series: await getMarketingDocumentSeries({
    db,
    objectCode: PURCHASE_REQUEST_OBJECT_CODE,
    targetDate,
    branch,
    docSubType: '--',
    collapseToSapVisible: true,
  }),
});

const getNextNumber = async (series) => {
  const rows = await safeQuery(
    `
      SELECT NextNumber
      FROM NNM1
      WHERE Series = @series
        AND ObjectCode = @objectCode
    `,
    { series, objectCode: PURCHASE_REQUEST_OBJECT_CODE }
  );

  return { nextNumber: rows[0]?.NextNumber ?? null };
};

const getStateFromAddress = async (vendorCode, addressCode) => {
  const rows = await safeQuery(
    `
      SELECT State
      FROM CRD1
      WHERE CardCode = @vendorCode
        AND Address = @addressCode
    `,
    { vendorCode, addressCode }
  );

  return { state: rows[0]?.State || '' };
};

const getStateFromWarehouse = async (whsCode) => {
  const rows = await safeQuery(
    `
      SELECT State
      FROM OWHS
      WHERE WhsCode = @whsCode
    `,
    { whsCode }
  );

  return { state: rows[0]?.State || '' };
};

const getItemsForModal = async () => {
  const items = await purchaseOrderDb.getItemsForModal();
  return { items };
};

const getItemHsnMap = async (itemCodes = []) => {
  const uniqueItemCodes = Array.from(
    new Set(itemCodes.map((itemCode) => String(itemCode || '').trim()).filter(Boolean))
  );

  if (!uniqueItemCodes.length) {
    return {};
  }

  const params = uniqueItemCodes.reduce((acc, itemCode, index) => {
    acc[`item${index}`] = itemCode;
    return acc;
  }, {});

  const placeholders = uniqueItemCodes.map((_, index) => `@item${index}`).join(', ');
  const rows = await safeQuery(
    `
      SELECT
        T0.ItemCode,
        CHP.ChapterID AS HSNCode
      FROM OITM T0
      LEFT JOIN OCHP CHP ON CHP.AbsEntry = T0.ChapterID
      WHERE T0.ItemCode IN (${placeholders})
    `,
    params
  );

  return rows.reduce((acc, row) => {
    acc[row.ItemCode] = row.HSNCode || '';
    return acc;
  }, {});
};

const mapPurchaseRequestLineToForm = (line = {}, itemHsnMap = {}) => ({
  itemNo: line.ItemCode || '',
  itemDescription: line.ItemDescription || line.Dscription || '',
  hsnCode: itemHsnMap[line.ItemCode] || line.HSNCode || '',
  quantity:
    line.Quantity !== undefined && line.Quantity !== null ? String(line.Quantity) : '',
  unitPrice:
    line.UnitPrice !== undefined && line.UnitPrice !== null
      ? String(line.UnitPrice)
      : line.Price !== undefined && line.Price !== null
        ? String(line.Price)
        : '',
  uomEntry: line.UoMEntry != null ? Number(line.UoMEntry) : null,
  uomCode: Number(line.UoMEntry) < 0 ? 'Manual' : (line.UoMCode || line.unitMsr || ''),
  uomName: line.MeasureUnit || line.unitMsr || line.UoMName || line.UoMCode || '',
  uomNameEdited: false,
  stdDiscount:
    line.DiscountPercent !== undefined && line.DiscountPercent !== null
      ? String(line.DiscountPercent)
      : line.DiscPrcnt !== undefined && line.DiscPrcnt !== null
        ? String(line.DiscPrcnt)
        : '',
  taxCode: line.TaxCode || line.VatGroup || '',
  total:
    line.LineTotal !== undefined && line.LineTotal !== null ? String(line.LineTotal) : '',
  whse: line.WarehouseCode || line.WhsCode || '',
  loc: line.LocationCode !== undefined && line.LocationCode !== null
    ? String(line.LocationCode)
    : '',
  branch: '',
  vendor: line.LineVendor || '',
  requiredDate: formatDateForInput(line.RequiredDate || line.ShipDate),
  noOfPackages: line.PackageQuantity != null ? String(line.PackageQuantity) : '',
  distributionRule: line.CostingCode || '',
  accountCode: line.AccountCode || '',
  udf: extractUdfValues(line),
});

const mapPurchaseRequestToForm = (request = {}, itemHsnMap = {}) => ({
  doc_entry: request.DocEntry,
  doc_num: request.DocNum,
  header: {
    documentType: String(request.DocType || '').toLowerCase().includes('service') ? 'Service' : 'Item',
    requesterType: Number(request.ReqType) === 171 ? 'Employee' : 'User',
    requesterCode: String(request.Requester || request.ReqCode || ''),
    requesterName: request.RequesterName || request.ReqName || '',
    requesterBranch: request.RequesterBranch != null
      ? String(request.RequesterBranch)
      : request.Branch != null ? String(request.Branch) : '',
    requesterDepartment: request.RequesterDepartment != null
      ? String(request.RequesterDepartment)
      : request.Department != null ? String(request.Department) : '',
    requesterEmail: request.RequesterEmail || request.Email || '',
    sendEmail: ['TYES', 'Y'].includes(
      String(request.SendNotification || request.Notify || '').trim().toUpperCase()
    ),
    vendor: request.CardCode || '',
    name: request.CardName || '',
    contactPerson:
      request.ContactPersonCode !== undefined && request.ContactPersonCode !== null
        ? String(request.ContactPersonCode)
        : request.CntctCode !== undefined && request.CntctCode !== null
          ? String(request.CntctCode)
          : '',
    salesContractNo: request.NumAtCard || '',
    branch:
      request.BPL_IDAssignedToInvoice !== undefined &&
      request.BPL_IDAssignedToInvoice !== null
        ? String(request.BPL_IDAssignedToInvoice)
        : request.BPLID !== undefined && request.BPLID !== null
          ? String(request.BPLID)
          : '',
    warehouse: '',
    docNo: request.DocNum !== undefined && request.DocNum !== null ? String(request.DocNum) : '',
    status: formatDocumentStatus(request.DocumentStatus) || 'Open',
    series: request.Series !== undefined && request.Series !== null ? String(request.Series) : '',
    postingDate: formatDateForInput(request.DocDate),
    validUntil: formatDateForInput(request.DocDueDate || request.ToDate),
    requiredDate: formatDateForInput(request.RequriedDate || request.RequiredDate || request.ReqDate),
    documentDate: formatDateForInput(request.TaxDate || request.DocDate),
    contractDate: formatDateForInput(request.ContractDate || request.AgreementValidFrom || ''),
    confirmed: String(request.Confirmed || '').trim() === 'tYES',
    journalRemark: request.JournalMemo || request.JrnlMemo || '',
    paymentTerms:
      request.PaymentGroupCode !== undefined && request.PaymentGroupCode !== null
        ? String(request.PaymentGroupCode)
        : request.GroupNum !== undefined && request.GroupNum !== null
          ? String(request.GroupNum)
          : '',
    otherInstruction: request.Comments || '',
    discount:
      request.DiscountPercent !== undefined && request.DiscountPercent !== null
        ? String(request.DiscountPercent)
        : request.DiscPrcnt !== undefined && request.DiscPrcnt !== null
          ? String(request.DiscPrcnt)
          : '',
    rounding:
      String(request.Rounding || '').trim().toUpperCase() === 'TYES' ||
      Math.abs(Number(request.RoundingDiffAmount ?? request.RoundDif ?? 0)) > 0,
    roundingAmount:
      request.RoundingDiffAmount !== undefined && request.RoundingDiffAmount !== null
        ? String(request.RoundingDiffAmount)
        : request.RoundDif !== undefined && request.RoundDif !== null
          ? String(request.RoundDif)
          : '',
    freight:
      request.TotalExpenses !== undefined && request.TotalExpenses !== null
        ? String(request.TotalExpenses)
        : request.TotalExpns !== undefined && request.TotalExpns !== null
          ? String(request.TotalExpns)
          : '',
    tax:
      request.VatSum !== undefined && request.VatSum !== null ? String(request.VatSum) : '',
    totalPaymentDue:
      request.DocTotal !== undefined && request.DocTotal !== null ? String(request.DocTotal) : '',
    placeOfSupply: request.PlaceOfSupply || '',
    shipTo: request.Address || '',
    payTo: request.Address2 || '',
  },
  lines:
    Array.isArray(request.DocumentLines) && request.DocumentLines.length
      ? request.DocumentLines.map((line) => mapPurchaseRequestLineToForm(line, itemHsnMap))
      : [],
  header_udfs: extractUdfValues(request),
  reference_documents: Array.isArray(request.DocumentReferences)
    ? request.DocumentReferences.map((row) => ({
        direction: 'to',
        transactionType: row.RefObjType || '',
        docEntry: row.RefDocEntr == null ? '' : String(row.RefDocEntr),
        docNumber: row.RefDocNum == null ? '' : String(row.RefDocNum),
        extDocNumber: row.ExtDocNum || '',
      }))
    : [],
});

const mapPurchaseRequestSummary = (request = {}) => ({
  doc_entry: request.DocEntry,
  doc_num: request.DocNum,
  vendor_code: request.CardCode || '',
  vendor_name: request.CardName || '',
  posting_date: formatDateForInput(request.DocDate),
  delivery_date: formatDateForInput(request.RequriedDate || request.DocDueDate),
  status: formatDocumentStatus(request.DocumentStatus),
  total_amount:
    request.DocTotal !== undefined && request.DocTotal !== null ? request.DocTotal : 0,
});

const getPurchaseRequests = async ({
  query = '',
  openOnly = false,
  docNum = '',
  vendorCode = '',
  vendorName = '',
  status = '',
  postingDateFrom = '',
  postingDateTo = '',
  page = 1,
  pageSize = 25,
} = {}) => {
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedPageSize = Math.min(200, Math.max(1, Number(pageSize) || 25));
  const skip = (normalizedPage - 1) * normalizedPageSize;
  const normalizedQuery = String(query || '').trim();
  const params = {
    docNum: '%' + String(docNum || '').trim() + '%',
    requesterCode: '%' + String(vendorCode || '').trim() + '%',
    requesterName: '%' + String(vendorName || '').trim() + '%',
    likeQuery: '%' + normalizedQuery + '%',
    postingDateFrom: postingDateFrom || null,
    postingDateTo: postingDateTo || null,
  };
  const whereClauses = ["ISNULL(T0.CANCELED, 'N') <> 'Y'"];
  if (openOnly || String(status || '').toLowerCase() === 'open') whereClauses.push("T0.DocStatus = 'O'");
  if (String(status || '').toLowerCase() === 'closed') whereClauses.push("T0.DocStatus = 'C'");
  if (String(docNum || '').trim()) whereClauses.push('CAST(T0.DocNum AS NVARCHAR(50)) LIKE @docNum');
  if (String(vendorCode || '').trim()) whereClauses.push("CAST(ISNULL(T0.Requester, '') AS NVARCHAR(50)) LIKE @requesterCode");
  if (String(vendorName || '').trim()) whereClauses.push("ISNULL(T0.ReqName, '') LIKE @requesterName");
  if (params.postingDateFrom) whereClauses.push('T0.DocDate >= @postingDateFrom');
  if (params.postingDateTo) whereClauses.push('T0.DocDate <= @postingDateTo');
  if (normalizedQuery) {
    whereClauses.push("(CAST(T0.DocNum AS NVARCHAR(50)) LIKE @likeQuery OR CAST(ISNULL(T0.Requester, '') AS NVARCHAR(50)) LIKE @likeQuery OR ISNULL(T0.ReqName, '') LIKE @likeQuery)");
  }

  const countRows = await safeQuery(`
    SELECT COUNT(*) AS total_count
    FROM OPRQ T0
    WHERE ${whereClauses.join('\n      AND ')}
  `, params);

  const totalCount = Number(countRows?.[0]?.total_count || 0);

  const rows = await safeQuery(`
    SELECT
      T0.DocEntry,
      T0.DocNum,
      CAST(ISNULL(T0.Requester, '') AS NVARCHAR(50)) AS Requester,
      ISNULL(T0.ReqName, '') AS ReqName,
      T0.DocDate,
      COALESCE(T0.RequriedDate, T0.DocDueDate) AS DeliveryDate,
      T0.DocTotal,
      T0.DocStatus,
      (
        SELECT COUNT(*)
        FROM PRQ1 T1
        WHERE T1.DocEntry = T0.DocEntry
      ) AS line_count
    FROM OPRQ T0
    WHERE ${whereClauses.join('\n      AND ')}
    ORDER BY T0.DocEntry DESC
    OFFSET @skip ROWS FETCH NEXT @top ROWS ONLY
  `, { ...params, skip, top: normalizedPageSize });

  return {
    requests: rows.map((request) => ({
      doc_entry: request.DocEntry,
      doc_num: request.DocNum,
      requester_code: request.Requester || '',
      requester_name: request.ReqName || request.Requester || '',
      vendor_code: request.Requester || '',
      vendor_name: request.ReqName || request.Requester || '',
      posting_date: formatDateForInput(request.DocDate),
      delivery_date: formatDateForInput(request.DeliveryDate),
      status: formatDocumentStatus(request.DocStatus),
      total_amount: request.DocTotal !== undefined && request.DocTotal !== null ? request.DocTotal : 0,
      line_count: Number(request.line_count || 0),
    })),
    pagination: {
      page: normalizedPage,
      pageSize: normalizedPageSize,
      totalCount,
      totalPages: Math.max(Math.ceil(totalCount / normalizedPageSize), 1),
    },
  };
};

const getVendorFilterOptions = async ({
  query = '',
  vendorCode = '',
  vendorName = '',
  top,
  display = 'code',
} = {}) => {
  const requesterData = await getRequesterReferenceData();
  const search = String(query || (display === 'name' ? vendorName : vendorCode) || '').trim().toLowerCase();
  const limit = Number(top) > 0 ? Number(top) : 200;
  const rows = [...requesterData.requester_users, ...requesterData.requester_employees]
    .filter((row) => (
      !search
      || row.code.toLowerCase().includes(search)
      || row.name.toLowerCase().includes(search)
    ))
    .sort((left, right) => String(display === 'name' ? left.name : left.code)
      .localeCompare(String(display === 'name' ? right.name : right.code)))
    .slice(0, limit);

  return {
    options: rows.map((row) => ({
      code: display === 'name' ? row.name : row.code,
      name: display === 'name' ? row.code : row.name,
    })).filter((option) => option.code),
  };
};

const getOpenPurchaseRequests = async (vendorCode = null) => {
  const rows = await safeQuery(
    `
      SELECT TOP 200
        T0.DocEntry,
        T0.DocNum,
        T0.DocDate,
        T0.RequriedDate AS DocDueDate,
        ISNULL(T0.CardCode, '') AS CardCode,
        ISNULL(T0.CardName, '') AS CardName,
        T0.Comments,
        T0.DocTotal
      FROM OPRQ T0
      WHERE T0.DocStatus = 'O'
        AND T0.CANCELED <> 'Y'
        AND (@vendorCode IS NULL OR ISNULL(T0.CardCode, '') = @vendorCode)
      ORDER BY T0.DocDate DESC, T0.DocNum DESC
    `,
    { vendorCode }
  );

  return { documents: rows };
};

const getPurchaseRequestForCopy = async (docEntry) => {
  const headerRows = await safeQuery(
    `
      SELECT
        T0.DocEntry,
        T0.DocNum,
        T0.DocDate,
        T0.RequriedDate AS DocDueDate,
        T0.TaxDate,
        ISNULL(T0.CardCode, '') AS CardCode,
        ISNULL(T0.CardName, '') AS CardName,
        T0.CntctCode,
        T0.NumAtCard,
        T0.Comments,
        ${selectPhysicalOptionalColumn(await getTableColumns('OPRQ'), 'T0', 'BPLId', 'BPLId')},
        ${selectPhysicalOptionalColumn(await getTableColumns('OPRQ'), 'T0', 'BPLId', 'BPL_IDAssignedToInvoice')},
        T0.GroupNum,
        T0.DiscPrcnt,
        T0.RoundDif,
        T0.TotalExpns AS Freight
      FROM OPRQ T0
      WHERE T0.DocEntry = @docEntry
    `,
    { docEntry }
  );

  if (!headerRows.length) {
    throw new Error(`Purchase Request ${docEntry} not found`);
  }

  const lineRows = await safeQuery(
    `
      SELECT
        T0.LineNum,
        T0.ItemCode,
        T0.Dscription AS ItemDescription,
        T0.OpenQty AS Quantity,
        T0.Price AS UnitPrice,
        T0.DiscPrcnt AS DiscountPercent,
        T0.WhsCode AS WarehouseCode,
        T0.VatGroup AS TaxCode,
        T0.unitMsr AS UomCode,
        CHP.ChapterID AS HSNCode,
        T0.DocEntry AS BaseEntry,
        T0.LineNum AS BaseLine,
        1470000113 AS BaseType
      FROM PRQ1 T0
      LEFT JOIN OITM ITM ON T0.ItemCode = ITM.ItemCode
      LEFT JOIN OCHP CHP ON ITM.ChapterID = CHP.AbsEntry
      WHERE T0.DocEntry = @docEntry
        AND T0.LineStatus = 'O'
        AND T0.OpenQty > 0
      ORDER BY T0.LineNum
    `,
    { docEntry }
  );

  return { ...headerRows[0], DocumentLines: lineRows };
};

const getPurchaseRequestByDocEntry = async (docEntry) => {
  const normalizedDocEntry = Number(docEntry);
  if (!Number.isInteger(normalizedDocEntry) || normalizedDocEntry <= 0) {
    throw new Error('A valid purchase request document entry is required.');
  }

  const response = await sapService.request({
    method: 'get',
    url: `/PurchaseRequests(${normalizedDocEntry})`,
  });

  const purchaseRequest = response.data || {};
  const itemHsnMap = await getItemHsnMap(
    Array.isArray(purchaseRequest.DocumentLines)
      ? purchaseRequest.DocumentLines.map((line) => line.ItemCode)
      : []
  );

  return {
    purchase_request: mapPurchaseRequestToForm(purchaseRequest, itemHsnMap),
  };
};

const buildDocumentLines = (lines = [], lineUdfDefinitionsByKey = null) =>
  lines
    .filter((line) => String(line.itemNo || line.accountCode || line.itemDescription || '').trim())
    .map((line) => {
      const documentLine = cleanObject({
        ItemCode: line.itemNo,
        AccountCode: line.accountCode,
        ItemDescription: line.itemDescription,
        Quantity: toNumberOrUndefined(line.quantity),
        UnitPrice: toNumberOrUndefined(line.unitPrice),
        Price: toNumberOrUndefined(line.unitPrice),
        DiscountPercent: toNumberOrUndefined(line.stdDiscount),
        TaxCode: line.taxCode,
        WarehouseCode: line.whse,
        LocationCode: toNumberOrUndefined(line.loc),
        ...(line.uomNameEdited || Number(line.uomEntry ?? line.UoMEntry) < 0
          ? {
              MeasureUnit: String(
                line.uomName ?? line.UoMName ?? line.uomCode ?? ''
              ).trim() || undefined,
            }
          : (Number.isInteger(Number(line.uomEntry ?? line.UoMEntry)) && Number(line.uomEntry ?? line.UoMEntry) > 0
            ? { UoMEntry: Number(line.uomEntry ?? line.UoMEntry) }
            : { UoMCode: line.uomCode })),
        LineVendor: line.vendor,
        RequiredDate: line.requiredDate,
        PackageQuantity: toNumberOrUndefined(
          line.noOfPackages ?? line.NoOfPackages ?? line.packageQuantity ?? line.PackageQuantity ?? line.PackQty
        ),
        CostingCode: line.distributionRule,
      });
      Object.assign(documentLine, buildDocumentLineUdfValues(line, { definitions: lineUdfDefinitionsByKey }));
      return documentLine;
    });

const buildPurchaseRequestPayload = async ({
  header = {},
  lines = [],
  header_udfs = {},
  reference_documents = [],
  freight_charges = [],
}) => {
  const sapPayload = cleanObject({
    DocType: header.documentType === 'Service' ? 'dDocument_Service' : 'dDocument_Items',
    ReqType: header.requesterType === 'Employee' ? 171 : 12,
    Requester: header.requesterCode,
    ReqCode: header.requesterCode,
    RequesterName: header.requesterName,
    RequesterBranch: toNumberOrUndefined(header.requesterBranch),
    RequesterDepartment: toNumberOrUndefined(header.requesterDepartment),
    RequesterEmail: header.requesterEmail,
    SendNotification: header.sendEmail ? 'tYES' : 'tNO',
    DocDate: header.postingDate || header.documentDate,
    DocDueDate: header.validUntil,
    RequriedDate: header.requiredDate,
    TaxDate: header.documentDate || header.postingDate,
    ...buildDocumentSeriesPayload(header),
    BPL_IDAssignedToInvoice: header.branch ? Number(header.branch) : undefined,
    Comments: header.otherInstruction,
    ...buildDocumentRoundingPayload(header),
    ...buildDocumentConfirmationPayload(header),
    DocumentReferences: buildDocumentReferencesPayload(reference_documents),
    DocumentAdditionalExpenses: buildDocumentAdditionalExpenses(freight_charges),
    DocumentLines: buildDocumentLines(lines, await getUdfDefinitionsByKey('PRQ1')),
  });

  const headerUdfDefinitionsByKey = await getUdfDefinitionsByKey('OPRQ');
  Object.assign(sapPayload, normalizeUdfValues(header_udfs, null, headerUdfDefinitionsByKey));
  return sapPayload;
};

const validatePurchaseRequestPayload = async ({ header = {}, lines = [] }) => {
  if (!String(header.requesterCode || '').trim()) throw new Error('Requester is required.');
  if (!String(header.validUntil || '').trim()) throw new Error('Valid Until date is required.');
  if (!String(header.requiredDate || '').trim()) throw new Error('Required Date is required.');
  if (header.sendEmail && !String(header.requesterEmail || '').trim()) {
    throw new Error('E-Mail Address is required when requester notification is enabled.');
  }

  const populatedLines = lines.filter((line) => (
    String(line.itemNo || line.accountCode || line.itemDescription || '').trim()
  ));
  if (!populatedLines.length) throw new Error('At least one document line is required.');

  populatedLines.forEach((line, index) => {
    if (!String(line.requiredDate || '').trim()) {
      throw new Error(`Required Date is required on row ${index + 1}.`);
    }
    if (header.documentType !== 'Service' && Number(line.quantity) <= 0) {
      throw new Error(`Required Quantity must be greater than zero on row ${index + 1}.`);
    }
    if (header.documentType === 'Service' && !String(line.accountCode || '').trim()) {
      throw new Error(`G/L Account is required on row ${index + 1}.`);
    }
  });
};

const submitPurchaseRequest = async (payload) => {
  await validatePurchaseRequestPayload(payload);
  const purchaseRequestPayload = await buildPurchaseRequestPayload(payload);

  const response = await sapService.request({
    method: 'post',
    url: '/PurchaseRequests',
    data: purchaseRequestPayload,
  });

  return {
    message: 'Purchase request posted successfully.',
    doc_num: response.data?.DocNum,
    doc_entry: response.data?.DocEntry,
    sap_response: response.data,
  };
};

const updatePurchaseRequest = async (docEntry, payload) => {
  const confirmationResult = await updateDocumentConfirmationOnly(docEntry, payload, 'PurchaseRequests', sapService);
  if (confirmationResult) return confirmationResult;
  await validatePurchaseRequestPayload(payload);
  const purchaseRequestPayload = await buildPurchaseRequestPayload(payload);

  const response = await sapService.request({
    method: 'patch',
    url: `/PurchaseRequests(${docEntry})`,
    data: purchaseRequestPayload,
  });

  return {
    message: 'Purchase request updated successfully.',
    doc_num: response.data?.DocNum,
    doc_entry: docEntry,
    sap_response: response.data,
  };
};

const getFreightCharges = async (docEntry) => {
  try {
    const freightCharges = await getDocumentFreightCharges('PRQ3', docEntry);
    return { freightCharges };
  } catch (_error) {
    return { freightCharges: [] };
  }
};

module.exports = {
  getReferenceData,
  getVendorDetails,
  getVendorFilterOptions,
  getPurchaseRequests,
  getOpenPurchaseRequests,
  getPurchaseRequestForCopy,
  getPurchaseRequestByDocEntry,
  getDocumentSeries,
  getNextNumber,
  getStateFromAddress,
  getStateFromWarehouse,
  getItemsForModal,
  submitPurchaseRequest,
  updatePurchaseRequest,
  getFreightCharges,
};
