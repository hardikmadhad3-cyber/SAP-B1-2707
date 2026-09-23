import React, { useCallback, useEffect, useState } from 'react';
import {
  createGatePassMasterRow,
  deleteGatePassMasterRow,
  fetchGatePassMasterList,
  updateGatePassMasterRow,
} from '../../api/gatePassApi';
import '../../styles/gate-pass.css';

/**
 * Generic Code/Name master maintenance screen — reused for both Visitor Type
 * and Visit Type, the two simple setup masters feeding the Gate Pass
 * transaction screens (mirrors frmMstVstor / frmMstVst in the design reference).
 */
export default function GatePassMasterList({ masterKey, title }) {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingCode, setEditingCode] = useState(null);
  const [name, setName] = useState('');

  const load = useCallback(async (searchQuery = query) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await fetchGatePassMasterList(masterKey, { query: searchQuery });
      setRows(data.rows || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to load list.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterKey]);

  useEffect(() => { load(''); }, [load]);

  const openNew = () => { setEditingCode('new'); setName(''); setError(''); };
  const openEdit = (row) => { setEditingCode(row.code); setName(row.name); setError(''); };
  const closeForm = () => { setEditingCode(null); setName(''); };

  const handleSave = async () => {
    if (!String(name).trim()) { setError('Name is required.'); return; }
    setLoading(true);
    setError('');
    try {
      if (editingCode === 'new') {
        await createGatePassMasterRow(masterKey, { name });
      } else {
        await updateGatePassMasterRow(masterKey, editingCode, { name });
      }
      closeForm();
      load(query);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to save.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (row) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete "${row.name}"?`)) return;
    setLoading(true);
    setError('');
    try {
      await deleteGatePassMasterRow(masterKey, row.code);
      load(query);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to delete.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sap-document-page gp-page">
      <div className="sap-document-toolbar">
        <span className="sap-document-toolbar__title">{title}</span>
        <input
          type="search"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
        />
        <button type="button" className="gp-btn" onClick={() => load()}>Search</button>
        <button type="button" className="gp-btn gp-btn--primary" onClick={openNew}>New</button>
      </div>
      {error ? <div className="gp-error">{error}</div> : null}

      {editingCode ? (
        <fieldset className="gp-main gp-master-form">
          <legend>{editingCode === 'new' ? 'New' : `Edit — ${editingCode}`}</legend>
          <div className="gp-main__grid">
            <label>
              Code
              <input type="text" value={editingCode === 'new' ? 'Auto' : editingCode} disabled />
            </label>
            <label>
              Name
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </label>
          </div>
          <div className="gp-master-form__actions">
            <button type="button" className="gp-btn gp-btn--primary" onClick={handleSave} disabled={loading}>OK</button>
            <button type="button" className="gp-btn" onClick={closeForm}>Cancel</button>
          </div>
        </fieldset>
      ) : null}

      <table className="gp-table">
        <thead><tr><th>Code</th><th>Name</th><th /></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.code}>
              <td onClick={() => openEdit(row)}>{row.code}</td>
              <td onClick={() => openEdit(row)}>{row.name}</td>
              <td><button type="button" className="gp-btn" onClick={() => handleDelete(row)}>Delete</button></td>
            </tr>
          ))}
          {!loading && !rows.length ? (
            <tr><td colSpan={3} className="gp-empty">No rows found.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
