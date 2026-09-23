import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import useDocumentTableClipboard from './useDocumentTableClipboard';

function Harness({ onPaste = jest.fn(), canPaste = true }) {
  const { tableClipboardProps, tableClipboardUi } = useDocumentTableClipboard({
    columns: [
      { key: 'itemNo', label: 'Item No.' },
      { key: 'quantity', label: 'Quantity' },
    ],
    rows: [{ itemNo: 'A-1', quantity: '2' }],
    columnOffset: 1,
    canPaste,
    onPaste,
  });

  return (
    <>
      <table {...tableClipboardProps}>
        <tbody>
          <tr>
            <td>1</td>
            <td><input aria-label="Item No." defaultValue="A-1" /></td>
            <td><input aria-label="Quantity" defaultValue="2" /></td>
          </tr>
        </tbody>
      </table>
      {tableClipboardUi}
    </>
  );
}

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: jest.fn().mockResolvedValue(undefined),
      readText: jest.fn().mockResolvedValue('Item No.\tQuantity\r\nA-2\t3'),
    },
  });
});

test('copies the whole visible table from the cell context menu', async () => {
  render(<Harness />);
  fireEvent.contextMenu(screen.getByLabelText('Item No.'), { clientX: 20, clientY: 30 });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Copy Table' }));

  await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
    'Item No.\tQuantity\r\nA-1\t2',
  ));
});

test('automatically detects headers and pastes without asking', () => {
  const onPaste = jest.fn();
  render(<Harness onPaste={onPaste} />);
  fireEvent.paste(screen.getByLabelText('Item No.'), {
    clipboardData: { getData: () => 'Quantity\tItem No.\r\n4\tA-4' },
  });

  expect(onPaste).toHaveBeenCalledWith({
    startRowIndex: 0,
    patches: [{
      rowOffset: 0,
      cells: [
        { key: 'quantity', value: '4', isUdf: false },
        { key: 'itemNo', value: 'A-4', isUdf: false },
      ],
    }],
  });
  expect(screen.queryByText('Does the selected content include header information?')).not.toBeInTheDocument();
});

test('clicking Paste reads the clipboard and applies it immediately', async () => {
  const onPaste = jest.fn();
  render(<Harness onPaste={onPaste} />);
  fireEvent.contextMenu(screen.getByLabelText('Item No.'));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Paste' }));

  await waitFor(() => expect(onPaste).toHaveBeenCalledWith({
    startRowIndex: 0,
    patches: [{
      rowOffset: 0,
      cells: [
        { key: 'itemNo', value: 'A-2', isUdf: false },
        { key: 'quantity', value: '3', isUdf: false },
      ],
    }],
  }));
  expect(screen.queryByText('Does the selected content include header information?')).not.toBeInTheDocument();
});

test('keeps Paste disabled for read-only documents while Copy Table remains available', () => {
  render(<Harness canPaste={false} />);
  fireEvent.contextMenu(screen.getByLabelText('Item No.'));
  expect(screen.getByRole('menuitem', { name: 'Copy Table' })).toBeEnabled();
  expect(screen.getByRole('menuitem', { name: 'Paste' })).toBeDisabled();
});
