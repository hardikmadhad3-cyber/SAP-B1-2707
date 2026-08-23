'use strict';

const normalizeUdfKey = (aliasId) => {
  let value = String(aliasId || '').trim();
  if (!value) return '';
  value = value.replace(/[^A-Za-z0-9_]+/g, '');
  if (!value) return '';
  if (!value.startsWith('U_')) value = `U_${value.replace(/^_+/, '')}`;
  return value;
};

const getPhysicalUdfKeyMap = (physicalColumns = []) => new Map(
  physicalColumns
    .map((column) => normalizeUdfKey(column?.columnName))
    .filter(Boolean)
    .map((key) => [key.toUpperCase(), key]),
);

const filterUdfMetadataRowsByPhysicalColumns = (rows = [], physicalColumns = []) => {
  const physicalKeys = getPhysicalUdfKeyMap(physicalColumns);
  return rows.filter((row) => physicalKeys.has(normalizeUdfKey(row?.AliasID).toUpperCase()));
};

const loadUdfDefinitionsOrEmpty = async (
  tableId,
  { getDefinitions, logger = console } = {},
) => {
  if (typeof getDefinitions !== 'function') {
    throw new TypeError('A UDF definition reader is required.');
  }

  try {
    const definitions = await getDefinitions(tableId);
    return Array.isArray(definitions) ? definitions : [];
  } catch (error) {
    logger?.warn?.(
      `[UDF metadata] Live definitions for ${String(tableId || '').trim() || 'unknown table'} are unavailable; continuing without UDFs: ${error.message}`,
    );
    return [];
  }
};

module.exports = {
  filterUdfMetadataRowsByPhysicalColumns,
  getPhysicalUdfKeyMap,
  loadUdfDefinitionsOrEmpty,
  normalizeUdfKey,
};
