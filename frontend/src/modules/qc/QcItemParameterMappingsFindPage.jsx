import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listQcItemParameterMappings } from '../../api/qcApi';
import './styles/qc-management.css';

export default function QcItemParameterMappingsFindPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  const showAlert = (type, msg) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 3000);
  };

  const loadRows = async () => {
    setLoading(true);
    try {
      const data = await listQcItemParameterMappings();
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      showAlert('error', error?.response?.data?.message || 'Failed to load item mappings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  const itemRows = useMemo(() => {
    const grouped = new Map();
    for (const row of rows) {
      const itemCode = String(row.item_code || '').trim();
      if (!itemCode) continue;

      if (!grouped.has(itemCode)) {
        grouped.set(itemCode, {
          item_code: itemCode,
          item_name: row.item_name || '',
          parameter_count: 0,
          user_name: row.user_name || '',
          updated_at: row.updated_at || '',
        });
      }

      const current = grouped.get(itemCode);
      current.parameter_count += 1;
      if (String(row.updated_at || '') > String(current.updated_at || '')) {
        current.updated_at = row.updated_at || '';
        current.item_name = row.item_name || current.item_name;
        current.user_name = row.user_name || current.user_name;
      }
    }

    const q = String(search || '').trim().toLowerCase();
    return [...grouped.values()]
      .filter((row) => !q || row.item_code.toLowerCase().includes(q) || String(row.item_name || '').toLowerCase().includes(q))
      .sort((a, b) => a.item_code.localeCompare(b.item_code));
  }, [rows, search]);

  return (
    <div className="qc-page sap-document-page qc-workspace">
      <div className="qc-toolbar">
        <div className="qc-workspace__toolbar-head">
          <span className="qc-toolbar__title">Find Item-wise Parameter Mapping</span>
          <span className="qc-workspace__toolbar-subtitle">Select an item to load existing mapped parameters</span>
        </div>
        <button type="button" className="qc-btn qc-btn--primary" onClick={() => navigate('/qc/item-parameter-mappings')}>New</button>
      </div>

      {alert ? <div className={`qc-alert qc-alert--${alert.type}`}>{alert.msg}</div> : null}

      <div className="qc-grid qc-workspace__block">
        <div className="qc-workspace__section-head">Existing Item Mappings</div>
        <div style={{ padding: 10, borderBottom: '1px solid var(--sap-border-soft)' }}>
          <input
            className="qc-input"
            placeholder="Search Item Code / Item Name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <table>
          <thead>
            <tr>
              <th>Item Code</th>
              <th>Item Name</th>
              <th>User</th>
              <th>Parameter Count</th>
              <th>Last Update</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {itemRows.length ? itemRows.map((row) => (
              <tr key={row.item_code}>
                <td>{row.item_code}</td>
                <td>{row.item_name || ''}</td>
                <td>{row.user_name || ''}</td>
                <td>{row.parameter_count}</td>
                <td>{row.updated_at || ''}</td>
                <td>
                  <button
                    type="button"
                    className="qc-btn"
                    disabled={loading}
                    onClick={() => navigate(`/qc/item-parameter-mappings?itemCode=${encodeURIComponent(row.item_code)}`)}
                  >
                    Open
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="qc-empty">No mapped items found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
