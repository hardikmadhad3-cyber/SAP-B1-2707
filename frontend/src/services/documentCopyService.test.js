import { getCopyableSourceLines, getCopyToTarget, getCopyToTargets } from './documentCopyService';

test('Purchase Request copies only to SAP-supported purchasing targets', () => {
  expect(getCopyToTargets('purchaseRequest')).toEqual([
    expect.objectContaining({ key: 'purchaseQuotation', targetPath: '/purchase-quotation' }),
    expect.objectContaining({ key: 'purchaseOrder', targetPath: '/purchase-order' }),
  ]);
});

test('Purchase Order copies to both a Goods Receipt PO and an A/P Invoice', () => {
  // Aliased targets are de-duplicated down to their camelCase key.
  expect(getCopyToTargets('purchaseOrder')).toEqual([
    expect.objectContaining({ key: 'grpo', targetDocType: 'grpo', targetPath: '/grpo' }),
    expect.objectContaining({ key: 'apInvoice', targetDocType: 'apInvoice', targetPath: '/ap-invoice' }),
  ]);
});

test('either Purchase Order A/P Invoice alias resolves to the same target', () => {
  // The toolbar passes the hyphenated key, matching the other document pages.
  for (const key of ['ap-invoice', 'apInvoice']) {
    expect(getCopyToTarget('purchaseOrder', key)).toEqual(
      expect.objectContaining({ targetDocType: 'apInvoice', targetPath: '/ap-invoice' }),
    );
  }
});

describe('getCopyableSourceLines', () => {
  test('keeps only GRPO rows with remaining open quantity', () => {
    const lines = getCopyableSourceLines('grpo', [
      { lineNum: 0, lineStatus: 'Closed', openQty: '0', quantity: '122' },
      { lineNum: 1, lineStatus: 'Open', openQty: '4', quantity: '10' },
      { lineNum: 2, lineStatus: 'O', openQty: '0', quantity: '3' },
    ]);

    expect(lines).toEqual([
      { lineNum: 1, lineStatus: 'Open', openQty: '4', quantity: '10' },
    ]);
  });

  test('keeps only Purchase Order rows with remaining open quantity', () => {
    const lines = getCopyableSourceLines('purchaseOrder', [
      { lineNum: 0, lineStatus: 'C', openQty: '0', quantity: '15480' },
      { lineNum: 1, lineStatus: 'O', openQty: '15480', quantity: '15480' },
      { lineNum: 2, lineStatus: 'O', openQty: '0', quantity: '20' },
    ]);

    expect(lines).toEqual([
      { lineNum: 1, lineStatus: 'O', openQty: '15480', quantity: '15480' },
    ]);
  });

  test('does not filter unrelated document types', () => {
    const lines = [{ lineStatus: 'Closed', openQty: '0' }];
    expect(getCopyableSourceLines('apInvoice', lines)).toBe(lines);
  });
});
