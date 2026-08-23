import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ContentsTab from './ContentsTab';

const renderContentsTab = (overrides = {}) => render(
  <ContentsTab
    lines={overrides.lines || []}
    onLineChange={overrides.onLineChange || jest.fn()}
    onNumBlur={jest.fn()}
    lineItemOptions={[]}
    onAddLine={jest.fn()}
    onRemoveLine={jest.fn()}
    getUomOptions={() => []}
    effectiveTaxCodes={[]}
    effectiveWarehouses={[]}
    fmtTaxLabel={(value) => value}
    valErrors={{ lines: [] }}
    matrixFields={overrides.matrixFields || []}
    shippingTypeOptions={overrides.shippingTypeOptions || []}
    formSettings={{}}
  />
);

test('shows the Shipping Type name while retaining its SAP transport code', () => {
  let selectedChange = null;
  const onLineChange = jest.fn((_rowIndex, event) => {
    selectedChange = { name: event.target.name, value: event.target.value };
  });
  renderContentsTab({
    lines: [{ lineShippingType: '3' }],
    onLineChange,
    matrixFields: [{
      key: 'lineShippingType',
      fieldName: 'ShipType',
      label: 'Shipping Type',
      importedLayout: true,
      schemaDriven: true,
    }],
    shippingTypeOptions: [
      { value: '3', label: 'Road Transport' },
      { value: '5', label: 'Courier' },
    ],
  });

  const shippingType = screen.getByRole('combobox', { name: 'Shipping Type row 1' });
  expect(shippingType).toHaveValue('3');
  expect(screen.getByRole('option', { name: 'Road Transport' }).selected).toBe(true);

  fireEvent.change(shippingType, { target: { value: '5' } });
  expect(onLineChange).toHaveBeenCalledTimes(1);
  expect(selectedChange).toEqual({ name: 'lineShippingType', value: '5' });
});

test('allows typing in an editable HSN column', () => {
  const onLineChange = jest.fn();
  renderContentsTab({
    lines: [{ hsnCode: '' }],
    onLineChange,
    matrixFields: [{
      key: 'hsnCode',
      fieldName: 'HsnEntry',
      label: 'HSN',
      active: true,
      readOnly: false,
      importedLayout: true,
      schemaDriven: true,
    }],
  });

  const hsnInput = screen.getByPlaceholderText('HSN');
  expect(hsnInput).toBeEnabled();
  fireEvent.change(hsnInput, { target: { value: '5208' } });
  expect(onLineChange).toHaveBeenCalledTimes(1);
});

test('keeps document-line fields readable when SAP supplies narrow column widths', () => {
  renderContentsTab({
    lines: [{
      itemNo: 'ITEM-1',
      itemDescription: 'Test item',
      quantity: '1',
      hsnCode: '5208',
      taxCode: 'GST12',
    }],
    matrixFields: [
      { key: 'itemNo', label: 'Item No.', width: 42, importedLayout: true },
      { key: 'itemDescription', label: 'Item Description', width: 55, importedLayout: true },
      { key: 'quantity', label: 'Quantity', width: 40, type: 'number', importedLayout: true },
      { key: 'hsnCode', label: 'HSN', width: 35, importedLayout: true },
      { key: 'taxCode', label: 'Tax Code', width: 45, importedLayout: true },
    ],
  });

  expect(screen.getByText('Item No.').closest('th')).toHaveStyle({ minWidth: '160px' });
  expect(screen.getByText('Item Description').closest('th')).toHaveStyle({ minWidth: '240px' });
  expect(screen.getByText('Quantity').closest('th')).toHaveStyle({ minWidth: '95px' });
  expect(screen.getByText('HSN').closest('th')).toHaveStyle({ minWidth: '115px' });
  expect(screen.getByText('Tax Code').closest('th')).toHaveStyle({ minWidth: '115px' });
  expect(screen.getByRole('table')).toHaveStyle({ width: 'max-content' });
});
