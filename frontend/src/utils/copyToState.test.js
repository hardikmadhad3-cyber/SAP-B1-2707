import { buildCopyToState } from './copyToState';

describe('buildCopyToState', () => {
  test('rebases a GRPO line to the GRPO instead of its upstream purchase order', () => {
    const state = buildCopyToState({
      sourceDocType: 'grpo',
      sourceLabel: 'Goods Receipt PO',
      sourceDocEntry: 6,
      sourceDocNo: 6,
      baseType: 20,
      header: {},
      lines: [{
        lineNum: 5,
        baseType: 22,
        baseEntry: 3,
        baseLine: 1,
        itemNo: 'ITEM-1',
        openQty: '122',
      }],
    });

    expect(state.copyFrom.lines[0]).toMatchObject({
      previousBaseType: 22,
      previousBaseEntry: 3,
      previousBaseLine: 1,
      baseType: 20,
      baseEntry: 6,
      baseLine: 5,
      openQty: '122',
    });
  });

  test('retains target-supported copy extras such as freight rows', () => {
    const freightCharges = [{ expenseCode: '1', netAmount: '125.00' }];
    const state = buildCopyToState({
      sourceDocType: 'delivery',
      sourceLabel: 'Delivery',
      sourceDocEntry: 15,
      baseType: 15,
      header: {},
      lines: [],
      extraCopyFrom: { freightCharges },
    });

    expect(state.copyFrom.freightCharges).toEqual(freightCharges);
  });
});
