import SapModalShell from '../../../components/common/SapModalShell';

const TAX_FIELDS = [
  ['panNo', 'P.A.N. No.'],
  ['panCircleNo', 'P.A.N. Circle No.'],
  ['panWardNo', 'P.A.N. Ward No.'],
  ['panAssessingOfficer', 'P.A.N. Assessing Officer'],
  ['deducteeRefNo', 'Deductee Ref. No.'],
  ['lstVatNo', 'LST/VAT No.'],
  ['cstNo', 'CST No.'],
  ['tanNo', 'TAN No.'],
  ['serviceTaxNo', 'Service Tax No.'],
  ['companyType', 'Company Type'],
  ['natureOfBusiness', 'Nature of Business'],
  ['assesseeType', 'Assessee Type'],
  ['tinNo', 'TIN No.'],
];

export default function TaxInfoModal({ isOpen, onClose, onSave, taxInfoForm = {}, onFormChange }) {
  if (!isOpen) return null;

  return (
    <SapModalShell
      open={isOpen}
      title="Tax Information"
      onClose={onClose}
      size="standard"
      className="ap-tax-info-window"
      overlayClassName="ap-tax-info-overlay"
      bodyClassName="ap-tax-info-body"
      footerClassName="ap-tax-info-footer"
      footer={(
        <>
          <button type="button" className="sap-modal-shell__button sap-modal-shell__button--primary" onClick={onSave}>OK</button>
          <button type="button" className="sap-modal-shell__button" onClick={onClose}>Cancel</button>
        </>
      )}
    >
      {TAX_FIELDS.map(([name, label]) => (
        <label className="ap-tax-info-field" key={name}>
          <span>{label}</span>
          <input name={name} value={taxInfoForm[name] || ''} onChange={onFormChange} />
        </label>
      ))}

      <label className="ap-tax-info-field">
        <span>GST Type</span>
        <select name="gstType" value={taxInfoForm.gstType || ''} onChange={onFormChange}>
          <option value="">— Select —</option>
          <option value="Regular/TDS/ISD">Regular/TDS/ISD</option>
          <option value="Composition">Composition</option>
          <option value="Casual Taxable Person">Casual Taxable Person</option>
          <option value="Unregistered">Unregistered</option>
        </select>
      </label>

      <label className="ap-tax-info-field">
        <span>GSTIN</span>
        <input name="gstin" value={taxInfoForm.gstin || ''} onChange={onFormChange} maxLength={15} />
      </label>
    </SapModalShell>
  );
}
