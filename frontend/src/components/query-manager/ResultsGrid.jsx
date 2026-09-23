import React from 'react';
import * as XLSX from 'xlsx';

const copyAsCsv = (columns, rows) => {
  const escapeCsv = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const lines = [
    columns.map(escapeCsv).join(','),
    ...rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(',')),
  ];

  navigator.clipboard?.writeText(lines.join('\n'));
};

const exportToExcel = (columns, rows, title) => {
  const sheetRows = rows.map((row) => {
    const ordered = {};
    columns.forEach((column) => {
      ordered[column] = row[column] === null || row[column] === undefined ? '' : row[column];
    });
    return ordered;
  });

  const worksheet = XLSX.utils.json_to_sheet(sheetRows, { header: columns });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');

  const safeName = String(title || 'query-results').trim().replace(/[\\/:*?"<>|]+/g, '_') || 'query-results';
  XLSX.writeFile(workbook, `${safeName}.xlsx`);
};

const ResultsGrid = ({ columns = [], rows = [], isLoading = false, error = null, emptyMessage = 'No results yet.', title = 'query-results' }) => {
  if (isLoading) {
    return <div className="query-manager-grid-status">Running query…</div>;
  }

  if (error) {
    return <div className="query-manager-grid-status query-manager-grid-error">{error}</div>;
  }

  if (!columns.length) {
    return <div className="query-manager-grid-status">{emptyMessage}</div>;
  }

  return (
    <div className="query-manager-grid-wrapper">
      <div className="query-manager-grid-toolbar">
        <span>{rows.length} row{rows.length === 1 ? '' : 's'}</span>
        <button type="button" onClick={() => copyAsCsv(columns, rows)}>
          Copy as CSV
        </button>
        <button type="button" onClick={() => exportToExcel(columns, rows, title)}>
          Export to Excel
        </button>
      </div>
      <div className="query-manager-grid-scroll">
        <table className="query-manager-grid-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              // eslint-disable-next-line react/no-array-index-key
              <tr key={rowIndex}>
                {columns.map((column) => (
                  <td key={column}>{row[column] === null || row[column] === undefined ? '' : String(row[column])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultsGrid;
