import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('../../api/formSettingsApi', () => ({
  runCompanyFormQuery: jest.fn(),
}));

const QUERY_RESULT = {
    columns: [
      { key: 'Item Code', label: 'Item Code', type: 'text' },
      { key: 'Quantity', label: 'Quantity', type: 'number' },
    ],
    rows: [{ 'Item Code': 'A100', Quantity: 3 }],
    truncated: false,
};

import { runCompanyFormQuery } from '../../api/formSettingsApi';
import CompanyQueryContentTable from './CompanyQueryContentTable';

test('loads and renders a published read-only Content query with document context', async () => {
  runCompanyFormQuery.mockResolvedValue(QUERY_RESULT);
  render(
    <CompanyQueryContentTable
      formSettings={{
        __companyQueryLayout: {
          formKey: 'sapb1.salesOrder.formSettings.v2',
          isPublished: true,
          version: 4,
          columns: [],
        },
      }}
      context={{ docEntry: 42, cardCode: 'C100' }}
    />,
  );

  expect(screen.getByText('Loading published Content view...')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText('A100')).toBeInTheDocument());
  expect(screen.getByRole('columnheader', { name: 'Item Code' })).toBeInTheDocument();
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(runCompanyFormQuery).toHaveBeenCalledWith(
    'sapb1.salesOrder.formSettings.v2',
    { docEntry: 42, cardCode: 'C100' },
    expect.objectContaining({ signal: expect.anything() }),
  );
});
