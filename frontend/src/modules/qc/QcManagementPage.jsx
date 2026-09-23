import React, { useEffect, useMemo, useState } from 'react';
import './styles/qc-management.css';
import {
  listQcAddons,
  createQcAddon,
  updateQcAddon,
  deleteQcAddon,
  listQcMappings,
  createQcMapping,
  updateQcMapping,
  deleteQcMapping,
  listQcParameters,
  createQcParameter,
  updateQcParameter,
  deleteQcParameter,
  listQcWorkflows,
  createQcWorkflow,
  updateQcWorkflow,
  deleteQcWorkflow,
  listQcTransactions,
  createQcTransaction,
  updateQcTransaction,
  deleteQcTransaction,
  listQcItemParameterMappings,
  createQcItemParameterMapping,
  updateQcItemParameterMapping,
  deleteQcItemParameterMapping,
  listQcInstruments,
  createQcInstrument,
  updateQcInstrument,
  deleteQcInstrument,
} from '../../api/qcApi';

const SECTION_CONFIG = {
  addons: {
    title: 'QC Add-on Management',
    columns: [
      { key: 'addon_code', label: 'Code', required: true },
      { key: 'addon_name', label: 'Name', required: true },
      { key: 'version', label: 'Version', required: true },
      { key: 'status', label: 'Status', required: false, type: 'select', options: ['active', 'inactive'] },
      { key: 'description', label: 'Description', required: false },
    ],
    list: listQcAddons,
    create: createQcAddon,
    update: updateQcAddon,
    remove: deleteQcAddon,
  },
  mappings: {
    title: 'QC Document Mapping',
    columns: [
      { key: 'document_type', label: 'Document Type', required: true },
      { key: 'document_code', label: 'Document Code', required: true },
      { key: 'qc_workflow', label: 'Workflow', required: true },
      { key: 'inspection_level', label: 'Inspection Level', required: true },
      { key: 'mandatory_inspection', label: 'Mandatory', type: 'checkbox' },
      { key: 'block_outward_if_failed', label: 'Block Outward', type: 'checkbox' },
      { key: 'is_active', label: 'Active', type: 'checkbox' },
    ],
    list: listQcMappings,
    create: createQcMapping,
    update: updateQcMapping,
    remove: deleteQcMapping,
  },
  parameters: {
    title: 'QC Parameters',
    columns: [
      { key: 'parameter_code', label: 'Code', required: true },
      { key: 'parameter_name', label: 'Name', required: true },
      { key: 'parameter_type', label: 'Type', required: true, type: 'select', options: ['numeric', 'text', 'boolean', 'list'] },
      { key: 'uom', label: 'UoM' },
      { key: 'test_method', label: 'Test Method' },
      { key: 'is_ctq', label: 'CTQ', type: 'checkbox' },
    ],
    list: listQcParameters,
    create: createQcParameter,
    update: updateQcParameter,
    remove: deleteQcParameter,
  },
  workflows: {
    title: 'QC Workflows',
    columns: [
      { key: 'workflow_name', label: 'Workflow Name', required: true },
      { key: 'workflow_type', label: 'Type', required: true, type: 'select', options: ['Inbound', 'Outbound', 'Custom'] },
      { key: 'trigger_event', label: 'Trigger Event', required: true },
      { key: 'assigned_inspector', label: 'Inspector', required: true },
      { key: 'approval_required', label: 'Approval', type: 'select', options: ['No Approval', 'Single Level', 'Multi-Level'] },
      { key: 'is_active', label: 'Active', type: 'checkbox' },
    ],
    list: listQcWorkflows,
    create: createQcWorkflow,
    update: updateQcWorkflow,
    remove: deleteQcWorkflow,
  },
  transactions: {
    title: 'QC Transactions',
    columns: [
      { key: 'transaction_no', label: 'Transaction No', required: true },
      { key: 'direction', label: 'Direction', required: true, type: 'select', options: ['Inward', 'Outward'] },
      { key: 'source_type', label: 'Source Type', required: true, type: 'select', options: ['GRPO', 'TRANSFER', 'CREDIT', 'PRODRCPT', 'GOODSRCPT', 'DELIVERY', 'GOODSISS', 'PRODISS'] },
      { key: 'source_doc_no', label: 'Source Doc No' },
      { key: 'party_name', label: 'Party / Origin' },
      { key: 'item_code', label: 'Item Code', required: true },
      { key: 'lot_no', label: 'Lot / Batch / Serial' },
      { key: 'quantity', label: 'Qty', required: true },
      { key: 'uom', label: 'UoM' },
      { key: 'inspection_status', label: 'Inspection Status', type: 'select', options: ['Open', 'In Progress', 'Closed', 'Released'] },
      { key: 'final_decision', label: 'Decision', type: 'select', options: ['Pending', 'Accepted', 'Rejected', 'Rework'] },
      { key: 'inspector_name', label: 'Inspector' },
      { key: 'inspection_date', label: 'Inspection Date' },
      { key: 'remarks', label: 'Remarks' },
    ],
    list: listQcTransactions,
    create: createQcTransaction,
    update: updateQcTransaction,
    remove: deleteQcTransaction,
  },
  itemParameterMappings: {
    title: 'Item-wise Parameter Mapping',
    columns: [
      { key: 'item_code', label: 'Item Code', required: true },
      { key: 'item_name', label: 'Item Name' },
      { key: 'parameter_code', label: 'Parameter Code', required: true },
      { key: 'parameter_name', label: 'Parameter Name' },
      { key: 'instrument_code', label: 'Instrument Code' },
      { key: 'instrument_name', label: 'Instrument Name' },
      { key: 'uom', label: 'UOM' },
      { key: 'parameter_type', label: 'Type' },
      { key: 'rule_name', label: 'Rule' },
      { key: 'from_value', label: 'From' },
      { key: 'to_value', label: 'To' },
      { key: 'expected_value', label: 'Expected Value' },
      { key: 'is_optional', label: 'Optional', type: 'checkbox' },
      { key: 'remarks', label: 'Remarks' },
      { key: 'is_active', label: 'Active', type: 'checkbox' },
      { key: 'user_name', label: 'User' },
    ],
    list: listQcItemParameterMappings,
    create: createQcItemParameterMapping,
    update: updateQcItemParameterMapping,
    remove: deleteQcItemParameterMapping,
  },
  instruments: {
    title: 'Instrument Master',
    columns: [
      { key: 'instrument_code', label: 'Instrument Code', required: true },
      { key: 'instrument_name', label: 'Instrument Name', required: true },
      { key: 'remarks', label: 'Remarks' },
      { key: 'is_active', label: 'Active', type: 'checkbox' },
    ],
    list: listQcInstruments,
    create: createQcInstrument,
    update: updateQcInstrument,
    remove: deleteQcInstrument,
  },
};

const defaultValue = (column) => {
  if (column.type === 'checkbox') return false;
  if (column.type === 'select' && column.options?.length) return column.options[0];
  return '';
};

const buildInitialForm = (columns) =>
  columns.reduce((acc, column) => {
    acc[column.key] = defaultValue(column);
    return acc;
  }, {});

const toCheckboxValue = (value) => value === true || value === 1 || value === '1';

export default function QcManagementPage({ section }) {
  const config = SECTION_CONFIG[section] || SECTION_CONFIG.addons;
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(() => buildInitialForm(config.columns));
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  const requiredColumns = useMemo(
    () => config.columns.filter((column) => column.required),
    [config.columns],
  );

  const showAlert = (type, msg) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 3500);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(buildInitialForm(config.columns));
  };

  const loadRows = async () => {
    setLoading(true);
    try {
      const data = await config.list();
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      showAlert('error', error?.response?.data?.message || 'Failed to load records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    resetForm();
    loadRows();
  }, [section]);

  const onChange = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const validateForm = () => {
    for (const column of requiredColumns) {
      const value = form[column.key];
      if (value === undefined || value === null || String(value).trim() === '') {
        showAlert('error', `${column.label} is required.`);
        return false;
      }
    }
    return true;
  };

  const onSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      if (editingId) {
        await config.update(editingId, form);
        showAlert('success', 'Record updated.');
      } else {
        await config.create(form);
        showAlert('success', 'Record created.');
      }
      resetForm();
      await loadRows();
    } catch (error) {
      showAlert('error', error?.response?.data?.message || 'Failed to save record.');
    } finally {
      setLoading(false);
    }
  };

  const onEdit = (row) => {
    const next = buildInitialForm(config.columns);
    for (const column of config.columns) {
      const value = row[column.key];
      next[column.key] = column.type === 'checkbox' ? toCheckboxValue(value) : (value ?? defaultValue(column));
    }
    setForm(next);
    setEditingId(row.id);
  };

  const onDelete = async (id) => {
    if (!window.confirm('Delete this record?')) return;

    setLoading(true);
    try {
      await config.remove(id);
      showAlert('success', 'Record deleted.');
      await loadRows();
      if (editingId === id) resetForm();
    } catch (error) {
      showAlert('error', error?.response?.data?.message || 'Failed to delete record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="qc-page sap-document-page">
      <div className="qc-toolbar">
        <span className="qc-toolbar__title">{config.title}</span>
        <button type="button" className="qc-btn qc-btn--primary" onClick={onSubmit} disabled={loading}>
          {editingId ? 'Update' : 'Add'}
        </button>
        <button type="button" className="qc-btn" onClick={resetForm} disabled={loading}>
          Clear
        </button>
      </div>

      {alert ? <div className={`qc-alert qc-alert--${alert.type}`}>{alert.msg}</div> : null}

      <div className="qc-grid" style={{ marginBottom: '12px' }}>
        <table>
          <thead>
            <tr>
              {config.columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {config.columns.map((column) => (
                <td key={column.key}>
                  {column.type === 'checkbox' ? (
                    <input
                      className="qc-checkbox"
                      type="checkbox"
                      checked={toCheckboxValue(form[column.key])}
                      onChange={(event) => onChange(column.key, event.target.checked)}
                    />
                  ) : column.type === 'select' ? (
                    <select
                      className="qc-select"
                      value={form[column.key] ?? ''}
                      onChange={(event) => onChange(column.key, event.target.value)}
                    >
                      {(column.options || []).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="qc-input"
                      value={form[column.key] ?? ''}
                      onChange={(event) => onChange(column.key, event.target.value)}
                    />
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="qc-grid">
        <table>
          <thead>
            <tr>
              <th style={{ width: '64px' }}>Id</th>
              {config.columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
              <th style={{ width: '140px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length ? (
              <tr>
                <td colSpan={config.columns.length + 2} className="qc-empty">No records found.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  {config.columns.map((column) => (
                    <td key={`${row.id}-${column.key}`}>
                      {column.type === 'checkbox'
                        ? (toCheckboxValue(row[column.key]) ? 'Yes' : 'No')
                        : String(row[column.key] ?? '')}
                    </td>
                  ))}
                  <td>
                    <div className="qc-actions">
                      <button type="button" className="qc-btn" onClick={() => onEdit(row)} disabled={loading}>Edit</button>
                      <button type="button" className="qc-btn qc-btn--danger" onClick={() => onDelete(row.id)} disabled={loading}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
