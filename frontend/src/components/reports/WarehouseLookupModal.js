import React, { useEffect, useMemo, useState } from 'react';
import { matchesSapSearchText } from '../../utils/sapSearch';
import useFloatingWindow from './useFloatingWindow';

function WarehouseLookupModal({ isOpen, onClose, onSelect, warehouses = [] }) {
  const [searchText, setSearchText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const windowFrame = useFloatingWindow({ isOpen, defaultTop: 48, bounds: 'parent' });

  useEffect(() => {
    if (!isOpen) {
      setSearchText('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const normalizedRows = useMemo(
    () =>
      warehouses.map((warehouse, index) => ({
        rowNo: index + 1,
        code: String(warehouse.code || '').trim(),
        name: String(warehouse.name || '').trim(),
        locationCode: String(warehouse.locationCode || '').trim(),
      })),
    [warehouses],
  );

  const filteredRows = useMemo(() => {
    const query = searchText.trim();
    if (!query) return normalizedRows;
    return normalizedRows.filter((row) => matchesSapSearchText(`${row.code} ${row.name}`, query));
  }, [normalizedRows, searchText]);

  const selectedRow = filteredRows[selectedIndex] || null;

  const handleChoose = () => {
    if (!selectedRow) return;
    onSelect(selectedRow);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="sales-employee-lookup-modal__backdrop" onClick={onClose}>
      <div
        className="sales-employee-lookup-modal"
        role="dialog"
        aria-modal="true"
        aria-label="List of Warehouses"
        onClick={(event) => event.stopPropagation()}
        {...windowFrame.windowProps}
      >
        <div className="sales-employee-lookup-modal__titlebar" {...windowFrame.titleBarProps}>
          <div className="sales-employee-lookup-modal__title">List of Warehouses</div>
          <div className="sales-employee-lookup-modal__controls">
            <button
              type="button"
              aria-label={windowFrame.isMinimized ? 'Restore' : 'Minimize'}
              onClick={windowFrame.toggleMinimize}
            >
              {windowFrame.isMinimized ? '□' : '-'}
            </button>
            <button
              type="button"
              aria-label={windowFrame.isMaximized ? 'Restore' : 'Maximize'}
              title={windowFrame.isMaximized ? 'Restore' : 'Maximize'}
              onClick={windowFrame.toggleMaximize}
            >
              []
            </button>
            <button type="button" aria-label="Close" onClick={onClose}>x</button>
          </div>
        </div>

        <div className="sales-employee-lookup-modal__accent" />

        {!windowFrame.isMinimized ? (
          <>
            <div className="sales-employee-lookup-modal__body">
              <div className="sales-employee-lookup-modal__toolbar">
                <label className="sales-employee-lookup-modal__find-label" htmlFor="warehouse-lookup-search">
                  Find
                </label>
                <input
                  id="warehouse-lookup-search"
                  type="text"
                  value={searchText}
                  onChange={(event) => {
                    setSearchText(event.target.value);
                    setSelectedIndex(0);
                  }}
                  autoFocus
                />
              </div>

              <div className="sales-employee-lookup-modal__grid-wrap">
                <table className="sales-employee-lookup-modal__grid">
                  <thead>
                    <tr>
                      <th className="is-index">#</th>
                      <th className="is-name">Whse Code</th>
                      <th className="is-remarks">Whse Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!filteredRows.length ? (
                      <tr>
                        <td colSpan={3} className="sales-employee-lookup-modal__state-cell">
                          No warehouses found.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row, index) => (
                        <tr
                          key={`${row.code || 'warehouse'}-${index}`}
                          className={selectedIndex === index ? 'is-selected' : ''}
                          onClick={() => setSelectedIndex(index)}
                          onDoubleClick={() => {
                            onSelect(row);
                            onClose();
                          }}
                        >
                          <td className="is-index">{row.rowNo}</td>
                          <td className="is-name">{row.code}</td>
                          <td className="is-remarks">{row.name}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="sales-employee-lookup-modal__footer">
              <button
                type="button"
                className="sales-employee-lookup-modal__action-btn"
                onClick={handleChoose}
                disabled={!selectedRow}
              >
                Choose
              </button>
              <button type="button" className="sales-employee-lookup-modal__action-btn" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default WarehouseLookupModal;
