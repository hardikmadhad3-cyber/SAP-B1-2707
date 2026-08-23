import { buildVisibleEnteredRowUdfPayload } from './rowUdfPayload';

test('keeps entered live SAP row UDF values in payload even when saved row settings are stale', () => {
  expect(
    buildVisibleEnteredRowUdfPayload(
      [{ key: 'U_Fix_Brock_S', visible: true, active: true }],
      { U_Fix_Brock_S: '123.45' },
      { rowUdfs: { U_Fix_Brock_S: { visible: false, active: false } } }
    )
  ).toEqual({ U_Fix_Brock_S: '123.45' });
});

test('keeps extra entered SAP row UDF values discovered from live matrix state', () => {
  expect(
    buildVisibleEnteredRowUdfPayload(
      [],
      { U_Fix_Brock_S: '123.45', localNote: 'not a SAP UDF' },
      {}
    )
  ).toEqual({ U_Fix_Brock_S: '123.45' });
});

test('strict live-schema mode omits entered SAP UDFs absent from current definitions', () => {
  expect(
    buildVisibleEnteredRowUdfPayload(
      [{ key: 'U_CurrentCompany', visible: true, active: true }],
      {
        U_CurrentCompany: 'live',
        U_PreviousCompany: 'stale',
        localNote: 'not a SAP UDF',
      },
      {},
      { preserveUnmappedUdfs: false }
    )
  ).toEqual({ U_CurrentCompany: 'live' });
});
