import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TransactionFieldConfiguration from './TransactionFieldConfiguration';
import {
  fetchAdminFieldConfiguration,
  previewAdminCustomLookup,
  saveAdminCustomLookup,
  saveAdminFieldConfiguration,
} from '../../api/adminPanelApi';

jest.mock('../../api/adminPanelApi', () => ({
  fetchAdminFieldConfiguration: jest.fn(),
  previewAdminCustomLookup: jest.fn(),
  saveAdminCustomLookup: jest.fn(),
  saveAdminFieldConfiguration: jest.fn(),
}));

const response = {
  companyId: 2, companyDb: 'TEST_DB', companyName: 'Test Company', dialect: 'hana',
  companies: [{ companyId: 2, companyName: 'Test Company', dbName: 'TEST_DB', dialect: 'hana' }],
  documentType: 'SALES_ORDER', objectType: '17', lineTable: 'RDR1', schemaVersion: 'base-v1',
  customLookups: [],
  lookupSources: [{ source: 'items', label: 'Items' }, { source: 'warehouses', label: 'Warehouses' }],
  lineFields: [
    { id: 'RDR1.Quantity', order: 4, label: 'Quantity', stateKey: 'quantity', sapField: 'Quantity', databaseField: 'Quantity', type: 'number', editable: true, readOnly: false, defaultLookupSource: null, configuredLookupSource: null, allowedLookupSources: ['items', 'warehouses'] },
    { id: 'RDR1.LineTotal', order: 14, label: 'Total', stateKey: 'lineTotal', sapField: 'LineTotal', databaseField: 'LineTotal', type: 'number', editable: false, readOnly: true, defaultLookupSource: null, configuredLookupSource: null, allowedLookupSources: ['items', 'warehouses'] },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  fetchAdminFieldConfiguration.mockResolvedValue(response);
  saveAdminFieldConfiguration.mockResolvedValue({
    ...response,
    lineFields: response.lineFields.map((field) => field.id === 'RDR1.Quantity' ? { ...field, configuredLookupSource: 'warehouses' } : field),
  });
  previewAdminCustomLookup.mockResolvedValue({ columns: ['value', 'label'], rowCount: 2, rows: [{ value: 'A', label: 'Alpha' }, { value: 'B', label: 'Beta' }] });
  saveAdminCustomLookup.mockResolvedValue({ customLookup: { id: 7, source: 'custom:7', name: 'My Items', queryText: 'SELECT 1 AS value, 1 AS label' } });
});

test('selects an Admin company and transaction and saves a line lookup assignment', async () => {
  render(<TransactionFieldConfiguration />);
  expect(await screen.findByRole('option', { name: 'Test Company (HANA)' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'A/R Credit Memo' })).toBeInTheDocument();
  expect(screen.queryByText('Document Header')).not.toBeInTheDocument();

  const quantityLookup = screen.getByRole('combobox', { name: 'Quantity lookup' });
  expect(quantityLookup).toBeEnabled();
  expect(screen.getByRole('combobox', { name: 'Total lookup' })).toBeDisabled();
  fireEvent.change(quantityLookup, { target: { value: 'warehouses' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Configuration' }));

  await waitFor(() => expect(saveAdminFieldConfiguration).toHaveBeenCalledWith({
    companyId: 2, documentType: 'SALES_ORDER', schemaVersion: 'base-v1',
    assignments: [{ fieldId: 'RDR1.Quantity', lookupSource: 'warehouses' }],
  }));
  expect(await screen.findByText(/Lookup configuration saved/)).toBeInTheDocument();
});

test('runs a custom HANA lookup and displays every returned preview row', async () => {
  render(<TransactionFieldConfiguration />);
  await screen.findByText('Custom Lookup Query');
  fireEvent.change(screen.getByLabelText('Lookup name'), { target: { value: 'My Items' } });
  fireEvent.change(screen.getByLabelText('SAP HANA query'), { target: { value: 'SELECT 1 AS value, 1 AS label' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run Lookup' }));
  expect(await screen.findByText('Alpha')).toBeInTheDocument();
  expect(screen.getByText('Beta')).toBeInTheDocument();
  expect(screen.getByText(/2 rows returned/)).toBeInTheDocument();
});
