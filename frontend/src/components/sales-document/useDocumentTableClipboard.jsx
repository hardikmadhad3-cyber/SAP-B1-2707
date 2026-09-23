import React from 'react';
import { createPortal } from 'react-dom';
import {
  buildDocumentTablePaste,
  clipboardHasMatchingHeaders,
  parseClipboardTable,
  serializeDocumentTable,
} from '../../utils/documentTableClipboard';

const clampMenuPosition = (clientX, clientY) => ({
  left: Math.min(clientX, Math.max(8, (window.innerWidth || 1024) - 170)),
  top: Math.min(clientY, Math.max(8, (window.innerHeight || 768) - 86)),
});

const writeClipboardText = async (text) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('The browser did not allow clipboard access.');
};

const cellPosition = (event, columnOffset) => {
  const cell = event.target?.closest?.('td');
  const row = cell?.closest?.('tr');
  if (!cell || !row || !row.parentElement || row.parentElement.tagName !== 'TBODY') return null;
  return {
    rowIndex: row.sectionRowIndex,
    columnIndex: Math.max(0, cell.cellIndex - columnOffset),
  };
};

export default function useDocumentTableClipboard({
  columns = [],
  rows = [],
  columnOffset = 1,
  canPaste = true,
  onPaste,
  onFeedback,
}) {
  const [menu, setMenu] = React.useState({ open: false, left: 0, top: 0, rowIndex: 0, columnIndex: 0 });
  const activeTableRef = React.useRef(null);

  const closeMenu = React.useCallback(() => setMenu((current) => ({ ...current, open: false })), []);

  React.useEffect(() => {
    if (!menu.open) return undefined;
    const close = () => closeMenu();
    const closeOnEscape = (event) => { if (event.key === 'Escape') closeMenu(); };
    document.addEventListener('click', close);
    document.addEventListener('scroll', close, true);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('scroll', close, true);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', close);
    };
  }, [closeMenu, menu.open]);

  const applyParsedTable = React.useCallback((table, position, headerMode) => {
    const patches = buildDocumentTablePaste({
      table,
      columns,
      startColumnIndex: position.columnIndex,
      headerMode,
    });
    if (!patches.length) {
      onFeedback?.('No editable matching values were found in the clipboard.', 'error');
      return;
    }
    onPaste?.({ startRowIndex: position.rowIndex, patches });
    const cellCount = patches.reduce((total, rowPatch) => total + rowPatch.cells.length, 0);
    onFeedback?.(`${cellCount} table value${cellCount === 1 ? '' : 's'} pasted.`, 'success');
  }, [columns, onFeedback, onPaste]);

  const beginPaste = React.useCallback((text, position) => {
    if (!canPaste) {
      onFeedback?.('This document is read-only. Table values cannot be pasted.', 'error');
      return;
    }
    const table = parseClipboardTable(text);
    if (!table.length || table.every((row) => row.every((value) => value === ''))) {
      onFeedback?.('The clipboard does not contain table data.', 'error');
      return;
    }
    applyParsedTable(table, position, clipboardHasMatchingHeaders(table, columns));
  }, [applyParsedTable, canPaste, columns, onFeedback]);

  const handleContextMenu = React.useCallback((event) => {
    const position = cellPosition(event, columnOffset);
    if (!position) return;
    event.preventDefault();
    event.stopPropagation();
    activeTableRef.current = event.currentTarget;
    const coordinates = clampMenuPosition(event.clientX, event.clientY);
    setMenu({ open: true, ...coordinates, ...position });
  }, [columnOffset]);

  const handlePasteCapture = React.useCallback((event) => {
    const position = cellPosition(event, columnOffset);
    if (!position) return;
    event.preventDefault();
    event.stopPropagation();
    beginPaste(event.clipboardData?.getData('text/plain') || '', position);
  }, [beginPaste, columnOffset]);

  const copyTable = React.useCallback(async () => {
    closeMenu();
    try {
      const tableRows = Array.from(activeTableRef.current?.tBodies?.[0]?.rows || []);
      const copyColumns = tableRows.length
        ? columns.map((column, columnIndex) => ({
            ...column,
            getValue: (_row, rowIndex) => {
              const cell = tableRows[rowIndex]?.cells?.[columnOffset + columnIndex];
              const control = cell?.querySelector?.('input, select, textarea');
              if (!control) return cell?.textContent?.trim?.() || '';
              if (control.type === 'checkbox') return control.checked ? 'Y' : 'N';
              return control.value ?? '';
            },
          }))
        : columns;
      await writeClipboardText(serializeDocumentTable({ columns: copyColumns, rows }));
      onFeedback?.('Table copied to the clipboard.', 'success');
    } catch (error) {
      onFeedback?.(error?.message || 'Unable to copy the table.', 'error');
    }
  }, [closeMenu, columnOffset, columns, onFeedback, rows]);

  const pasteFromMenu = React.useCallback(async () => {
    const position = { rowIndex: menu.rowIndex, columnIndex: menu.columnIndex };
    closeMenu();
    if (!canPaste) {
      onFeedback?.('This document is read-only. Table values cannot be pasted.', 'error');
      return;
    }
    try {
      if (!navigator.clipboard?.readText) throw new Error('Clipboard reading is unavailable. Select the destination cell and press Ctrl+V.');
      beginPaste(await navigator.clipboard.readText(), position);
    } catch (error) {
      onFeedback?.(error?.message || 'Clipboard access was denied. Select the destination cell and press Ctrl+V.', 'error');
    }
  }, [beginPaste, canPaste, closeMenu, menu.columnIndex, menu.rowIndex, onFeedback]);

  const menuNode = menu.open ? createPortal(
    <div
      role="menu"
      aria-label="Document table actions"
      style={{
        position: 'fixed', left: menu.left, top: menu.top, zIndex: 12000,
        width: 160, padding: 4, border: '1px solid #8896a5', borderRadius: 2,
        background: '#fff', boxShadow: '0 4px 14px rgba(0,0,0,.2)',
        color: 'var(--sap-text, #223548)',
        fontFamily: 'var(--sap-font-family, "Bahnschrift", "Segoe UI", sans-serif)',
        fontSize: 12,
      }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button type="button" role="menuitem" onClick={copyTable} style={{ display: 'block', width: '100%', padding: '5px 8px', border: 0, background: 'transparent', color: 'inherit', font: 'inherit', textAlign: 'left' }}>
        Copy Table
      </button>
      <button type="button" role="menuitem" onClick={pasteFromMenu} disabled={!canPaste} style={{ display: 'block', width: '100%', padding: '5px 8px', border: 0, background: 'transparent', color: 'inherit', font: 'inherit', textAlign: 'left' }}>
        Paste
      </button>
    </div>,
    document.body,
  ) : null;

  return {
    tableClipboardProps: {
      onContextMenu: handleContextMenu,
      onPasteCapture: handlePasteCapture,
    },
    tableClipboardUi: menuNode,
  };
}
