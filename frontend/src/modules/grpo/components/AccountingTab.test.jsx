import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AccountingTab from './AccountingTab';

const header = {
  journalRemark: '',
  paymentTerms: '',
  paymentMethod: '',
  centralBankInd: '',
  dueDateMonths: '0',
  dueDateDays: '0',
  cashDiscountOffset: '',
  paymentTerms2: '',
  advancePaymentPercent: '',
  advanceAmt: '',
  balancePaymentAgainst: '',
  shipmentWithin: '',
  expiryDate: '',
  advanceDate: '',
  withinDays: '',
  daysFrom: '',
  bpProject: '',
  qrCodeFrom: '',
  cancellationDate: '',
  requiredDate: '',
  indicator: '',
  orderNumber: '',
};

test('shows the referenced-document count and opens the reference dialog', () => {
  const onOpenReferenceDocuments = jest.fn();
  render(
    <AccountingTab
      header={header}
      onHeaderChange={jest.fn()}
      paymentTermOptions={[]}
      referenceDocuments={[
        { transactionType: '22', docEntry: '44', docNumber: '100044' },
        { direction: 'to', transactionType: '', docEntry: '', docNumber: '' },
      ]}
      onOpenReferenceDocuments={onOpenReferenceDocuments}
    />,
  );

  expect(screen.getByLabelText('Referenced Document count')).toHaveValue('(1)');
  fireEvent.click(screen.getByRole('button', { name: 'Open Referenced Documents' }));
  expect(onOpenReferenceDocuments).toHaveBeenCalledTimes(1);
});

