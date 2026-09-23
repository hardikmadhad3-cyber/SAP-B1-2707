import React from 'react';

const AddressFieldset = ({ title, fieldMap, values, onChange }) => (
  <fieldset className="job-work-address">
    <legend>{title}</legend>
    <div className="job-work-address__grid">
      <label>
        {title}
        <input
          type="text"
          value={values[fieldMap.toggle] || ''}
          onChange={(e) => onChange(fieldMap.toggle, e.target.value)}
        />
      </label>
      <label>
        Address ID
        <input type="text" value={values[fieldMap.addressId] || ''} onChange={(e) => onChange(fieldMap.addressId, e.target.value)} />
      </label>
      <label>
        Street
        <input type="text" value={values[fieldMap.street] || ''} onChange={(e) => onChange(fieldMap.street, e.target.value)} />
      </label>
      <label>
        Street No
        <input type="text" value={values[fieldMap.streetNo] || ''} onChange={(e) => onChange(fieldMap.streetNo, e.target.value)} />
      </label>
      <label>
        Building/Floor/Room
        <input type="text" value={values[fieldMap.building] || ''} onChange={(e) => onChange(fieldMap.building, e.target.value)} />
      </label>
      <label>
        Block
        <input type="text" value={values[fieldMap.block] || ''} onChange={(e) => onChange(fieldMap.block, e.target.value)} />
      </label>
      <label>
        City
        <input type="text" value={values[fieldMap.city] || ''} onChange={(e) => onChange(fieldMap.city, e.target.value)} />
      </label>
      <label>
        Zip Code
        <input type="text" value={values[fieldMap.zip] || ''} onChange={(e) => onChange(fieldMap.zip, e.target.value)} />
      </label>
      <label>
        County
        <input type="text" value={values[fieldMap.county] || ''} onChange={(e) => onChange(fieldMap.county, e.target.value)} />
      </label>
      <label>
        Country
        <input type="text" value={values[fieldMap.country] || ''} onChange={(e) => onChange(fieldMap.country, e.target.value)} />
      </label>
      <label>
        State
        <input type="text" value={values[fieldMap.state] || ''} onChange={(e) => onChange(fieldMap.state, e.target.value)} />
      </label>
      <label>
        GSTIN
        <input type="text" value={values[fieldMap.gstin] || ''} onChange={(e) => onChange(fieldMap.gstin, e.target.value)} />
      </label>
      <label>
        GST Type
        <input type="text" value={values[fieldMap.gstType] || ''} onChange={(e) => onChange(fieldMap.gstType, e.target.value)} />
      </label>
    </div>
  </fieldset>
);

export default function JobWorkAddressBlock({ addressFields, header, onFieldChange }) {
  return (
    <div className="job-work-address-block">
      <AddressFieldset title="Bill To" fieldMap={addressFields.billTo} values={header} onChange={onFieldChange} />
      <AddressFieldset title="Ship From" fieldMap={addressFields.shipFrom} values={header} onChange={onFieldChange} />
    </div>
  );
}
