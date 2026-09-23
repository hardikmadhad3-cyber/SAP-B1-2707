/**
 * Frontend-side display configuration for the 3 Gate Pass transactions —
 * drives GatePassTransactionForm.jsx the same way jobWorkTransactions.js
 * drives JobWorkDocumentPage.jsx. Field names / labels / combo values match
 * backend/services/gatePassSchema.js, transcribed from the legacy add-on's
 * frmVisitor.xml / frmGPin.xml / frmGPout.xml form definitions.
 */

const dateField = (name, label) => ({ name, label, type: 'date' });
const textField = (name, label) => ({ name, label, type: 'text' });
const numberField = (name, label) => ({ name, label, type: 'number' });
const selectField = (name, label, options) => ({ name, label, type: 'select', options });
const textareaField = (name, label) => ({ name, label, type: 'textarea' });

export const GATE_PASS_TRANSACTIONS = {
  visitorLog: {
    apiKey: 'visitorLog',
    menuName: 'Visitor Log',
    docLabel: 'Visitor',
    partyCodeField: 'NAME',
    partyLabel: 'Visitor Name',
    headerFields: [
      dateField('VIDATE', 'Visitor In Date'),
      textField('VITIME', 'Visitor In Time'),
      textField('ORGN', 'Organization'),
      textField('PHENO', 'Visitor Phone No'),
      textField('PERS', 'Person To Meet'),
      textField('ALTER', 'Alternate Person'),
      textField('EPERS', 'Additional Person(s)'),
      textField('DEPT', 'Department'),
      textField('EHOUR', 'Expected Duration'),
      selectField('VSTORTY', 'Visitor Type', 'visitorType'),
      selectField('VSTYPE', 'Visit Type', 'visitType'),
      dateField('VODATE', 'Visitor Out Date'),
      textField('VOTIME', 'Visitor Out Time'),
    ],
    remarksFields: [textareaField('PURPS', 'Purpose'), textareaField('ADDRS', 'Address')],
    lineTable: 'STGTVS1',
    lineFields: [textField('PART', 'Particulars'), numberField('QTY', 'Quantity'), textField('DETAIL', 'Details')],
  },

  gateIn: {
    apiKey: 'gateIn',
    menuName: 'Gate In — Material Inward',
    docLabel: 'Gate Entry',
    partyCodeField: 'VCODE',
    partyLabel: 'Customer/Vendor',
    headerFields: [
      dateField('DOCDATE', 'Gate Entry Date'),
      textField('VEHNO', 'Vehicle No'),
      textField('LRNO', 'LR Number'),
      textField('VNAME', 'Customer/Vendor Name'),
      textField('GENTRY', 'Gate Entry No'),
      dateField('VEHDATE', 'Vehicle In Date'),
      textField('VEHTIME', 'Vehicle In Time'),
      textField('DOCNO', 'Base Document No'),
      selectField('DOCTYPE', 'Document Type', [
        { value: 'GRPO', label: 'GRPO' },
        { value: 'AR Credit Memo', label: 'AR Credit Memo' },
        { value: 'Goods Receipt', label: 'Goods Receipt' },
      ]),
      selectField('ITYPE', 'Inward Type', [
        { value: 'Purchase', label: 'Purchase' },
        { value: 'Sales Return', label: 'Sales Return' },
        { value: 'Other', label: 'Other' },
      ]),
      selectField('RETURNTYPE', 'Returnable', [{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]),
      dateField('DUEDATE', 'Actual Material Return Date'),
      textField('TRSNAME', 'Transporter Name'),
      textField('TRSNO', 'Transporter Cont. No'),
      selectField('GPSTUS', 'Gate Entry Status', [
        { value: 'Open', label: 'Open' },
        { value: 'Closed', label: 'Closed' },
        { value: 'Short Closed', label: 'Short Closed' },
      ]),
      textField('PTIME', 'Punch Time'),
      selectField('CHECK', 'Without Base Ref.', [{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]),
      selectField('REF', 'Reference Type', [{ value: 'Job Work', label: 'Job Work' }, { value: 'Other', label: 'Other' }]),
    ],
    remarksFields: [textareaField('PURPOSE', 'Purpose'), textareaField('REMARK', 'Remark')],
    lineTable: 'STGTPV1',
    lineFields: [
      textField('PONO', 'Doc No'), numberField('LINENO', 'Line No'), textField('ICODE', 'Item Code'),
      textField('INAME', 'Item Description'), numberField('QTY', 'Quantity'), numberField('BALQTY', 'Receipt Qty'),
      textField('UOM', 'UOM'), textField('RMKS', 'Remarks'),
    ],
    secondaryLineTable: 'STGTPV2',
    secondaryLineLabel: 'Additional Items / Outside Material',
    secondaryLineFields: [textField('ADDITM', 'Item Description'), numberField('ADDQTY', 'Quantity'), textField('ADDRMK', 'Remarks')],
  },

  gateOut: {
    apiKey: 'gateOut',
    menuName: 'Gate Out — Material Outward',
    docLabel: 'Gate Entry',
    partyCodeField: 'VCODE',
    partyLabel: 'Customer/Vendor',
    headerFields: [
      dateField('DOCDATE', 'Gate Entry Date'),
      textField('VEHNO', 'Vehicle No'),
      textField('LRNO', 'LR Number'),
      textField('VNAME', 'Customer/Vendor Name'),
      textField('DOCNO', 'Base Document No'),
      selectField('DTYPE', 'Document Type', [
        { value: 'AR Invoice', label: 'AR Invoice' },
        { value: 'AP Credit Memo', label: 'AP Credit Memo' },
        { value: 'Goods Issue', label: 'Goods Issue' },
      ]),
      selectField('OTYPE', 'Outward Type', [
        { value: 'Sales', label: 'Sales' },
        { value: 'Purchase Return', label: 'Purchase Return' },
        { value: 'Other', label: 'Other' },
      ]),
      selectField('RETURNTYPE', 'Returnable', [{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]),
      numberField('GPNO', 'Reference Gate In DocEntry'),
      dateField('DUEDATE', 'Expected Material Return Date'),
      textField('TRSNAME', 'Transporter Name'),
      textField('TRSNO', 'Transporter Cont. No'),
      dateField('VEHDATE', 'Vehicle Out Date'),
      textField('VEHTIME', 'Vehicle Out Time'),
      selectField('GPSTUS', 'Gate Entry Status', [{ value: 'Open', label: 'Open' }, { value: 'Closed', label: 'Closed' }]),
      textField('PTIME', 'Punch Time'),
      textField('GPTYPE', 'Gate Entry Type'),
      selectField('REF', 'Reference Type', [{ value: 'Job Work', label: 'Job Work' }, { value: 'Other', label: 'Other' }]),
    ],
    remarksFields: [textareaField('PURPOSE', 'Purpose')],
    lineTable: 'STGTPA1',
    lineFields: [
      textField('PONO', 'Doc No'), numberField('LINENO', 'Line No'), textField('ICODE', 'Item Code'),
      textField('INAME', 'Item Description'), numberField('QTY', 'Quantity'), numberField('BALQTY', 'Receipt Qty'),
      textField('UOM', 'UOM'), textField('RMKS', 'Remarks'),
    ],
    secondaryLineTable: 'STGTPA2',
    secondaryLineLabel: 'Additional Items / Outside Material',
    secondaryLineFields: [textField('ADDITM', 'Item Description'), numberField('ADDQTY', 'Quantity'), textField('ADDRMK', 'Remarks')],
  },
};
