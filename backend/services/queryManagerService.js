const authDbService = require('./authDbService');
const dbService = require('./dbService');
const sqlSafetyService = require('./sqlSafetyService');

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeText = (value) => String(value ?? '').trim();
const toInt = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

const requireAuthContext = (auth) => {
  const userId = toInt(auth?.userId);
  const companyId = toInt(auth?.companyId);
  if (!userId || !companyId) {
    throw createHttpError(401, 'A valid company session is required.');
  }
  return { userId, companyId };
};

// ---------------------------------------------------------------- Folders

const normalizeFolder = (row) => ({
  folderId: row.FolderId,
  folderName: row.FolderName,
  parentId: row.ParentId,
  sortOrder: Number(row.SortOrder || 0),
  companyId: row.CompanyId,
  createdBy: row.CreatedBy,
  createdAt: row.CreatedAt,
  updatedAt: row.UpdatedAt,
});

const normalizeQuery = (row) => ({
  queryId: row.QueryId,
  queryName: row.QueryName,
  folderId: row.FolderId,
  sqlText: row.SqlText,
  rowLimit: Number(row.RowLimit || sqlSafetyService.DEFAULT_ROW_CAP),
  description: row.Description,
  dialect: row.Dialect,
  isActive: Boolean(row.IsActive),
  companyId: row.CompanyId,
  createdBy: row.CreatedBy,
  createdAt: row.CreatedAt,
  updatedAt: row.UpdatedAt,
  lastRunAt: row.LastRunAt,
});

const buildFolderTree = (folders, queries) => {
  const foldersById = new Map(folders.map((folder) => [folder.folderId, { ...folder, children: [], queries: [] }]));
  const roots = [];

  for (const folder of foldersById.values()) {
    if (folder.parentId && foldersById.has(folder.parentId)) {
      foldersById.get(folder.parentId).children.push(folder);
    } else {
      roots.push(folder);
    }
  }

  for (const query of queries) {
    const leaf = { queryId: query.queryId, queryName: query.queryName, sortOrder: 0 };
    if (query.folderId && foldersById.has(query.folderId)) {
      foldersById.get(query.folderId).queries.push(leaf);
    } else {
      roots.push({ ...leaf, isRootQuery: true });
    }
  }

  const sortNode = (node) => {
    if (node.children) {
      node.children.sort((left, right) => left.sortOrder - right.sortOrder || left.folderName.localeCompare(right.folderName));
      node.children.forEach(sortNode);
    }
    if (node.queries) {
      node.queries.sort((left, right) => left.queryName.localeCompare(right.queryName));
    }
  };
  roots.forEach(sortNode);

  return roots;
};

const getFolderTree = async (auth) => {
  const { companyId } = requireAuthContext(auth);

  const [folderRows, queryRows] = await Promise.all([
    authDbService.queryRows(
      `SELECT FolderId, FolderName, ParentId, SortOrder, CompanyId, CreatedBy, CreatedAt, UpdatedAt
       FROM dbo.SavedQueryFolders
       WHERE CompanyId = @companyId
       ORDER BY SortOrder, FolderName`,
      { companyId },
    ),
    authDbService.queryRows(
      `SELECT QueryId, QueryName, FolderId
       FROM dbo.SavedQueries
       WHERE CompanyId = @companyId AND IsActive = 1
       ORDER BY QueryName`,
      { companyId },
    ),
  ]);

  const folders = folderRows.map(normalizeFolder);
  const queries = queryRows.map((row) => ({ queryId: row.QueryId, queryName: row.QueryName, folderId: row.FolderId }));

  return { tree: buildFolderTree(folders, queries) };
};

const getOwnFolder = async (folderId, companyId) => {
  const folder = await authDbService.queryOne(
    `SELECT FolderId, FolderName, ParentId, CompanyId FROM dbo.SavedQueryFolders WHERE FolderId = @folderId`,
    { folderId },
  );
  if (!folder || Number(folder.CompanyId) !== companyId) {
    return null;
  }
  return folder;
};

const createFolder = async (payload, auth) => {
  const { userId, companyId } = requireAuthContext(auth);
  const folderName = normalizeText(payload?.folderName);
  const parentId = toInt(payload?.parentId);

  if (!folderName) {
    throw createHttpError(400, 'folderName is required.');
  }

  if (parentId) {
    const parent = await getOwnFolder(parentId, companyId);
    if (!parent) {
      throw createHttpError(403, 'Parent folder not found in this company.');
    }
  }

  const inserted = await authDbService.query(
    `INSERT INTO dbo.SavedQueryFolders (FolderName, ParentId, SortOrder, CompanyId, CreatedBy, CreatedAt)
     OUTPUT INSERTED.FolderId AS FolderId
     VALUES (@folderName, @parentId, 0, @companyId, @createdBy, SYSUTCDATETIME())`,
    { folderName, parentId, companyId, createdBy: userId },
  );

  const folderId = inserted.recordset?.[0]?.FolderId;
  return { folderId, folderName, parentId: parentId || null, sortOrder: 0, companyId };
};

const renameOrMoveFolder = async (folderId, payload, auth) => {
  const { companyId } = requireAuthContext(auth);
  const folder = await getOwnFolder(folderId, companyId);
  if (!folder) {
    throw createHttpError(404, 'Folder not found.');
  }

  const folderName = payload?.folderName !== undefined ? normalizeText(payload.folderName) : folder.FolderName;
  const parentId = payload?.parentId !== undefined ? toInt(payload.parentId) : folder.ParentId;

  if (!folderName) {
    throw createHttpError(400, 'folderName cannot be empty.');
  }
  if (parentId === folderId) {
    throw createHttpError(400, 'A folder cannot be its own parent.');
  }
  if (parentId) {
    const parent = await getOwnFolder(parentId, companyId);
    if (!parent) {
      throw createHttpError(403, 'Target parent folder not found in this company.');
    }
  }

  await authDbService.query(
    `UPDATE dbo.SavedQueryFolders SET FolderName = @folderName, ParentId = @parentId, UpdatedAt = SYSUTCDATETIME()
     WHERE FolderId = @folderId`,
    { folderId, folderName, parentId },
  );

  return { folderId, folderName, parentId: parentId || null, companyId };
};

const deleteFolder = async (folderId, auth) => {
  const { companyId } = requireAuthContext(auth);
  const folder = await getOwnFolder(folderId, companyId);
  if (!folder) {
    throw createHttpError(404, 'Folder not found.');
  }

  const [childFolder, childQuery] = await Promise.all([
    authDbService.queryOne(`SELECT FolderId FROM dbo.SavedQueryFolders WHERE ParentId = @folderId`, { folderId }),
    authDbService.queryOne(`SELECT QueryId FROM dbo.SavedQueries WHERE FolderId = @folderId`, { folderId }),
  ]);

  if (childFolder || childQuery) {
    throw createHttpError(409, 'Folder is not empty. Move or delete its contents first.');
  }

  await authDbService.query(`DELETE FROM dbo.SavedQueryFolders WHERE FolderId = @folderId`, { folderId });
  return { deleted: true };
};

// ---------------------------------------------------------------- Queries

const getOwnQueryRow = async (queryId, companyId) => {
  const row = await authDbService.queryOne(
    `SELECT QueryId, QueryName, FolderId, SqlText, RowLimit, Description, Dialect, IsActive, CompanyId, CreatedBy, CreatedAt, UpdatedAt, LastRunAt
     FROM dbo.SavedQueries WHERE QueryId = @queryId`,
    { queryId },
  );
  if (!row || Number(row.CompanyId) !== companyId) {
    return null;
  }
  return row;
};

const getSavedQuery = async (queryId, auth) => {
  const { companyId } = requireAuthContext(auth);
  const row = await getOwnQueryRow(queryId, companyId);
  if (!row) {
    throw createHttpError(404, 'Saved query not found.');
  }
  return normalizeQuery(row);
};

const createSavedQuery = async (payload, auth) => {
  const { userId, companyId } = requireAuthContext(auth);
  const queryName = normalizeText(payload?.queryName);
  const folderId = toInt(payload?.folderId);
  const sqlText = normalizeText(payload?.sqlText);
  const rowLimit = toInt(payload?.rowLimit) || sqlSafetyService.DEFAULT_ROW_CAP;
  const description = normalizeText(payload?.description) || null;

  if (!queryName || !sqlText) {
    throw createHttpError(400, 'queryName and sqlText are required.');
  }
  if (folderId) {
    const folder = await getOwnFolder(folderId, companyId);
    if (!folder) {
      throw createHttpError(403, 'Target folder not found in this company.');
    }
  }

  // Validate at save time too, using the active company's SQL dialect.
  const dialect = await dbService.getDialect();
  sqlSafetyService.validateAndPrepare(sqlText, { rowLimit, dialect });

  const inserted = await authDbService.query(
    `INSERT INTO dbo.SavedQueries (QueryName, FolderId, SqlText, RowLimit, Description, Dialect, CompanyId, CreatedBy, CreatedAt)
     OUTPUT INSERTED.QueryId AS QueryId
     VALUES (@queryName, @folderId, @sqlText, @rowLimit, @description, @dialect, @companyId, @createdBy, SYSUTCDATETIME())`,
    { queryName, folderId, sqlText, rowLimit, description, dialect, companyId, createdBy: userId },
  );

  const queryId = inserted.recordset?.[0]?.QueryId;
  return getSavedQuery(queryId, auth);
};

const updateSavedQuery = async (queryId, payload, auth) => {
  const { companyId } = requireAuthContext(auth);
  const existing = await getOwnQueryRow(queryId, companyId);
  if (!existing) {
    throw createHttpError(404, 'Saved query not found.');
  }

  const queryName = payload?.queryName !== undefined ? normalizeText(payload.queryName) : existing.QueryName;
  const folderId = payload?.folderId !== undefined ? toInt(payload.folderId) : existing.FolderId;
  const sqlText = payload?.sqlText !== undefined ? normalizeText(payload.sqlText) : existing.SqlText;
  const rowLimit = payload?.rowLimit !== undefined ? (toInt(payload.rowLimit) || sqlSafetyService.DEFAULT_ROW_CAP) : existing.RowLimit;
  const description = payload?.description !== undefined ? (normalizeText(payload.description) || null) : existing.Description;

  if (!queryName || !sqlText) {
    throw createHttpError(400, 'queryName and sqlText cannot be empty.');
  }
  if (folderId) {
    const folder = await getOwnFolder(folderId, companyId);
    if (!folder) {
      throw createHttpError(403, 'Target folder not found in this company.');
    }
  }

  if (payload?.sqlText !== undefined) {
    const dialect = await dbService.getDialect();
    sqlSafetyService.validateAndPrepare(sqlText, { rowLimit, dialect });
  }

  await authDbService.query(
    `UPDATE dbo.SavedQueries
     SET QueryName = @queryName, FolderId = @folderId, SqlText = @sqlText, RowLimit = @rowLimit,
         Description = @description, UpdatedAt = SYSUTCDATETIME()
     WHERE QueryId = @queryId`,
    { queryId, queryName, folderId, sqlText, rowLimit, description },
  );

  return getSavedQuery(queryId, auth);
};

const deleteSavedQuery = async (queryId, auth) => {
  const { companyId } = requireAuthContext(auth);
  const existing = await getOwnQueryRow(queryId, companyId);
  if (!existing) {
    throw createHttpError(404, 'Saved query not found.');
  }

  await authDbService.query(`DELETE FROM dbo.SavedQueries WHERE QueryId = @queryId`, { queryId });
  return { deleted: true };
};

// ---------------------------------------------------------------- Run / Preview

const withTimeout = async (promise, timeoutMs) => {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(createHttpError(504, 'Query timed out. It may still be running against the database.'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
};

const executeSafeSql = async (sqlText, rowLimit) => {
  const dialect = await dbService.getDialect();
  const { safeSql, appliedLimit } = sqlSafetyService.validateAndPrepare(sqlText, { rowLimit, dialect });

  const result = await withTimeout(
    dbService.query(safeSql, { safetyRowCap: appliedLimit }),
    sqlSafetyService.QUERY_TIMEOUT_MS,
  );

  const rows = result.recordset || [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return {
    columns,
    rows,
    rowCount: rows.length,
    truncated: rows.length >= appliedLimit,
  };
};

const runAdhocQuery = async (payload, auth) => {
  requireAuthContext(auth);
  const sqlText = normalizeText(payload?.sqlText);
  const rowLimit = toInt(payload?.rowLimit) || sqlSafetyService.DEFAULT_ROW_CAP;

  if (!sqlText) {
    throw createHttpError(400, 'sqlText is required.');
  }

  return executeSafeSql(sqlText, rowLimit);
};

const runSavedQuery = async (queryId, auth) => {
  const { companyId } = requireAuthContext(auth);
  const row = await getOwnQueryRow(queryId, companyId);
  if (!row) {
    throw createHttpError(404, 'Saved query not found.');
  }

  const result = await executeSafeSql(row.SqlText, row.RowLimit);

  await authDbService.query(
    `UPDATE dbo.SavedQueries SET LastRunAt = SYSUTCDATETIME() WHERE QueryId = @queryId`,
    { queryId },
  );

  return { ...result, executedAt: new Date().toISOString() };
};

module.exports = {
  getFolderTree,
  createFolder,
  renameOrMoveFolder,
  deleteFolder,
  getSavedQuery,
  createSavedQuery,
  updateSavedQuery,
  deleteSavedQuery,
  runAdhocQuery,
  runSavedQuery,
};
