import React, { useEffect, useMemo, useState } from 'react';
import {
  listOutwardItemBatches,
  listOutwardItemParameters,
  listOutwardPendingCustomers,
  listOutwardPendingDocuments,
  listOutwardPendingItems,
  saveOutwardQcInspection,
} from '../../api/qcApi';
import './styles/qc-management.css';

const DECISION_OPTIONS = ['Accepted', 'Rejected', 'Pending'];

const mapParameterToObservation = (row = {}) => ({
  parameter_code: row.parameter_code || '',
  parameter_name: row.parameter_name || '',
  instrument_code: row.instrument_code || '',
  instrument_name: row.instrument_name || '',
  uom: row.uom || '',
  min_value: row.from_value || '',
  standard_value: row.expected_value || '',
  max_value: row.to_value || '',
  observed_value_1: '',
  observed_value_2: '',
  observed_value_3: '',
  visual: '',
});

export default function QcOutwardWorkspacePage() {
  const [customers, setCustomers] = useState([]);
  const [customerMeta, setCustomerMeta] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [pendingItems, setPendingItems] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedDocEntry, setSelectedDocEntry] = useState('');
  const [selectedItemKey, setSelectedItemKey] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [parameters, setParameters] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [inspectorName, setInspectorName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [finalDecision, setFinalDecision] = useState('Accepted');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  const showAlert = (type, msg) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 3500);
  };

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await listOutwardPendingCustomers();
      const nextCustomers = Array.isArray(data?.customers) ? data.customers : [];
      const meta = data?.meta && typeof data.meta === 'object' ? data.meta : null;

      setCustomers(nextCustomers);
      setCustomerMeta(meta);

      if (!nextCustomers.length && meta?.error) {
        showAlert('error', `Customer load debug: ${meta.error}`);
      }
    } catch (error) {
      showAlert('error', error?.response?.data?.message || 'Failed to load pending customers.');
      setCustomers([]);
      setCustomerMeta(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    const loadDocuments = async () => {
      if (!selectedCustomer) {
        setDocuments([]);
        setSelectedDocEntry('');
        setPendingItems([]);
        return;
      }

      setLoading(true);
      try {
        const data = await listOutwardPendingDocuments(selectedCustomer);
        const docs = Array.isArray(data?.documents) ? data.documents : [];
        setDocuments(docs);
        if (!docs.some((doc) => String(doc.doc_entry) === String(selectedDocEntry))) {
          setSelectedDocEntry('');
          setPendingItems([]);
        }
      } catch (error) {
        showAlert('error', error?.response?.data?.message || 'Failed to load pending delivery documents.');
        setDocuments([]);
      } finally {
        setLoading(false);
      }
    };

    loadDocuments();
  }, [selectedCustomer]);

  useEffect(() => {
    const loadItems = async () => {
      if (!selectedDocEntry) {
        setPendingItems([]);
        return;
      }

      setLoading(true);
      try {
        const data = await listOutwardPendingItems(selectedDocEntry);
        const rows = Array.isArray(data?.items) ? data.items : [];
        setPendingItems(rows);
      } catch (error) {
        showAlert('error', error?.response?.data?.message || 'Failed to load pending items for delivery.');
        setPendingItems([]);
      } finally {
        setLoading(false);
      }
    };

    loadItems();
  }, [selectedDocEntry]);

  useEffect(() => {
    const match = pendingItems.find((row) => {
      const key = `${row.doc_entry}|${row.line_num}|${row.item_code}`;
      return key === selectedItemKey;
    });

    if (!match) {
      setSelectedItem(null);
      setParameters([]);
      setBatches([]);
      setSelectedBatch('');
      return;
    }

    setSelectedItem(match);
  }, [pendingItems, selectedItemKey]);

  const loadDetailForItem = async (row) => {
    setLoading(true);
    try {
      const [parametersData, batchData] = await Promise.all([
        listOutwardItemParameters(row.item_code),
        row.batch_managed ? listOutwardItemBatches(row.item_code, row.whs_code) : Promise.resolve({ batches: [] }),
      ]);

      const nextParameters = (Array.isArray(parametersData?.parameters) ? parametersData.parameters : [])
        .map(mapParameterToObservation);
      setParameters(nextParameters);

      const nextBatches = Array.isArray(batchData?.batches) ? batchData.batches : [];
      setBatches(nextBatches);
      setSelectedBatch(nextBatches[0]?.BatchNumber || '');

      setRemarks('');
      setFinalDecision('Accepted');
    } catch (error) {
      showAlert('error', error?.response?.data?.message || 'Failed to load QC item detail.');
      setParameters([]);
      setBatches([]);
      setSelectedBatch('');
    } finally {
      setLoading(false);
    }
  };

  const selectedCustomerName = useMemo(
    () => customers.find((row) => row.customer_code === selectedCustomer)?.customer_name || '',
    [customers, selectedCustomer],
  );

  const selectedDoc = useMemo(
    () => documents.find((row) => String(row.doc_entry) === String(selectedDocEntry)) || null,
    [documents, selectedDocEntry],
  );

  const onSelectPendingItem = async (row) => {
    const key = `${row.doc_entry}|${row.line_num}|${row.item_code}`;
    setSelectedItemKey(key);
    await loadDetailForItem(row);
  };

  const updateObservation = (index, field, value) => {
    setParameters((current) => current.map((row, rowIndex) => (
      rowIndex === index ? { ...row, [field]: value } : row
    )));
  };

  const refreshCurrentData = async () => {
    if (!selectedCustomer) {
      await loadCustomers();
      return;
    }

    const docsData = await listOutwardPendingDocuments(selectedCustomer);
    const docs = Array.isArray(docsData?.documents) ? docsData.documents : [];
    setDocuments(docs);

    if (!docs.some((doc) => String(doc.doc_entry) === String(selectedDocEntry))) {
      setSelectedDocEntry('');
      setPendingItems([]);
      setSelectedItemKey('');
      return;
    }

    const itemsData = await listOutwardPendingItems(selectedDocEntry);
    const items = Array.isArray(itemsData?.items) ? itemsData.items : [];
    setPendingItems(items);

    if (!items.some((row) => `${row.doc_entry}|${row.line_num}|${row.item_code}` === selectedItemKey)) {
      setSelectedItemKey('');
      setSelectedItem(null);
      setParameters([]);
      setBatches([]);
      setSelectedBatch('');
    }

    await loadCustomers();
  };

  const saveQc = async () => {
    if (!selectedItem) {
      showAlert('error', 'Select a pending delivery item first.');
      return;
    }
    if (!parameters.length) {
      showAlert('error', 'No parameter rows loaded for selected item.');
      return;
    }
    if (selectedItem.batch_managed && !selectedBatch) {
      showAlert('error', 'Select batch number for this batch-managed item.');
      return;
    }

    setSaving(true);
    try {
      await saveOutwardQcInspection({
        customer_code: selectedItem.customer_code,
        customer_name: selectedItem.customer_name,
        doc_entry: selectedItem.doc_entry,
        doc_num: selectedItem.doc_num,
        line_num: selectedItem.line_num,
        item_code: selectedItem.item_code,
        item_name: selectedItem.item_name,
        quantity: selectedItem.open_qty,
        uom: parameters[0]?.uom || '',
        batch_no: selectedItem.batch_managed ? selectedBatch : '',
        inspector_name: inspectorName,
        final_decision: finalDecision,
        remarks,
        parameters,
      });

      showAlert('success', 'Outward QC saved successfully.');
      await refreshCurrentData();
    } catch (error) {
      showAlert('error', error?.response?.data?.message || 'Failed to save outward QC.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="qc-page sap-document-page qc-workspace qc-outward-page">
      <div className="qc-toolbar">
        <div className="qc-workspace__toolbar-head">
          <span className="qc-toolbar__title">Outward QC</span>
          <span className="qc-workspace__toolbar-subtitle">Pending Delivery -> Item Inspection -> Save QC</span>
        </div>
        <button type="button" className="qc-btn" onClick={loadCustomers} disabled={loading}>Refresh</button>
      </div>

      {alert ? <div className={`qc-alert qc-alert--${alert.type}`}>{alert.msg}</div> : null}

      <div className="qc-grid qc-workspace__block qc-inward-page__pending-card">
        <div className="qc-workspace__section-head">Pending Inspection</div>
        <div className="qc-workspace__transaction-form qc-inward-page__filters">
          <label>
            <span>Customer (Pending Delivery only)</span>
            <select
              className="qc-select"
              value={selectedCustomer}
              onChange={(e) => {
                setSelectedCustomer(e.target.value);
                setSelectedItemKey('');
              }}
            >
              <option value="">Select Customer</option>
              {customers.map((customer) => (
                <option key={customer.customer_code} value={customer.customer_code}>
                  {customer.customer_code} - {customer.customer_name}
                </option>
              ))}
            </select>
            {!customers.length && customerMeta ? (
              <small className="qc-workspace__meta-note">
                Debug: DB {String(customerMeta.resolved_database || 'default')} | Open Delivery Docs {String(customerMeta.open_delivery_documents || 0)}
              </small>
            ) : null}
          </label>

          <label>
            <span>Pending Delivery Document</span>
            <select
              className="qc-select"
              value={selectedDocEntry}
              onChange={(e) => {
                setSelectedDocEntry(e.target.value);
                setSelectedItemKey('');
              }}
              disabled={!selectedCustomer}
            >
              <option value="">Select Delivery</option>
              {documents.map((doc) => (
                <option key={doc.doc_entry} value={doc.doc_entry}>
                  {doc.doc_num} - {doc.doc_date ? String(doc.doc_date).slice(0, 10) : ''}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Customer Name</span>
            <input className="qc-input" value={selectedCustomerName} readOnly />
          </label>

          <label>
            <span>Pending Lines</span>
            <input className="qc-input" value={selectedDoc ? String(selectedDoc.pending_lines || 0) : '0'} readOnly />
          </label>
        </div>

        <div className="qc-grid qc-inward-page__pending-table">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Request Number</th>
                <th>Base Document Number</th>
                <th>Line No.</th>
                <th>Item Code</th>
                <th>Description</th>
                <th>UOM Qty</th>
                <th>WhsCode</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingItems.length ? pendingItems.map((row, index) => {
                const rowKey = `${row.doc_entry}|${row.line_num}|${row.item_code}`;
                const selected = rowKey === selectedItemKey;
                return (
                  <tr key={rowKey} className={selected ? 'is-active' : ''}>
                    <td>{index + 1}</td>
                    <td>DLV-{row.doc_num}</td>
                    <td>{row.doc_num}</td>
                    <td>{row.line_num}</td>
                    <td>{row.item_code}</td>
                    <td>{row.item_name}</td>
                    <td>{row.open_qty}</td>
                    <td>{row.whs_code}</td>
                    <td>Pending</td>
                    <td>
                      <button type="button" className="qc-btn" disabled={loading} onClick={() => onSelectPendingItem(row)}>
                        Process
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={10} className="qc-empty">No pending delivery QC items found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="qc-grid qc-workspace__block qc-inward-page__detail-card">
        <div className="qc-workspace__section-head">Quality Checking</div>
        <div className="qc-workspace__transaction-form qc-inward-page__detail-form">
          <label>
            <span>Document No.</span>
            <input className="qc-input" value={selectedItem ? String(selectedItem.doc_num) : ''} readOnly />
          </label>
          <label>
            <span>Document Date</span>
            <input className="qc-input" value={selectedItem?.doc_date ? String(selectedItem.doc_date).slice(0, 10) : ''} readOnly />
          </label>
          <label>
            <span>Item Code</span>
            <input className="qc-input" value={selectedItem?.item_code || ''} readOnly />
          </label>
          <label>
            <span>Description</span>
            <input className="qc-input" value={selectedItem?.item_name || ''} readOnly />
          </label>
          <label>
            <span>Quantity</span>
            <input className="qc-input" value={selectedItem?.open_qty != null ? String(selectedItem.open_qty) : ''} readOnly />
          </label>
          <label>
            <span>Inspector Name</span>
            <input className="qc-input" value={inspectorName} onChange={(e) => setInspectorName(e.target.value)} />
          </label>
          <label>
            <span>Decision</span>
            <select className="qc-select" value={finalDecision} onChange={(e) => setFinalDecision(e.target.value)}>
              {DECISION_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          {selectedItem?.batch_managed ? (
            <label>
              <span>Batch Number</span>
              <select className="qc-select" value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
                <option value="">Select Batch</option>
                {batches.map((batch) => (
                  <option key={String(batch.BatchNumber || '')} value={String(batch.BatchNumber || '')}>
                    {String(batch.BatchNumber || '')} ({String(batch.AvailableQty || 0)})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="qc-inward-page__remarks">
            <span>Remarks</span>
            <textarea className="qc-input qc-workspace__textarea" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </label>
        </div>

        <div className="qc-grid qc-inward-page__detail-table">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Parameter Code</th>
                <th>Parameter Name</th>
                <th>Equipment Code</th>
                <th>Equipment Name</th>
                <th>UOM</th>
                <th>Min value</th>
                <th>Standard Value</th>
                <th>Maximum Value</th>
                <th>Visual</th>
                <th>Observed Value 1</th>
                <th>Observed Value 2</th>
                <th>Observed Value 3</th>
              </tr>
            </thead>
            <tbody>
              {parameters.length ? parameters.map((row, index) => (
                <tr key={`${row.parameter_code}-${index}`}>
                  <td>{index + 1}</td>
                  <td>{row.parameter_code}</td>
                  <td>{row.parameter_name}</td>
                  <td>{row.instrument_code}</td>
                  <td>{row.instrument_name}</td>
                  <td>{row.uom}</td>
                  <td>{row.min_value}</td>
                  <td>{row.standard_value}</td>
                  <td>{row.max_value}</td>
                  <td>
                    <input
                      className="qc-input"
                      value={row.visual}
                      onChange={(e) => updateObservation(index, 'visual', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="qc-input"
                      value={row.observed_value_1}
                      onChange={(e) => updateObservation(index, 'observed_value_1', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="qc-input"
                      value={row.observed_value_2}
                      onChange={(e) => updateObservation(index, 'observed_value_2', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="qc-input"
                      value={row.observed_value_3}
                      onChange={(e) => updateObservation(index, 'observed_value_3', e.target.value)}
                    />
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={13} className="qc-empty">Select pending item to load QC parameters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="qc-workspace__actions">
          <button
            type="button"
            className="qc-btn qc-btn--primary"
            disabled={saving || loading || !selectedItem || !parameters.length}
            onClick={saveQc}
          >
            Save QC
          </button>
        </div>
      </div>
    </div>
  );
}
