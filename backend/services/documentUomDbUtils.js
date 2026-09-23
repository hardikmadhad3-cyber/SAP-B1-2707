const {
  createTableFieldMetadataReader,
  findPhysicalColumnName,
} = require('./salesDocumentDbCompatibility');

const readers = new WeakMap();

const quoteColumn = (alias, column) => `${alias}.[${String(column).replace(/]/g, ']]')}]`;

const hasText = (value) => value !== undefined && value !== null && String(value).trim() !== '';

const toNumber = (value, fallback = null) => {
  if (!hasText(value)) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const isManualGroup = (entry, name) => (
  (Number.isFinite(Number(entry)) && Number(entry) <= 0)
  || String(name || '').trim().toUpperCase() === 'MANUAL'
);

/**
 * Preserve the legacy uomCodes/conversions properties while publishing the
 * complete SAP identity required by document pages.
 */
const normalizeUomGroups = (rows = []) => {
  const groups = new Map();

  for (const row of rows || []) {
    const groupEntry = toNumber(row.AbsEntry ?? row.UgpEntry);
    if (groupEntry === null) continue;
    const groupName = String(row.Name ?? row.UgpCode ?? '').trim();
    const manual = isManualGroup(groupEntry, groupName);
    if (!groups.has(groupEntry)) {
      groups.set(groupEntry, {
        AbsEntry: groupEntry,
        Name: groupName,
        isManual: manual,
        uomCodes: [],
        uoms: [],
        conversions: {},
      });
    }

    const group = groups.get(groupEntry);
    const uomEntry = toNumber(row.UomEntry, manual ? -1 : null);
    const uomCode = String(row.UomCode || (manual ? 'Manual' : '')).trim();
    const uomName = String(row.UomName || uomCode || (manual ? 'Manual' : '')).trim();
    if (!uomCode && uomEntry === null) continue;
    if (group.uoms.some((uom) => uom.uomEntry === uomEntry && uom.uomCode === uomCode)) continue;

    const baseQty = toNumber(row.BaseQty, 1) || 1;
    const altQty = toNumber(row.AltQty, 1) || 1;
    const factor = baseQty > 0 ? altQty / baseQty : 1;
    const uom = { uomEntry, uomCode, uomName, baseQty, altQty, factor };
    group.uoms.push(uom);
    if (uomCode && !group.uomCodes.includes(uomCode)) group.uomCodes.push(uomCode);
    if (uomCode) group.conversions[uomCode] = { baseQty, altQty, factor };
  }

  for (const group of groups.values()) {
    if (group.isManual && group.uoms.length === 0) {
      group.uoms.push({
        uomEntry: -1,
        uomCode: 'Manual',
        uomName: 'Manual',
        baseQty: 1,
        altQty: 1,
        factor: 1,
      });
      group.uomCodes.push('Manual');
      group.conversions.Manual = { baseQty: 1, altQty: 1, factor: 1 };
    }
  }

  return [...groups.values()];
};

const getMetadataReader = (database) => {
  if (!readers.has(database)) {
    readers.set(database, createTableFieldMetadataReader({ database }));
  }
  return readers.get(database);
};

/** Load active UoM groups from the currently selected SAP company. */
const loadCompanyUomGroups = async (database) => {
  const readMetadata = getMetadataReader(database);
  const [groupMetadata, detailMetadata, uomMetadata] = await Promise.all([
    readMetadata('OUGP'),
    readMetadata('UGP1'),
    readMetadata('OUOM'),
  ]);
  const groupColumns = Object.keys(groupMetadata);
  const detailColumns = Object.keys(detailMetadata);
  const uomColumns = Object.keys(uomMetadata);
  const groupEntry = findPhysicalColumnName(groupColumns, 'UgpEntry');
  const groupCode = findPhysicalColumnName(groupColumns, 'UgpCode');
  const groupLocked = findPhysicalColumnName(groupColumns, 'Locked');
  const detailGroupEntry = findPhysicalColumnName(detailColumns, 'UgpEntry');
  const detailUomEntry = findPhysicalColumnName(detailColumns, 'UomEntry');
  const baseQty = findPhysicalColumnName(detailColumns, 'BaseQty');
  const altQty = findPhysicalColumnName(detailColumns, 'AltQty');
  const lineNum = findPhysicalColumnName(detailColumns, 'LineNum');
  const masterUomEntry = findPhysicalColumnName(uomColumns, 'UomEntry');
  const masterUomCode = findPhysicalColumnName(uomColumns, 'UomCode');
  const masterUomName = findPhysicalColumnName(uomColumns, 'UomName');

  if (!groupEntry || !groupCode) return [];
  const canJoin = detailGroupEntry && detailUomEntry && masterUomEntry;
  const select = (alias, column, fallback, output) => (
    column ? `${quoteColumn(alias, column)} AS ${output}` : `${fallback} AS ${output}`
  );
  const sql = `
    SELECT
      ${select('G', groupEntry, 'NULL', 'AbsEntry')},
      ${select('G', groupCode, "''", 'Name')},
      ${select('U', canJoin ? masterUomEntry : null, 'NULL', 'UomEntry')},
      ${select('U', canJoin ? masterUomCode : null, "''", 'UomCode')},
      ${select('U', canJoin ? masterUomName : null, "''", 'UomName')},
      ${select('D', canJoin ? baseQty : null, '1', 'BaseQty')},
      ${select('D', canJoin ? altQty : null, '1', 'AltQty')}
    FROM OUGP G
    ${canJoin ? `LEFT JOIN UGP1 D ON ${quoteColumn('D', detailGroupEntry)} = ${quoteColumn('G', groupEntry)}` : ''}
    ${canJoin ? `LEFT JOIN OUOM U ON ${quoteColumn('U', masterUomEntry)} = ${quoteColumn('D', detailUomEntry)}` : ''}
    ${groupLocked ? `WHERE COALESCE(${quoteColumn('G', groupLocked)}, 'N') <> 'Y'` : ''}
    ORDER BY ${quoteColumn('G', groupEntry)}${canJoin && lineNum ? `, ${quoteColumn('D', lineNum)}` : ''}
  `;
  const result = await database.query(sql);
  return normalizeUomGroups(result.recordset || result || []);
};

/**
 * Build a company/schema-safe UoM display expression for a marketing-document line.
 *
 * SAP B1's unitMsr value is not consistent between company databases: depending on
 * configuration/version it may contain the UoM code instead of its display name.
 * UomEntry -> OUOM.UomName is the stable source when those physical columns exist.
 */
const getDocumentUomSql = async (database, tableName, tableAlias = 'T0', uomAlias = 'DOC_UOM') => {
  const readMetadata = getMetadataReader(database);
  const [lineMetadata, uomMetadata] = await Promise.all([
    readMetadata(tableName),
    readMetadata('OUOM'),
  ]);
  const lineColumns = Object.keys(lineMetadata);
  const uomColumns = Object.keys(uomMetadata);
  const lineUomEntry = findPhysicalColumnName(lineColumns, 'UomEntry');
  const lineUnitMsr = findPhysicalColumnName(lineColumns, 'unitMsr');
  const masterUomEntry = findPhysicalColumnName(uomColumns, 'UomEntry');
  const masterUomName = findPhysicalColumnName(uomColumns, 'UomName');
  const masterUomCode = findPhysicalColumnName(uomColumns, 'UomCode');
  const lineFallback = lineUnitMsr ? quoteColumn(tableAlias, lineUnitMsr) : "''";

  const entrySql = lineUomEntry ? quoteColumn(tableAlias, lineUomEntry) : 'NULL';
  if (!lineUomEntry || !masterUomEntry || (!masterUomName && !masterUomCode)) {
    return {
      entrySql,
      codeSql: lineFallback,
      nameSql: lineFallback,
      valueSql: lineFallback,
      joinSql: '',
    };
  }

  const preferredNameValues = [masterUomName, lineUnitMsr, masterUomCode]
    .filter(Boolean)
    .map((column) => (
      column === lineUnitMsr
        ? `NULLIF(${quoteColumn(tableAlias, column)}, '')`
        : `NULLIF(${quoteColumn(uomAlias, column)}, '')`
    ));

  const preferredCodeValues = [masterUomCode, lineUnitMsr, masterUomName]
    .filter(Boolean)
    .map((column) => (
      column === lineUnitMsr
        ? `NULLIF(${quoteColumn(tableAlias, column)}, '')`
        : `NULLIF(${quoteColumn(uomAlias, column)}, '')`
    ));

  const joinedNameSql = `COALESCE(${preferredNameValues.join(', ')}, '')`;
  const joinedCodeSql = `COALESCE(${preferredCodeValues.join(', ')}, '')`;
  const manualNameSql = lineUnitMsr
    ? `COALESCE(NULLIF(${quoteColumn(tableAlias, lineUnitMsr)}, ''), 'Manual')`
    : "'Manual'";
  const nameSql = `CASE WHEN ${entrySql} < 0 THEN ${manualNameSql} ELSE ${joinedNameSql} END`;
  const codeSql = `CASE WHEN ${entrySql} < 0 THEN 'Manual' ELSE ${joinedCodeSql} END`;
  return {
    entrySql,
    codeSql,
    nameSql,
    valueSql: nameSql,
    joinSql: `LEFT JOIN OUOM ${uomAlias} ON ${quoteColumn(uomAlias, masterUomEntry)} = ${quoteColumn(tableAlias, lineUomEntry)}`,
  };
};

module.exports = {
  getDocumentUomSql,
  isManualGroup,
  loadCompanyUomGroups,
  normalizeUomGroups,
};
