import React from 'react';

export default function LogisticsTab({
  header,
  onHeaderChange,
  effectiveWhseAddrs,
  vendorPayToAddresses,
  vendorShipToAddresses,
  vendorBillToAddresses,
  shipTypeOpts,
  onOpenAddressModal,
}) {
  const shipToOptions = vendorShipToAddresses.length ? vendorShipToAddresses : vendorPayToAddresses;
  const billToOptions = vendorBillToAddresses.length ? vendorBillToAddresses : vendorPayToAddresses;

  return (
    <div className="sap-tab-panel so-tab-panel so-logistics-panel">
      <div className="so-logistics-grid">
        <section className="so-logistics-column so-logistics-column--left">
          <div className="sap-form-row so-logistics-row">
            <label className="so-field__label">Ship To</label>
            <div className="sap-input-group so-logistics-field-with-button">
              <select className="so-field__select" name="shipToCode" value={header.shipToCode || ''} onChange={onHeaderChange}>
                <option value="">Select</option>
                {shipToOptions.map(a => (
                  <option key={a.Address} value={a.Address}>{a.AddressName || a.Address || a.CardCode} - {a.State || 'No State'}</option>
                ))}
                {header.shipToCode && !shipToOptions.some(a => a.Address === header.shipToCode) && (
                  <option value={header.shipToCode}>{header.shipToCode}</option>
                )}
              </select>
              <button type="button" className="so-btn so-btn--lookup" onClick={() => onOpenAddressModal('shipTo')} title="Select Address">...</button>
            </div>
          </div>

          <div className="sap-form-row so-logistics-row so-logistics-row--address">
            <span aria-hidden="true" />
            <textarea className="so-textarea" rows={3} name="shipToAddress" value={header.shipToAddress || ''} onChange={onHeaderChange} />
          </div>

          <div className="sap-form-row so-logistics-row">
            <label className="so-field__label">Bill To</label>
            <div className="sap-input-group so-logistics-field-with-button">
              <select className="so-field__select" name="billToCode" value={header.billToCode || ''} onChange={onHeaderChange}>
                <option value="">Select</option>
                {billToOptions.map(a => (
                  <option key={a.Address} value={a.Address}>{a.AddressName || a.Address || a.CardCode} - {a.State || 'No State'}</option>
                ))}
                {header.billToCode && !billToOptions.some(a => a.Address === header.billToCode) && (
                  <option value={header.billToCode}>{header.billToCode}</option>
                )}
              </select>
              <button type="button" className="so-btn so-btn--lookup" onClick={() => onOpenAddressModal('billTo')} title="Select Address">...</button>
            </div>
          </div>

          <div className="sap-form-row so-logistics-row so-logistics-row--address">
            <span aria-hidden="true" />
            <textarea className="so-textarea" rows={3} name="billToAddress" value={header.billToAddress || ''} onChange={onHeaderChange} />
          </div>

          <div className="sap-form-row so-logistics-row">
            <label className="so-field__label">Shipping Type</label>
            <select className="so-field__select" name="shippingType" value={header.shippingType} onChange={onHeaderChange}>
              <option value="">Select</option>
              {shipTypeOpts.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="sap-form-row so-logistics-row so-logistics-row--checkbox">
            <label className="sap-checkbox-row so-logistics-checkbox-row">
              <input type="checkbox" name="useBillToForTax" checked={!!header.useBillToForTax} onChange={onHeaderChange} />
              <span>Use Bill to Address to Determine Tax</span>
            </label>
          </div>
        </section>

        <section className="so-logistics-column so-logistics-column--right">
          <div className="sap-form-row so-logistics-row">
            <label className="so-field__label">Language</label>
            <select className="so-field__select" name="language" value={header.language || '8'} onChange={onHeaderChange}>
              <option value="">Select</option>
              <option value="8">English (UK)</option>
              <option value="3">English (US)</option>
              <option value="26">Hindi</option>
            </select>
          </div>

          <div className="sap-form-row so-logistics-row">
            <label className="so-field__label">Tracking No.</label>
            <input className="so-field__input" name="trackingNo" value={header.trackingNo || ''} onChange={onHeaderChange} />
          </div>

          <div className="sap-form-row so-logistics-row">
            <label className="so-field__label">Stamp No.</label>
            <input className="so-field__input" name="stampNo" value={header.stampNo || ''} onChange={onHeaderChange} />
          </div>

          <div className="sap-form-row so-logistics-row so-logistics-row--checkbox">
            <label className="sap-checkbox-row so-logistics-checkbox-row">
              <input type="checkbox" name="confirmed" checked={Boolean(header.confirmed)} onChange={onHeaderChange} />
              <span>Approved</span>
            </label>
          </div>

          <div className="sap-form-row so-logistics-row">
            <label className="so-field__label">Pick and Pack Remarks</label>
            <input className="so-field__input" name="pickPackRemarks" value={header.pickPackRemarks || ''} onChange={onHeaderChange} />
          </div>

          <div className="sap-form-row so-logistics-row">
            <label className="so-field__label">BP Channel Name</label>
            <input className="so-field__input" name="bpChannelName" value={header.bpChannelName || ''} onChange={onHeaderChange} />
          </div>

          <div className="sap-form-row so-logistics-row">
            <label className="so-field__label">BP Channel Contact</label>
            <select className="so-field__select" name="bpChannelContact" value={header.bpChannelContact || ''} onChange={onHeaderChange}>
              <option value="">Select</option>
            </select>
          </div>
        </section>
      </div>
    </div>
  );
}
