import React from 'react';
import { render } from '@testing-library/react';
import InventoryPrintLayoutActions from './InventoryPrintLayoutActions';
import PrintLayoutToolbar from './PrintLayoutToolbar';

jest.mock('./PrintLayoutToolbar', () => jest.fn(() => null));

const DOCUMENTS = [
  ['goodsReceipt', 'Goods Receipt'],
  ['goodsIssue', 'Goods Issue'],
  ['inventoryTransferRequest', 'Inventory Transfer Request'],
  ['inventoryTransfer', 'Inventory Transfer'],
];

beforeEach(() => {
  PrintLayoutToolbar.mockClear();
});

test.each(DOCUMENTS)('maps %s to the shared print toolbar', (documentKey, documentLabel) => {
  const onSuccess = jest.fn();
  const onError = jest.fn();

  render(
    <InventoryPrintLayoutActions
      documentKey={documentKey}
      docEntry={42}
      docNumber="100042"
      series="17"
      cardCode="V1000"
      disabled
      defaultSchema="COMPANY_A"
      onSuccess={onSuccess}
      onError={onError}
    />,
  );

  expect(PrintLayoutToolbar).toHaveBeenCalledTimes(1);
  expect(PrintLayoutToolbar.mock.calls[0][0]).toEqual(expect.objectContaining({
    documentType: documentKey,
    documentLabel,
    docEntry: 42,
    docNumber: '100042',
    series: '17',
    cardCode: 'V1000',
    disabled: true,
    defaultSchema: 'COMPANY_A',
    classPrefix: 'po',
    onSuccess,
    onError,
  }));
});

test('does not render a print toolbar for an unsupported inventory document', () => {
  const { container } = render(
    <InventoryPrintLayoutActions documentKey="unknown" docEntry={42} />,
  );

  expect(container).toBeEmptyDOMElement();
  expect(PrintLayoutToolbar).not.toHaveBeenCalled();
});
