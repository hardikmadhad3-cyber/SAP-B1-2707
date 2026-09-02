import { fireEvent, render, screen } from '@testing-library/react';
import ContentsTab from './ContentsTab';

test('renders and edits a current-company Purchase Quotation row UDF', () => {
  const onRowUdfChange = jest.fn();
  render(
    <ContentsTab
      lines={[{ itemNo: 'RM-001', udf: { U_QuoteGrade: 'Premium' } }]}
      onLineChange={jest.fn()}
      onNumBlur={jest.fn()}
      onAddLine={jest.fn()}
      onRemoveLine={jest.fn()}
      lineItemOptions={[]}
      getUomOptions={() => []}
      effectiveTaxCodes={[]}
      effectiveWarehouses={[]}
      valErrors={{ lines: {} }}
      matrixFields={[
        { key: 'itemNo', label: 'Item No.' },
        {
          key: 'U_QuoteGrade',
          label: 'Quote Grade',
          isUdf: true,
          field: { key: 'U_QuoteGrade', label: 'Quote Grade', type: 'text' },
        },
      ]}
      rowUdfFields={[{ key: 'U_QuoteGrade', label: 'Quote Grade', type: 'text' }]}
      formSettings={{ matrixColumns: { U_QuoteGrade: { visible: true, active: true } }, rowUdfs: {} }}
      onRowUdfChange={onRowUdfChange}
    />
  );

  expect(screen.getByText('Quote Grade')).toBeInTheDocument();
  fireEvent.change(screen.getByDisplayValue('Premium'), { target: { value: 'Standard' } });
  expect(onRowUdfChange).toHaveBeenCalledWith(0, 'U_QuoteGrade', 'Standard');
});
