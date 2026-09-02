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

test('renders current-company Purchase Request row UDFs in document lines', () => {
  const onRowUdfChange = jest.fn();
  render(
    <ContentsTab
      {...baseProps}
      lines={[{ itemNo: 'RM-001', udf: { U_RequestClass: 'Urgent' } }]}
      matrixFields={[
        { key: 'itemNo', label: 'Item No.' },
        {
          key: 'U_RequestClass',
          label: 'Request Class',
          isUdf: true,
          field: { key: 'U_RequestClass', label: 'Request Class', type: 'text' },
        },
      ]}
      rowUdfFields={[{ key: 'U_RequestClass', label: 'Request Class', type: 'text' }]}
      onRowUdfChange={onRowUdfChange}
    />
  );

  expect(screen.getByText('Request Class')).toBeInTheDocument();
  fireEvent.change(screen.getByDisplayValue('Urgent'), { target: { value: 'Normal' } });
  expect(onRowUdfChange).toHaveBeenCalledWith(0, 'U_RequestClass', 'Normal');
});

test('respects Purchase Request row-UDF visibility settings', () => {
  render(
    <ContentsTab
      {...baseProps}
      lines={[{ itemNo: 'RM-001', udf: { U_RequestClass: 'Urgent' } }]}
      matrixFields={[
        { key: 'itemNo', label: 'Item No.' },
        {
          key: 'U_RequestClass',
          label: 'Request Class',
          isUdf: true,
          field: { key: 'U_RequestClass', label: 'Request Class', type: 'text' },
        },
      ]}
      rowUdfFields={[{ key: 'U_RequestClass', label: 'Request Class', type: 'text' }]}
      formSettings={{ matrixColumns: { U_RequestClass: { visible: false } }, rowUdfs: {} }}
      onRowUdfChange={jest.fn()}
    />
  );

  expect(screen.queryByText('Request Class')).not.toBeInTheDocument();
});
