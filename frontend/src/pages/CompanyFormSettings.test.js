jest.mock('react-router-dom', () => ({
  Link: ({ children }) => children,
}), { virtual: true });

jest.mock('../api/adminPanelApi', () => ({
  fetchAdminCompanyFormSettings: jest.fn(),
  previewAdminCompanyFormQuery: jest.fn(),
  publishAdminCompanyFormQuery: jest.fn(),
  unpublishAdminCompanyFormQuery: jest.fn(),
}));

import { FORM_OPTIONS } from './CompanyFormSettings';

describe('CompanyFormSettings SQL pages', () => {
  test('keeps stable company/page keys for supported SAP documents', () => {
    expect(FORM_OPTIONS).toContainEqual(['sapb1.salesQuotation.formSettings.v1', 'Sales Quotation']);
    expect(FORM_OPTIONS).toContainEqual(['sapb1.salesOrder.formSettings.v2', 'Sales Order']);
    expect(FORM_OPTIONS).toContainEqual(['sapb1.grpo.formSettings.v1', 'Goods Receipt PO']);
    expect(FORM_OPTIONS).toContainEqual(['sapb1.purchaseRequest.formSettings.v1', 'Purchase Request']);
    expect(FORM_OPTIONS).toContainEqual(['sapb1.purchaseQuotation.formSettings.v1', 'Purchase Quotation']);
    expect(FORM_OPTIONS).toContainEqual(['sapb1.serviceArInvoice.formSettings.v7', 'Service A/R Invoice']);
    expect(FORM_OPTIONS).toContainEqual(['sapb1.serviceArCreditMemo.formSettings.v10', 'Service A/R Credit Memo']);
    expect(FORM_OPTIONS).toContainEqual(['sapb1.serviceApInvoice.formSettings.v10', 'Service A/P Invoice']);
    expect(FORM_OPTIONS).toContainEqual(['sapb1.serviceApCreditMemo.formSettings.v10', 'Service A/P Credit Memo']);
  });
});
