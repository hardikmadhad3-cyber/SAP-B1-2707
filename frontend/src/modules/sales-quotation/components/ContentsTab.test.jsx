import React from 'react';
import { render, screen } from '@testing-library/react';
import ContentsTab from './ContentsTab';

const renderContents = (overrides = {}) => render(
  <ContentsTab
    lines={overrides.lines || []}
    onLineChange={jest.fn()}
    onNumBlur={jest.fn()}
    lineItemOptions={[]}
    onAddLine={jest.fn()}
    onRemoveLine={jest.fn()}
    getUomOptions={() => []}
    effectiveTaxCodes={[]}
    effectiveWarehouses={[]}
    valErrors={{ lines: [] }}
    formSettings={overrides.formSettings || {}}
    matrixFields={overrides.matrixFields || []}
    rowUdfFields={overrides.rowUdfFields || []}
    formSettingsReady={overrides.formSettingsReady}
  />,
);

describe('Sales Quotation company line fields', () => {
  test('hides the previous company matrix while replacement metadata is loading', () => {
    renderContents({
      formSettingsReady: false,
      lines: [{ udf: { U_CompanyA: 'Old value' } }],
      matrixFields: [{ key: 'U_CompanyA', label: 'Company A Field', isUdf: true }],
    });

    expect(screen.getByRole('status')).toHaveTextContent('Loading company line-field settings');
    expect(screen.queryByText('Company A Field')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Old value')).not.toBeInTheDocument();
  });

  test('renders only current-company UDFs and keeps an unsupported SAP field read-only', () => {
    renderContents({
      formSettingsReady: true,
      lines: [{
        udf: { U_CompanyA: 'Old value', U_CompanyB: 'Current value' },
        sapAuditValue: 'Display only',
      }],
      matrixFields: [
        {
          key: 'U_CompanyB',
          valueKey: 'U_CompanyB',
          label: 'Company B Field',
          isUdf: true,
          field: { key: 'U_CompanyB', label: 'Company B Field', type: 'text' },
        },
        {
          key: 'sapAuditValue',
          valueKey: 'sapAuditValue',
          label: 'SAP Audit Value',
          schemaDriven: true,
          readOnly: true,
        },
      ],
    });

    expect(screen.getByText('Company B Field')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Current value')).toBeEnabled();
    expect(screen.queryByText('Company A Field')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Old value')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Display only')).toBeDisabled();
  });

  test('shows standard line columns enabled from Content Columns even when SAP layout marks them hidden', () => {
    renderContents({
      formSettingsReady: true,
      lines: [{
        itemNo: 'A1000',
        itemDescription: 'Visible quotation description',
        quantity: '1',
        uomName: 'Carton',
      }],
      matrixFields: [
        { key: 'itemNo', label: 'Item No.', visible: true, order: 1 },
        { key: 'itemDescription', label: 'Item Description', visible: false, order: 2 },
        { key: 'quantity', label: 'Quantity', visible: true, order: 3 },
        { key: 'uomName', label: 'UoM Name', visible: false, order: 4 },
      ],
      formSettings: {
        matrixColumns: {
          itemDescription: { visible: true, order: 2 },
          uomName: { visible: true, order: 4 },
        },
      },
    });

    expect(screen.getByText('Item Description')).toBeInTheDocument();
    expect(screen.getByText('UoM Name')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Visible quotation description')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Carton')).toBeInTheDocument();
  });
});
