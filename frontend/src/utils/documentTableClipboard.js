const normalizeCell = (value) => (value === undefined || value === null ? '' : String(value));

const CALCULATED_OR_STRUCTURAL_KEYS = new Set([
  '__linenumber', '__actions', 'linenum', 'linenumber',
  'total', 'totallc', 'totalbeforetax', 'taxamount', 'grosstotal',
  'priceafterdiscount', 'itemcost', 'openqty', 'deliveredqty',
  'instock', 'qtyinwhse', 'binlocationallocation', 'loc', 'branch',
  'documentcreated',
]);

const STANDARD_COLUMN_HEADER_ALIASES = {
  unitprice: ['price'],
};

export const isReadOnlyDocumentTableColumn = (column = {}) => {
  const key = String(column.valueKey || column.key || '').trim().toLocaleLowerCase();
  return Boolean(column.readOnly || CALCULATED_OR_STRUCTURAL_KEYS.has(key));
};

export const normalizeClipboardHeader = (value) => (
  normalizeCell(value)
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
);

const getColumnKeyToken = (column = {}) => normalizeClipboardHeader(
  column.valueKey || column.key,
).replace(/[^a-z0-9]/g, '');

const getStandardHeaderAliases = (column = {}) => (
  column.isUdf
    ? []
    : (STANDARD_COLUMN_HEADER_ALIASES[getColumnKeyToken(column)] || [])
);

const isExactColumnHeader = (column, headerToken) => (
  normalizeClipboardHeader(column.label || column.key) === headerToken
);

const isStandardHeaderAlias = (column, headerToken) => (
  getStandardHeaderAliases(column).includes(headerToken)
);

const escapeTsvCell = (value) => {
  const text = normalizeCell(value);
  return /["\t\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const serializeDocumentTable = ({ columns = [], rows = [] } = {}) => {
  const visibleColumns = (columns || []).filter((column) => column && column.copyable !== false);
  const table = [
    visibleColumns.map((column) => column.label || column.key || ''),
    ...(rows || []).map((row, rowIndex) => visibleColumns.map((column) => {
      if (typeof column.getValue === 'function') return column.getValue(row, rowIndex);
      if (column.isUdf) return row?.udf?.[column.key] ?? row?.[column.key] ?? '';
      return row?.[column.key] ?? '';
    })),
  ];

  return table.map((cells) => cells.map(escapeTsvCell).join('\t')).join('\r\n');
};

export const parseClipboardTable = (text = '') => {
  const input = String(text ?? '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"' && cell === '') {
      quoted = true;
    } else if (character === '\t') {
      row.push(cell);
      cell = '';
    } else if (character === '\r' || character === '\n') {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  row.push(cell);
  rows.push(row);
  while (rows.length > 1 && rows[rows.length - 1].every((value) => value === '')) rows.pop();
  return rows;
};

export const clipboardHasMatchingHeaders = (table = [], columns = []) => {
  if (!table.length) return false;
  const destinationColumns = (columns || []).filter(
    (column) => column && column.pasteable !== false,
  );
  return table[0].some((value) => {
    const headerToken = normalizeClipboardHeader(value);
    return destinationColumns.some((column) => (
      isExactColumnHeader(column, headerToken)
      || isStandardHeaderAlias(column, headerToken)
    ));
  });
};

const makeCellPatch = (column, value) => ({
  key: column.valueKey || column.key,
  value,
  isUdf: Boolean(column.isUdf),
});

export const buildDocumentTablePaste = ({
  table = [],
  columns = [],
  startColumnIndex = 0,
  headerMode = false,
} = {}) => {
  const destinationColumns = (columns || []).filter(Boolean);
  let sourceRows = table;
  let sourceColumnMap = [];

  if (headerMode) {
    const editableColumns = destinationColumns.filter(
      (column) => column.pasteable !== false && !isReadOnlyDocumentTableColumn(column),
    );
    const headerTokens = (table[0] || []).map(normalizeClipboardHeader);
    const reservedStandardColumns = new Map();
    const claimedStandardColumns = new Set();

    // Reserve exact standard-field matches first. If both "Unit Price" and
    // "Price" are present, this leaves the latter available for the Price UDF.
    headerTokens.forEach((headerToken, sourceIndex) => {
      const exactStandard = editableColumns.find(
        (column) => !column.isUdf && isExactColumnHeader(column, headerToken),
      );
      if (exactStandard && !claimedStandardColumns.has(exactStandard)) {
        reservedStandardColumns.set(sourceIndex, exactStandard);
        claimedStandardColumns.add(exactStandard);
      }
    });

    sourceColumnMap = headerTokens.map((headerToken, sourceIndex) => {
      if (reservedStandardColumns.has(sourceIndex)) {
        return reservedStandardColumns.get(sourceIndex);
      }
      const standardAlias = editableColumns.find(
        (column) => (
          !column.isUdf
          && !claimedStandardColumns.has(column)
          && isStandardHeaderAlias(column, headerToken)
        ),
      );
      if (standardAlias) {
        claimedStandardColumns.add(standardAlias);
        return standardAlias;
      }
      return editableColumns.find(
        (column) => column.isUdf && isExactColumnHeader(column, headerToken),
      ) || null;
    });
    sourceRows = table.slice(1);
  } else {
    const safeStart = Math.max(0, Number(startColumnIndex) || 0);
    sourceColumnMap = (table[0] || []).map((_value, index) => destinationColumns[safeStart + index] || null);
  }

  return sourceRows.map((sourceRow, rowOffset) => ({
    rowOffset,
    cells: sourceRow.reduce((patches, value, sourceColumnIndex) => {
      const column = sourceColumnMap[sourceColumnIndex];
      if (!column || column.pasteable === false || isReadOnlyDocumentTableColumn(column) || value === '') return patches;
      patches.push(makeCellPatch(column, value));
      return patches;
    }, []),
  })).filter((rowPatch) => rowPatch.cells.length > 0);
};

export const applyDocumentTablePaste = ({
  lines = [],
  patches = [],
  startRowIndex = 0,
  createLine = () => ({}),
  transformLine,
} = {}) => {
  const next = [...(lines || [])];
  const firstRow = Math.max(0, Number(startRowIndex) || 0);

  patches.forEach((rowPatch) => {
    const rowIndex = firstRow + rowPatch.rowOffset;
    while (next.length <= rowIndex) next.push(createLine(next.length));
    const current = { ...(next[rowIndex] || createLine(rowIndex)) };
    let udf = { ...(current.udf || {}) };

    rowPatch.cells.forEach((cellPatch) => {
      if (cellPatch.isUdf) udf[cellPatch.key] = cellPatch.value;
      else current[cellPatch.key] = cellPatch.value;
    });
    current.udf = udf;
    next[rowIndex] = typeof transformLine === 'function'
      ? transformLine(current, rowIndex, rowPatch)
      : current;
  });

  return next;
};
