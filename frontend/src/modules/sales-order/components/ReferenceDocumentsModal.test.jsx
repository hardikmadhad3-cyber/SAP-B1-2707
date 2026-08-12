import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReferenceDocumentsModal from './ReferenceDocumentsModal';
import { fetchSalesOrderReferenceDocumentLookup } from '../../../api/salesOrderApi';

jest.mock('../../../api/salesOrderApi', () => ({
  fetchSalesOrderReferenceDocumentLookup: jest.fn(),
}));

test('opens a usable purchase-order picker with selection actions', async () => {
  fetchSalesOrderReferenceDocumentLookup.mockResolvedValue({
    data: {
      label: 'Purchase Order',
      options: [{
        docEntry: 44,
        docNumber: 44,
        cardCode: 'DS0799',
        cardName: 'Vendor',
        docDate: '2025-07-17',
        extDocNumber: '',
        status: 'Open',
      }],
    },
  });

  render(
    <ReferenceDocumentsModal
      isOpen
      referenceDocuments={[]}
      onClose={jest.fn()}
      onSave={jest.fn()}
      cardCode="DS0799"
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Select transaction type for row 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Purchase Order' }));
  fireEvent.click(screen.getAllByTitle('Choose document')[0]);

  expect(await screen.findByRole('dialog', { name: 'List of Purchase Orders' })).toBeInTheDocument();
  const chooseButton = screen.getByRole('button', { name: 'Choose' });
  expect(chooseButton).toBeDisabled();

  fireEvent.click(await screen.findByText('DS0799'));
  expect(chooseButton).toBeEnabled();
  fireEvent.click(chooseButton);

  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'List of Purchase Orders' })).not.toBeInTheDocument());
  expect(screen.getByDisplayValue('44')).toBeInTheDocument();
});
