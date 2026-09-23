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
    effectiveTaxCodes={overrides.effectiveTaxCodes || []}
    effectiveWarehouses={[]}
    fmtTaxLabel={(value) => value}
    valErrors={{ lines: [] }}
    matrixFields={overrides.matrixFields || []}
    shippingTypeOptions={overrides.shippingTypeOptions || []}
    onLoadLookupOptions={overrides.onLoadLookupOptions}
    formSettings={overrides.formSettings || {}}
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

test('always renders the mandatory row-number column when an imported layout omits it', () => {
  renderContentsTab({
    lines: [{ itemNo: 'RM-001' }],
    matrixFields: [{
      key: 'itemNo',
      fieldName: 'ItemCode',
      label: 'Item No.',
      importedLayout: true,
    }],
  });

  expect(screen.getByRole('columnheader', { name: '#' })).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: '1' })).toBeInTheDocument();
});

test('renders the row-number column first when an imported layout places it mid-grid', () => {
  renderContentsTab({
    lines: [{ itemNo: 'RM-001' }],
    matrixFields: [
      { key: 'itemNo', fieldName: 'ItemCode', label: 'Item No.', order: 1, importedLayout: true },
      { key: 'brockSeller', fieldName: 'U_BrockSeller', label: 'Brock Seller', order: 40, importedLayout: true },
      { key: '__lineNumber', fieldName: 'LineNum', label: '#', order: 41, importedLayout: true },
      { key: 'lineDistrRule', fieldName: 'CostingCode', label: 'Distr. Rule', order: 42, importedLayout: true },
    ],
    formSettings: {
      matrixColumns: {
        itemNo: { visible: true, order: 1 },
        brockSeller: { visible: true, order: 40 },
        __lineNumber: { visible: true, order: 41 },
        lineDistrRule: { visible: true, order: 42 },
      },
    },
  });

  expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent('#');
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

test('configured lookup overrides a specialized standard line renderer', () => {
  renderContentsTab({
    lines: [{ quantity: '1' }],
    onLoadLookupOptions: jest.fn().mockResolvedValue([]),
    matrixFields: [{
      key: 'quantity',
      valueKey: 'quantity',
      rendererKey: 'quantity',
      fieldName: 'Quantity',
      label: 'Quantity',
      active: true,
      readOnly: false,
      importedLayout: true,
      schemaDriven: true,
      lookupConfigured: true,
      lookupSource: 'warehouses',
      lookup: { source: 'warehouses', fieldId: 'RDR1.Quantity' },
    }],
  });

  expect(screen.getByTitle('List of Quantity')).toBeEnabled();
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
test('keeps UoM Name blank after the user clears it', () => {
  const onLineChange = jest.fn();
  renderContentsTab({
    lines: [{ uomName: '', uomCode: 'MTR', uomNameEdited: true }],
    onLineChange,
    matrixFields: [{
      key: 'uomName',
      label: 'UoM Name',
      active: true,
      readOnly: false,
      importedLayout: true,
    }],
  });

  const uomNameInput = screen.getByRole('textbox');
  expect(uomNameInput).toHaveValue('');

  fireEvent.change(uomNameInput, { target: { value: 'Mtr.' } });
  expect(onLineChange).toHaveBeenCalledTimes(1);
  expect(onLineChange.mock.calls[0][0]).toBe(0);
  expect(onLineChange.mock.calls[0][1].target.name).toBe('uomName');
});

test('does not fabricate a Manual UoM when company item options are unavailable', () => {
  const onLineChange = jest.fn();
  renderContentsTab({
    lines: [{ uomCode: '' }],
    onLineChange,
    matrixFields: [{
      key: 'uomCode',
      label: 'UoM Code',
      active: true,
      readOnly: false,
      importedLayout: true,
    }],
    getUomOptions: () => [],
  });

  const uomCodeSelect = screen.getByRole('combobox');
  expect(uomCodeSelect).toHaveValue('');
  expect(screen.queryByRole('option', { name: 'Manual' })).not.toBeInTheDocument();
});

test('keeps Manual UoM Name editable while its code is fixed', () => {
  renderContentsTab({
    lines: [{ uomEntry: -1, uomCode: 'Manual', uomName: 'MTR' }],
    matrixFields: [
      { key: 'uomCode', label: 'UoM Code', active: true, readOnly: false, importedLayout: true },
      { key: 'uomName', label: 'UoM Name', active: true, readOnly: false, importedLayout: true },
    ],
    getUomOptions: () => ['Manual'],
  });

  expect(screen.getByRole('combobox')).toBeDisabled();
  expect(screen.getByRole('textbox')).toBeEnabled();
  expect(screen.getByRole('textbox')).toHaveValue('MTR');
});

test('does not lock core editable fields from a stale imported active flag', () => {
  renderContentsTab({
    lines: [{ stdDiscount: '2' }],
    matrixFields: [{
      key: 'stdDiscount',
      label: 'Discount %',
      active: false,
      readOnly: false,
      importedLayout: true,
    }],
  });

  expect(screen.getByDisplayValue('2')).toBeEnabled();
});

test('uses native Tab navigation after a configured Packing Type selector', () => {
  renderContentsTab({
    lines: [{ udf: { U_PackingType: 'Bag' }, stdDiscount: '' }],
    matrixFields: [
      {
        key: 'U_PackingType',
        label: 'Packing-Type',
        active: true,
        readOnly: false,
        importedLayout: true,
        isUdf: true,
        options: [{ value: 'Bag', label: 'Bag' }],
      },
      { key: 'stdDiscount', label: 'Discount %', active: true, readOnly: false, importedLayout: true },
    ],
  });

  expect(screen.getByRole('combobox')).toHaveAttribute('data-sap-native-tab', 'true');
  expect(screen.getByRole('textbox')).toBeEnabled();
});

test('calculates FOR Rate in find mode when loaded value is zero', () => {
  renderContentsTab({
    lines: [{ forRate: '0.000000', unitPrice: '21', stdDiscount: '2', taxCode: '12-GST' }],
    effectiveTaxCodes: [{ Code: '12-GST', Rate: 12 }],
    matrixFields: [{
      key: 'forRate',
      label: 'FOR Rate',
      type: 'number',
      numeric: true,
      active: true,
      readOnly: false,
      importedLayout: true,
    }],
  });

  expect(screen.getByDisplayValue('23.04960')).toBeInTheDocument();
});
