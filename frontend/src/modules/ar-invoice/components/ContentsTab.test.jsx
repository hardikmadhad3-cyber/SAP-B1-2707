import React from 'react';
import { render, screen } from '@testing-library/react';
import ContentsTab from './ContentsTab';

describe('ContentsTab dynamic UDF columns', () => {
  test('renders a UDF column from rowUdfFields when provided', () => {
    const lines = [
      {
        itemNo: 'ITEM1',
        udf: { U_PackingType: 'Box' },
      },
    ];

    const rowUdfFields = [
      { key: 'U_PackingType', label: 'Packing Type', type: 'text' },
    ];

    const noop = () => {};

    render(
      <ContentsTab
        lines={lines}
        onLineChange={noop}
        onNumBlur={noop}
        lineItemOptions={[]}
        onAddLine={noop}
        onRemoveLine={noop}
        onOpenHSNModal={noop}
        onOpenItemModal={noop}
        onOpenLineLookup={noop}
        getUomOptions={() => []}
        effectiveTaxCodes={[]}
        effectiveWarehouses={[]}
        getBranchName={() => ''}
        valErrors={{ lines: [{}] }}
        isEditable={true}
        formSettings={{ rowUdfs: { U_PackingType: { visible: true } }, matrixColumns: {} }}
        matrixFields={[]}
        rowUdfFields={rowUdfFields}
        onRowUdfChange={noop}
      />,
    );

    // The live schema label and the UDF-backed value are both rendered.
    expect(screen.getByText('Packing Type')).toBeInTheDocument();
    // cell value should render in first row
    expect(screen.getByDisplayValue('Box')).toBeInTheDocument();
  });
});
