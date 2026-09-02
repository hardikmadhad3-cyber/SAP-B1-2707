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
    formSettings={{}}
    matrixFields={overrides.matrixFields || []}
    rowUdfFields={overrides.rowUdfFields || []}
    formSettingsReady={overrides.formSettingsReady}
  />,
);

describe('A/R Credit Memo company line fields', () => {
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
});
