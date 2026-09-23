/**
 * Auto-provisions the Gate Pass module's UDTs/UDFs/UDOs in a company's SAP DB
 * the first time the module is used, via SAP Service Layer's metadata
 * resources (UserTablesMD / UserFieldsMD / UserObjectsMD) — same approach as
 * jobWorkProvisioningService.js, reused here rather than duplicated logic.
 */
const sapService = require('./sapService');
const sapUdfMetadataService = require('./sapUdfMetadataService');
const { MASTERS, TRANSACTIONS, VALID_VALUES } = require('./gatePassSchema');

const verifiedCompanies = new Set();
const pendingProvisioning = new Map();

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

const ALREADY_EXISTS_SAP_CODES = new Set([-2035, -1120]);
const isAlreadyExists = (error) => ALREADY_EXISTS_SAP_CODES.has(Number(error?.response?.data?.error?.code));

const logStepFailure = (step, context, error) => {
  console.error(`[GatePass] Step failed: ${step} (${context})`, {
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

const createTable = async (table, tableType) => {
  try {
    await sapService.request({
      method: 'POST',
      url: '/UserTablesMD',
      data: { TableName: table.name, TableDescription: table.description, TableType: tableType },
    });
  } catch (error) {
    if (isAlreadyExists(error)) return;
    logStepFailure('createTable', table.name, error);
    throw error;
  }
};

// SAP's UDF metadata catalog stores a UDT's TableID with the "@" prefix — same
// convention confirmed in jobWorkProvisioningService.js's toPhysicalTableName.
const toPhysicalTableName = (tableName) => `@${tableName}`;

const getExistingFieldNames = (tableName) =>
  sapUdfMetadataService.getExistingFieldNames(toPhysicalTableName(tableName));

const subTypeForField = (field) => (field.type === 'Float' ? 'st_Quantity' : 'st_None');

const createField = async (tableName, field) => {
  const data = {
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
    UserObjectMD_ChildTables: udo.childTables.map((childTableName, index) => ({
      TableName: childTableName,
      ObjectName: String(index + 1),
    })),
    UserObjectMD_FindColumns: udo.findColumns.map((columnName) => ({ ColumnAlias: `U_${columnName}` })),
  };

  try {
    await sapService.request({ method: 'POST', url: '/UserObjectsMD', data });
  } catch (error) {
    if (isAlreadyExists(error)) return;
    logStepFailure('createUdo', udo.objectType, error);
    throw error;
  }
};

/** Provision a simple Code/Name lookup master (bott_MasterData) — no UDO registration needed. */
const ensureMasterSchema = async (masterKey, master) => {
  const summary = { masterKey, tablesCreated: 0 };
  if (!(await tableExists(master.table.name))) {
    await createTable(master.table, 'bott_MasterData');
    summary.tablesCreated += 1;
  }
  return summary;
};

/** Provision one transaction's master table, child tables, fields, and UDO registration. */
const ensureTransactionSchema = async (transactionKey, transaction) => {
  const summary = { transactionKey, tablesCreated: 0, fieldsCreated: 0, udoCreated: false };

  if (!(await tableExists(transaction.masterTable.name))) {
    await createTable(transaction.masterTable, 'bott_Document');
    summary.tablesCreated += 1;
  }

  for (const childTable of transaction.childTables) {
    if (!(await tableExists(childTable.name))) {
      await createTable(childTable, 'bott_DocumentLines');
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

/**
 * Idempotently provisions Gate Pass UDTs/UDFs/UDOs for the currently active
 * company. Safe to call on every request — cached per (company, key) after
 * the first successful pass, same as jobWorkProvisioningService.ensureSchema.
 *
 * `key` may be a transactionKey, a `master:<masterKey>` sentinel, or omitted
 * (with `force: true`) to provision everything at once.
 */
const runProvisioning = async (companyDb, cacheKey, key) => {
  const summaries = [];

  if (key?.startsWith('master:')) {
    const masterKey = key.slice('master:'.length);
    const master = MASTERS[masterKey];
    if (!master) throw new Error(`Unknown Gate Pass master: ${masterKey}`);
    summaries.push(await ensureMasterSchema(masterKey, master));
  } else if (key) {
    const transaction = TRANSACTIONS[key];
    if (!transaction) throw new Error(`Unknown Gate Pass transaction: ${key}`);
    summaries.push(await ensureTransactionSchema(key, transaction));
  } else {
    for (const [masterKey, master] of Object.entries(MASTERS)) {
      summaries.push(await ensureMasterSchema(masterKey, master));
    }
    for (const [transactionKey, transaction] of Object.entries(TRANSACTIONS)) {
      summaries.push(await ensureTransactionSchema(transactionKey, transaction));
    }
  }

  verifiedCompanies.add(cacheKey);

  const tablesCreated = summaries.reduce((sum, s) => sum + s.tablesCreated, 0);
  const fieldsCreated = summaries.reduce((sum, s) => sum + (s.fieldsCreated || 0), 0);
  const udosCreated = summaries.filter((s) => s.udoCreated).length;

  console.log(`[GatePass] Schema check for ${companyDb} (${key || 'all'}): ${tablesCreated} table(s), ${fieldsCreated} field(s), ${udosCreated} UDO(s) created.`);

  return { skipped: false, companyDb, tablesCreated, fieldsCreated, udosCreated };
};

const ensureSchema = async ({ transactionKey, masterKey, force = false } = {}) => {
  const key = masterKey ? `master:${masterKey}` : transactionKey;
  const companyDb = await sapService.resolveCompanyDb();
  const cacheKey = `${companyDb}:${key || '*all*'}`;
  if (!force && verifiedCompanies.has(cacheKey)) {
    return { skipped: true, companyDb };
  }

  const pending = pendingProvisioning.get(cacheKey);
  if (pending) return pending;

  const runPromise = runProvisioning(companyDb, cacheKey, key)
    .finally(() => pendingProvisioning.delete(cacheKey));
  pendingProvisioning.set(cacheKey, runPromise);
  return runPromise;
};

const clearVerifiedCache = () => verifiedCompanies.clear();

module.exports = {
  ensureSchema,
  clearVerifiedCache,
};
