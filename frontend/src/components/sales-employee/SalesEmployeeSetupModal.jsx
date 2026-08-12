import React from 'react';
import SapModalShell from '../common/SapModalShell';

export default function SalesEmployeeSetupModal({
  isOpen,
  rows = [],
  saving = false,
  onClose,
  onSave,
  onUpdateRow,
}) {
  if (!isOpen) return null;

  return (
    <SapModalShell
      open={isOpen}
      title="Sales Employees/Buyers - Setup"
      onClose={onClose}
      size="wide"
      className="sap-setup-window"
      overlayClassName="sap-setup-overlay"
      bodyClassName="sap-setup-body"
      loading={saving}
      footerClassName="sap-setup-footer"
      footer={(
        <>
          <div>
            <button type="button" className="sap-setup-primary" onClick={onSave} disabled={saving}>
              {saving ? 'Saving...' : 'OK'}
            </button>
            <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
          </div>
        </>
      )}
    >
          <div className="sap-setup-grid-wrap">
            <table className="sap-setup-grid">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Sales Employee Name</th>
                  <th>Commission Group</th>
                  <th>Commission %</th>
                  <th>Remarks</th>
                  <th>Active</th>
                  <th>Employee</th>
                  <th>T...</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.SlpCode || 'new'}-${index}`}>
                    <td>{index + 1}</td>
                    <td>
                      <input
                        value={row.SlpName}
                        onChange={(event) => onUpdateRow(index, 'SlpName', event.target.value)}
                        disabled={row.SlpCode === -1}
                      />
                    </td>
                    <td>
                      <select value="user-defined" disabled={row.SlpCode === -1}>
                        <option value="user-defined">User-Defined Commission</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="sap-setup-num"
                        value={row.Commission}
                        onChange={(event) => onUpdateRow(index, 'Commission', event.target.value)}
                        disabled={row.SlpCode === -1}
                      />
                    </td>
                    <td>
                      <input
                        value={row.Memo}
                        onChange={(event) => onUpdateRow(index, 'Memo', event.target.value)}
                        disabled={row.SlpCode === -1}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.Active}
                        onChange={(event) => onUpdateRow(index, 'Active', event.target.checked)}
                        disabled={row.SlpCode === -1}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.Employee}
                        onChange={(event) => onUpdateRow(index, 'Employee', event.target.checked)}
                        disabled={row.SlpCode === -1}
                      />
                    </td>
                    <td></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
    </SapModalShell>
  );
}
