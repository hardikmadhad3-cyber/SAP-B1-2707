import { fireEvent, render, screen } from '@testing-library/react';
import ContentsTab from './ContentsTab';

const baseProps = {
  onLineChange: jest.fn(),
  onNumBlur: jest.fn(),
  onAddLine: jest.fn(),
  onRemoveLine: jest.fn(),
  lineItemOptions: [],
  getUomOptions: () => [],
  effectiveTaxCodes: [],
  effectiveWarehouses: [],
  valErrors: { lines: {} },
  formSettings: { matrixColumns: {}, rowUdfs: {} },
};

test('renders and edits a current-company A/P row UDF from live metadata', () => {
  const onRowUdfChange = jest.fn();
  const udfField = { key: 'U_VendorBatch', label: 'Vendor Batch', type: 'text' };
  render(
    <ContentsTab
      {...baseProps}
      lines={[{ itemNo: 'RM-001', udf: { U_VendorBatch: 'VB-1' } }]}
      matrixFields={[
        { key: 'itemNo', label: 'Item No.' },
        { key: 'U_VendorBatch', label: 'Vendor Batch', isUdf: true, field: udfField },
      ]}
      rowUdfFields={[udfField]}
      formSettings={{ matrixColumns: { U_VendorBatch: { visible: true, active: true } }, rowUdfs: {} }}
      onRowUdfChange={onRowUdfChange}
    />
  );

  expect(screen.getByText('Vendor Batch')).toBeInTheDocument();
  fireEvent.change(screen.getByDisplayValue('VB-1'), { target: { value: 'VB-2' } });
  expect(onRowUdfChange).toHaveBeenCalledWith(0, 'U_VendorBatch', 'VB-2');
});

test('does not render a hidden A/P row UDF', () => {
  render(
    <ContentsTab
      {...baseProps}
      lines={[{ itemNo: 'RM-001', udf: { U_VendorBatch: 'VB-1' } }]}
      matrixFields={[{ key: 'itemNo', label: 'Item No.' }]}
      rowUdfFields={[]}
      formSettings={{ matrixColumns: {}, rowUdfs: { U_VendorBatch: { visible: false } } }}
      onRowUdfChange={jest.fn()}
    />
  );

  expect(screen.queryByText('Vendor Batch')).not.toBeInTheDocument();
});
