/**
 * Auto-provisions the Job Work module's UDTs/UDFs/UDOs in a company's SAP DB the
 * first time the module is used, via SAP Service Layer's metadata resources
 * (UserTablesMD / UserFieldsMD / UserObjectsMD) — the same thing the legacy
 * add-on's DI API CreateTable/CreateColumn/CreateObject calls do, just over REST.
 */
const sapService = require('./sapService');
const sapUdfMetadataService = require('./sapUdfMetadataService');
const { TRANSACTIONS, BATCH_HELPER_UDOS, STANDARD_TABLE_UDFS, VALID_VALUES } = require('./jobWorkSchema');

const verifiedCompanies = new Set();
// In-flight de-duplication: the frontend fires reference-data/list/etc.
// concurrently on page load, and each hits ensureSchemaMiddleware — without
// this, they'd each kick off a full (slow) provisioning run in parallel.
const pendingProvisioning = new Map();

// SAP Service Layer doesn't always return a clean OData 404 for metadata
// lookups (UserTablesMD/UserObjectsMD) on an object that doesn't exist yet —
// it can respond 500 with an embedded DI-API error like
// {"error":{"code":-2004,"message":{"value":"Table not found (ODBC -2004)"}}}.
// Treat both shapes as "not found" so provisioning proceeds to create it.
const NOT_FOUND_SAP_CODES = new Set([-2004, -2011, -2028]);
const NOT_FOUND_MESSAGE_PATTERN = /not found|does not exist|invalid table name/i;

const isNotFound = (error) => {
  if (error?.response?.status === 404) return true;

  const sapError = error?.response?.data?.error;
  if (!sapError) return false;

  if (NOT_FOUND_SAP_CODES.has(Number(sapError.code))) return true;

  const message = String(sapError.message?.value || sapError.message || '');
  return NOT_FOUND_MESSAGE_PATTERN.test(message);
};

// Mirrors the legacy add-on's own CreateColumn() handling in UDClass.cs, which
// treats DI API return codes -2035 ("already exists in the following tables")
// and -1120 as benign — not every duplicate is caught by our pre-check (SAP's
// UserFieldsMD $filter can lag behind fields created in an earlier partial run).
const ALREADY_EXISTS_SAP_CODES = new Set([-2035, -1120]);

const isAlreadyExists = (error) => {
  const code = Number(error?.response?.data?.error?.code);
  return ALREADY_EXISTS_SAP_CODES.has(code);
};

const logStepFailure = (step, context, error) => {
  console.error(`[JobWork] Step failed: ${step} (${context})`, {
    status: error?.response?.status,
    data: error?.response?.data,
    message: error.message,
  });
};

const tableExists = async (tableName) => {
  try {
    await sapService.request({ method: 'GET', url: sapService.buildStringKeyPath('UserTablesMD', tableName) });
    return true;
  } catch (error) {
    if (isNotFound(error)) return false;
    logStepFailure('tableExists', tableName, error);
    throw error;
  }
};

const createTable = async (table) => {
  try {
    await sapService.request({
      method: 'POST',
      url: '/UserTablesMD',
      data: {
        TableName: table.name,
        TableDescription: table.description,
        TableType: 'bott_Document',
      },
    });
  } catch (error) {
    if (isAlreadyExists(error)) return;
    logStepFailure('createTable', table.name, error);
    throw error;
  }
};

const createChildTable = async (table) => {
  try {
    await sapService.request({
      method: 'POST',
      url: '/UserTablesMD',
      data: {
        TableName: table.name,
        TableDescription: table.description,
        TableType: 'bott_DocumentLines',
      },
    });
  } catch (error) {
    if (isAlreadyExists(error)) return;
    logStepFailure('createChildTable', table.name, error);
    throw error;
  }
};

// SAP's UDF metadata catalog (CUFD) stores a UDT's TableID WITH the "@" prefix
// (confirmed from the legacy add-on's own FieldExist() helper in UDClass.cs,
// which does `if (TableName.Contains("STTL_")) TableName = "@" + TableName;`
// before querying) — even though creating the table/field uses the plain name.
// Standard SAP tables (ODLN, OWOR, DLN1) are queried by their plain name.
const toPhysicalTableName = (tableName) => (tableName.includes('STTL_') ? `@${tableName}` : tableName);

// Fetches every existing field name for a table in ONE call, instead of one
// $filter round-trip per field — SAP Service Layer calls observed in this
// environment can take tens of seconds each, so minimizing call count matters.
const getExistingFieldNames = (tableName) =>
  sapUdfMetadataService.getExistingFieldNames(toPhysicalTableName(tableName));

const subTypeForField = (field) => (field.type === 'Float' ? 'st_Quantity' : 'st_None');

const createField = async (tableName, field) => {
  const data = {
    // SAP Service Layer resolves UserFieldsMD.TableName literally against the
    // physical table (the "Table not found (ODBC -2004)" error otherwise),
    // unlike UserTablesMD lookups which use the logical (unprefixed) name.
    TableName: toPhysicalTableName(tableName),
    Name: field.name,
    Description: field.description,
    Type: `db_${field.type}`,
    SubType: subTypeForField(field),
  };

  if (field.size) data.EditSize = field.size;

  const validValues = field.validValues ? VALID_VALUES[field.validValues] : null;
  if (validValues) {
    data.ValidValuesMD = validValues.values.map((v) => ({ Value: v.value, Description: v.description }));
    if (validValues.defaultValue) data.DefaultValue = validValues.defaultValue;
  }

  try {
    await sapService.request({ method: 'POST', url: '/UserFieldsMD', data });
  } catch (error) {
    if (isAlreadyExists(error)) return;
    logStepFailure('createField', `${tableName}.${field.name}`, error);
    throw error;
  }
};

/** `existingFieldNames` must be pre-fetched once per table via getExistingFieldNames(). */
const ensureField = async (tableName, field, existingFieldNames) => {
  if (existingFieldNames.has(field.name)) return false;
  await createField(tableName, field);
  return true;
};

const udoExists = async (objectType) => {
  try {
    await sapService.request({ method: 'GET', url: sapService.buildStringKeyPath('UserObjectsMD', objectType) });
    return true;
  } catch (error) {
    if (isNotFound(error)) return false;
    logStepFailure('udoExists', objectType, error);
    throw error;
  }
};

const createUdo = async (udo) => {
  const data = {
    Code: udo.objectType,
    Name: udo.name,
    TableName: udo.objectType,
    ObjectType: 'boud_Document',
    CanCreateDefaultForm: 'tNO',
    CanFind: 'tYES',
    CanCancel: 'tYES',
    CanClose: 'tYES',
    CanDelete: 'tYES',
    CanLog: 'tYES',
    ManageSeries: udo.manageSeries ? 'tYES' : 'tNO',
    // Confirmed against a live SAP instance: Service Layer's actual property names
    // for these collections are UserObjectMD_ChildTables / UserObjectMD_FindColumns
    // (plain arrays) — "ChildTables"/"FindColumns" (with or without a nested
    // "...Collection" wrapper) are silently rejected with a -1005
    // "Data ChildTables not found" error. ChildTables.TableName is the plain
    // (unprefixed) table name, same as the UDO's own top-level TableName.
    UserObjectMD_ChildTables: udo.childTables.map((childTableName, index) => ({
      TableName: childTableName,
      ObjectName: String(index + 1),
    })),
    UserObjectMD_FindColumns: udo.findColumns.map((columnName) => ({
      ColumnAlias: `U_${columnName}`,
    })),
  };

  try {
    await sapService.request({
      method: 'POST',
      url: '/UserObjectsMD',
      data,
    });
  } catch (error) {
    if (isAlreadyExists(error)) return;
    logStepFailure('createUdo', udo.objectType, error);
    throw error;
  }
};

/** Provision one transaction's master table, child tables, fields, and UDO registration. */
const ensureTransactionSchema = async (transactionKey, transaction) => {
  const summary = { transactionKey, tablesCreated: 0, fieldsCreated: 0, udoCreated: false };

  if (!(await tableExists(transaction.masterTable.name))) {
    await createTable(transaction.masterTable);
    summary.tablesCreated += 1;
  }

  for (const childTable of transaction.childTables) {
    if (!(await tableExists(childTable.name))) {
      await createChildTable(childTable);
      summary.tablesCreated += 1;
    }
  }

  const existingMasterFields = await getExistingFieldNames(transaction.masterTable.name);
  for (const field of transaction.masterFields) {
    if (await ensureField(transaction.masterTable.name, field, existingMasterFields)) summary.fieldsCreated += 1;
  }

  for (const [tableName, fields] of Object.entries(transaction.childFields || {})) {
    const existingChildFields = await getExistingFieldNames(tableName);
    for (const field of fields) {
      if (await ensureField(tableName, field, existingChildFields)) summary.fieldsCreated += 1;
    }
  }

  if (!(await udoExists(transaction.udo.objectType))) {
    await createUdo(transaction.udo);
    summary.udoCreated = true;
  }

  return summary;
};

// These UDFs are cross-document traceability only (linking a Delivery/Production
// Order back to its originating Job Work document) — not required for the Job
// Work module's own tables to function. A failure on one of them (a native SAP
// table, unlike our own UDTs, so more prone to environment-specific quirks)
// must not block the whole module, so failures here are logged and skipped
// rather than thrown.
const ensureStandardTableUdfs = async () => {
  let created = 0;
  const fieldsByTable = STANDARD_TABLE_UDFS.reduce((acc, field) => {
    (acc[field.table] ||= []).push(field);
    return acc;
  }, {});

  for (const [table, fields] of Object.entries(fieldsByTable)) {
    let existingFields;
    try {
      existingFields = await getExistingFieldNames(table);
    } catch (error) {
      console.warn(`[JobWork] Skipping standard UDFs for ${table} (existence check failed): ${error.message}`);
      continue;
    }

    for (const field of fields) {
      try {
        if (await ensureField(table, field, existingFields)) created += 1;
      } catch (error) {
        console.warn(`[JobWork] Skipping standard UDF ${table}.${field.name} (non-fatal): ${error.message}`);
      }
    }
  }

  return created;
};

/**
 * Idempotently provisions every Job Work UDT/UDF/UDO for the currently active
 * company (resolved the same way sapService resolves company context). Safe to
 * call on every request — cached per (company, transaction) after the first
 * successful pass. Scoped to just the transaction being used, rather than all
 * 4 + the 2 internal batch UDOs, since each SAP Service Layer metadata call
 * observed in this environment can take tens of seconds — provisioning
 * everything on every page load is not viable.
 *
 * Pass no `transactionKey` (only `force: true`) to provision everything at
 * once — used by the explicit admin "re-provision" action.
 */
const runProvisioning = async (companyDb, cacheKey, transactionKey) => {
  const summaries = [];
  if (transactionKey) {
    const transaction = TRANSACTIONS[transactionKey] || BATCH_HELPER_UDOS[transactionKey];
    if (!transaction) throw new Error(`Unknown Job Work transaction: ${transactionKey}`);
    summaries.push(await ensureTransactionSchema(transactionKey, transaction));
  } else {
    for (const [key, transaction] of Object.entries(TRANSACTIONS)) {
      summaries.push(await ensureTransactionSchema(key, transaction));
    }
    for (const [key, udo] of Object.entries(BATCH_HELPER_UDOS)) {
      summaries.push(await ensureTransactionSchema(key, udo));
    }
  }
  const standardFieldsCreated = await ensureStandardTableUdfs();

  verifiedCompanies.add(cacheKey);

  const tablesCreated = summaries.reduce((sum, s) => sum + s.tablesCreated, 0);
  const fieldsCreated = summaries.reduce((sum, s) => sum + s.fieldsCreated, 0) + standardFieldsCreated;
  const udosCreated = summaries.filter((s) => s.udoCreated).length;

  console.log(
    `[JobWork] Schema check for ${companyDb} (${transactionKey || 'all'}): ${tablesCreated} table(s), ${fieldsCreated} field(s), ${udosCreated} UDO(s) created.`,
  );

  return { skipped: false, companyDb, tablesCreated, fieldsCreated, udosCreated };
};

const ensureSchema = async ({ transactionKey, force = false } = {}) => {
  const companyDb = await sapService.resolveCompanyDb();
  const cacheKey = `${companyDb}:${transactionKey || '*all*'}`;
  if (!force && verifiedCompanies.has(cacheKey)) {
    return { skipped: true, companyDb };
  }

  const pending = pendingProvisioning.get(cacheKey);
  if (pending) return pending;

  const runPromise = runProvisioning(companyDb, cacheKey, transactionKey)
    .finally(() => pendingProvisioning.delete(cacheKey));
  pendingProvisioning.set(cacheKey, runPromise);
  return runPromise;
};

const clearVerifiedCache = () => verifiedCompanies.clear();

module.exports = {
  ensureSchema,
  clearVerifiedCache,
};
