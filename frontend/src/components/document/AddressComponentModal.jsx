import React from 'react';
import SapModalShell from '../common/SapModalShell';

const FIELDS = [
  ['Street / PO Box', 'streetPoBox'],
  ['Street No.', 'streetNo'],
  ['Building/Floor/Room', 'buildingFloorRoom'],
  ['Block', 'block'],
  ['City', 'city'],
  ['Zip Code', 'zipCode'],
  ['County', 'county'],
  ['State', 'state', 'state'],
  ['Country/Region', 'countryRegion'],
  ['Address Name 2', 'addressName2'],
  ['Address Name 3', 'addressName3'],
  ['GLN', 'gln'],
  ['ERP Address', 'erpAddress'],
  ['CONTACT-PERSON', 'contactPerson'],
  ['MOBILE', 'mobile'],
  ['Date of Registration', 'dateOfRegistration'],
  ['Date Detl of Reg', 'dateDetailsOfRegistration'],
  ['Status', 'addressStatus'],
  ['GSTIN No', 'gstin'],
];

export default function AddressComponentModal({
  isOpen,
  onClose,
  onSave,
  addressForm = {},
  onFormChange,
  states = [],
}) {
  if (!isOpen) return null;

  return (
    <SapModalShell
      open={isOpen}
      title="Address Component"
      onClose={onClose}
      size="standard"
      className="sap-address-modal"
      bodyClassName="sap-address-modal__body"
      footerClassName="sap-address-modal__footer"
      footer={(
        <>
          <button type="button" className="sap-modal-shell__button sap-modal-shell__button--primary" onClick={onSave}>OK</button>
          <button type="button" className="sap-modal-shell__button" onClick={onClose}>Cancel</button>
        </>
      )}
    >
          {FIELDS.map(([label, name, type]) => (
            <label className="sap-address-modal__field" key={name}>
              <span>{label}</span>
              {type === 'state' ? (
                <select name={name} value={addressForm[name] || ''} onChange={onFormChange}>
                  <option value="">Select</option>
                  {states.map((state) => {
                    const value = state.Code || state.code || state.Name || state.name || '';
                    const text = state.Name || state.name || state.Code || state.code || '';
                    return <option key={`${value}-${text}`} value={value}>{text}</option>;
                  })}
                  {addressForm[name] && !states.some((state) =>
                    String(state.Code || state.code || state.Name || state.name || '') === String(addressForm[name])) && (
                    <option value={addressForm[name]}>{addressForm[name]}</option>
                  )}
                </select>
              ) : (
                <input name={name} value={addressForm[name] || ''} onChange={onFormChange} />
              )}
            </label>
          ))}
    </SapModalShell>
  );
}
