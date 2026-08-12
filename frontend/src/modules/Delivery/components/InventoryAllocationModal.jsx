import React, { useEffect, useMemo, useState } from 'react';
import { fetchBatchesByItem, fetchBinsByItem, fetchSerialsByItem } from '../../../api/deliveryApi';
import { getRequiredBatchQty } from '../../../utils/batchQuantity';

const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

export default function InventoryAllocationModal({ isOpen, line, readOnly = false, onClose, onSave }) {
  const [available, setAvailable] = useState({ batches: [], serials: [], bins: [] });
  const [batches, setBatches] = useState([]);
  const [serialNumbers, setSerialNumbers] = useState([]);
  const [binAllocations, setBinAllocations] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !line?.itemNo || !line?.whse) return;
    let active = true;
    setBatches(Array.isArray(line.batches) ? line.batches : []);
    setSerialNumbers(Array.isArray(line.serialNumbers) ? line.serialNumbers : []);
    setBinAllocations(Array.isArray(line.binAllocations) ? line.binAllocations : []);
    setError('');
    setLoading(true);
    Promise.all([
      line.batchManaged ? fetchBatchesByItem(line.itemNo, line.whse) : Promise.resolve({ data: { batches: [] } }),
      line.serialManaged ? fetchSerialsByItem(line.itemNo, line.whse) : Promise.resolve({ data: { serials: [] } }),
      line.binManaged ? fetchBinsByItem(line.itemNo, line.whse) : Promise.resolve({ data: { bins: [] } }),
    ]).then(([batchResponse, serialResponse, binResponse]) => {
      if (!active) return;
      setAvailable({
        batches: batchResponse.data?.batches || [],
        serials: serialResponse.data?.serials || [],
        bins: binResponse.data?.bins || [],
      });
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.message || 'Failed to load inventory allocations.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOpen, line]);

  const required = getRequiredBatchQty(line || {});
  const batchTotal = useMemo(() => batches.reduce((sum, row) => sum + number(row.quantity), 0), [batches]);
  const binTotal = useMemo(() => binAllocations.reduce((sum, row) => sum + number(row.quantity), 0), [binAllocations]);
  if (!isOpen || !line) return null;

  const toggleSerial = (row) => {
    const serialNumber = String(row.SerialNumber || '').trim();
    const selected = serialNumbers.some((entry) => entry.serialNumber === serialNumber);
    setSerialNumbers(selected
      ? serialNumbers.filter((entry) => entry.serialNumber !== serialNumber)
      : [...serialNumbers, { serialNumber, systemSerialNumber: row.SystemSerialNumber }]);
  };
  const updateBatch = (row, quantity) => {
    const batchNumber = String(row.BatchNumber || '').trim();
    const others = batches.filter((entry) => entry.batchNumber !== batchNumber);
    setBatches(number(quantity) > 0 ? [...others, { batchNumber, quantity }] : others);
  };
  const updateBin = (index, field, value) => setBinAllocations((rows) => rows.map(
    (row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row,
  ));
  const save = () => {
    if (line.batchManaged && Math.abs(batchTotal - required) > 0.000001) return setError(`Batch total must equal ${required}.`);
    if (line.serialManaged && serialNumbers.length !== required) return setError(`Serial count must equal ${required}.`);
    if (line.binManaged && Math.abs(binTotal - required) > 0.000001) return setError(`Bin total must equal ${required}.`);
    onSave({ batches, serialNumbers, binAllocations });
  };

  const linkedRows = line.batchManaged ? batches : line.serialManaged ? serialNumbers : [];
  return (
    <div className="del-modal-overlay" onClick={onClose}>
      <div className="del-modal" style={{ width: 760, maxWidth: '95vw' }} onClick={(event) => event.stopPropagation()}>
        <div className="del-modal__header"><h6>Inventory Allocation — {line.itemNo}</h6><button type="button" onClick={onClose}>×</button></div>
        <div style={{ padding: 12 }}>Required: {required} {line.inventoryUOM || line.uomCode} | Warehouse: {line.whse}</div>
        {error && <div className="del-alert del-alert--error">{error}</div>}
        {loading ? <div style={{ padding: 16 }}>Loading…</div> : <div style={{ padding: 12, maxHeight: '60vh', overflow: 'auto' }}>
          {line.batchManaged && <section><h6>Batches ({batchTotal}/{required})</h6>{available.batches.map((row) => {
            const code = String(row.BatchNumber || '');
            const selected = batches.find((entry) => entry.batchNumber === code);
            return <div key={`${code}-${row.WhsCode}`} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', gap: 8, marginBottom: 5 }}><span>{code}</span><span>Available {row.AvailableQty}</span><input type="number" min="0" step="any" disabled={readOnly} value={selected?.quantity || ''} onChange={(event) => updateBatch(row, event.target.value)} /></div>;
          })}</section>}
          {line.serialManaged && <section><h6>Serials ({serialNumbers.length}/{required})</h6>{available.serials.map((row) => <label key={row.SystemSerialNumber} style={{ display: 'block', marginBottom: 5 }}><input type="checkbox" disabled={readOnly} checked={serialNumbers.some((entry) => entry.serialNumber === row.SerialNumber)} onChange={() => toggleSerial(row)} /> {row.SerialNumber}</label>)}</section>}
          {line.binManaged && <section><h6>Bins ({binTotal}/{required})</h6>{binAllocations.map((row, index) => <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr 36px', gap: 8, marginBottom: 5 }}><select disabled={readOnly} value={row.binAbsEntry || ''} onChange={(event) => updateBin(index, 'binAbsEntry', event.target.value)}><option value="">Select bin</option>{available.bins.map((bin) => <option key={bin.BinAbsEntry} value={bin.BinAbsEntry}>{bin.BinCode} ({bin.AvailableQty})</option>)}</select><input type="number" min="0" step="any" disabled={readOnly} value={row.quantity || ''} onChange={(event) => updateBin(index, 'quantity', event.target.value)} />{linkedRows.length ? <select disabled={readOnly} value={row.allocationIndex ?? ''} onChange={(event) => updateBin(index, 'allocationIndex', event.target.value)}><option value="">Link allocation</option>{linkedRows.map((entry, linkedIndex) => <option key={linkedIndex} value={linkedIndex}>{entry.batchNumber || entry.serialNumber}</option>)}</select> : <span />}{!readOnly && <button type="button" onClick={() => setBinAllocations((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>−</button>}</div>)}{!readOnly && <button type="button" className="del-btn" onClick={() => setBinAllocations((rows) => [...rows, { binAbsEntry: '', quantity: '', allocationIndex: '' }])}>Add Bin Row</button>}</section>}
        </div>}
        <div className="del-modal__footer"><button type="button" className="del-btn del-btn--primary" disabled={readOnly || loading} onClick={save}>Update</button><button type="button" className="del-btn" onClick={onClose}>Cancel</button></div>
      </div>
    </div>
  );
}
