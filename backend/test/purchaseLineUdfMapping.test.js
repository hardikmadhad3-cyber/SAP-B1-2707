'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildDocumentLineUdfValues } = require('../services/documentLineUdfPayloadUtils');
const { buildGRPODocumentLine } = require('../services/grpoPayloadUtils');
const { buildAPInvoiceDocumentLine } = require('../services/apInvoicePayloadUtils');

// The spellings a company actually defines on its purchase line tables.
const LINE_UDF_DEFINITIONS = {
  U_GrossWt: { key: 'U_GrossWt', type: 'number' },
  U_TotalPackage: { key: 'U_TotalPackage', type: 'number' },
  U_PackingType: { key: 'U_PackingType', type: 'text' },
};

const udfsOf = (documentLine) => Object.fromEntries(
  Object.entries(documentLine).filter(([key]) => key.startsWith('U_')),
);

test('a live UDF column writing into line.udf reaches the payload', () => {
  assert.deepEqual(
    buildDocumentLineUdfValues(
      { udf: { U_GrossWt: '125.5', U_TotalPackage: '10' } },
      { definitions: LINE_UDF_DEFINITIONS },
    ),
    { U_GrossWt: 125.5, U_TotalPackage: 10 },
  );
});

test('a mapped column writing a camelCase line field reaches the payload', () => {
  // This is the shape that was being dropped: the value is typed into the
  // matrix, stored on the line, and never looked at when building the payload.
  assert.deepEqual(
    buildDocumentLineUdfValues(
      { grossWt: '125.5', totalPackage: '10', packingType: 'BAGS' },
      { definitions: LINE_UDF_DEFINITIONS },
    ),
    { U_GrossWt: 125.5, U_TotalPackage: 10, U_PackingType: 'BAGS' },
  );
});

test('whatever spelling the page sends lands on the column the company defines', () => {
  for (const values of [
    { U_GROSSWT: '125.5' },
    { U_Gross_Wt: '125.5' },
    { U_GrossWeight: '125.5' },
    { U_GrossWt: '125.5' },
  ]) {
    assert.deepEqual(
      buildDocumentLineUdfValues({ udf: values }, { definitions: LINE_UDF_DEFINITIONS }),
      { U_GrossWt: 125.5 },
      JSON.stringify(values),
    );
  }
});

test('one UDF is never sent twice under two spellings', () => {
  const result = buildDocumentLineUdfValues(
    { grossWt: '125.5', udf: { U_GROSSWT: '99', U_Gross_Wt: '77' } },
    { definitions: LINE_UDF_DEFINITIONS },
  );
  assert.deepEqual(result, { U_GrossWt: 125.5 });
});

test('a company UDF with no mapping of its own is still passed through', () => {
  assert.deepEqual(
    buildDocumentLineUdfValues(
      { udf: { U_SomeCompanySpecificField: 'keep me' } },
      { definitions: { U_SomeCompanySpecificField: { key: 'U_SomeCompanySpecificField' } } },
    ),
    { U_SomeCompanySpecificField: 'keep me' },
  );
});

test('a non-numeric gross weight is rejected rather than sent to SAP', () => {
  assert.throws(
    () => buildDocumentLineUdfValues({ grossWt: 'heavy' }, { definitions: LINE_UDF_DEFINITIONS }),
    /Gross Weight must contain a valid numeric value/,
  );
});

test('GRPO carries both column shapes onto the document line', () => {
  const fromLiveColumn = buildGRPODocumentLine(
    { itemNo: 'A', quantity: '1', udf: { U_GrossWt: '125.5', U_TotalPackage: '10' } },
    LINE_UDF_DEFINITIONS,
  );
  const fromMappedColumn = buildGRPODocumentLine(
    { itemNo: 'A', quantity: '1', grossWt: '125.5', totalPackage: '10' },
    LINE_UDF_DEFINITIONS,
  );

  assert.deepEqual(udfsOf(fromLiveColumn), { U_GrossWt: 125.5, U_TotalPackage: 10 });
  assert.deepEqual(udfsOf(fromMappedColumn), udfsOf(fromLiveColumn));
});

test('A/P Invoice carries both column shapes onto the document line', () => {
  const allowed = new Set(['U_GrossWt', 'U_TotalPackage', 'U_PackingType']);
  const fromLiveColumn = buildAPInvoiceDocumentLine(
    { itemNo: 'A', quantity: '1', udf: { U_GrossWt: '125.5' } },
    allowed,
    LINE_UDF_DEFINITIONS,
  );
  const fromMappedColumn = buildAPInvoiceDocumentLine(
    { itemNo: 'A', quantity: '1', grossWt: '125.5' },
    allowed,
    LINE_UDF_DEFINITIONS,
  );

  assert.deepEqual(udfsOf(fromLiveColumn), { U_GrossWt: 125.5 });
  assert.deepEqual(udfsOf(fromMappedColumn), udfsOf(fromLiveColumn));
});

test('A/P Invoice still honours the allowed line UDF list', () => {
  const documentLine = buildAPInvoiceDocumentLine(
    { itemNo: 'A', quantity: '1', grossWt: '125.5', totalPackage: '10' },
    new Set(['U_GrossWt']),
    LINE_UDF_DEFINITIONS,
  );
  assert.deepEqual(udfsOf(documentLine), { U_GrossWt: 125.5 });
});

test('a line with nothing entered sends no UDFs at all', () => {
  assert.deepEqual(buildDocumentLineUdfValues({}, { definitions: LINE_UDF_DEFINITIONS }), {});
  assert.deepEqual(
    buildDocumentLineUdfValues(
      { grossWt: '', totalPackage: null },
      { definitions: LINE_UDF_DEFINITIONS },
    ),
    {},
  );
});

test('a UDF the user cleared is sent as null so SAP clears it too', () => {
  // Long-standing behaviour of normalizeUdfValues: an emptied box has to reach
  // SAP as an explicit null, otherwise the old value would survive the update.
  assert.deepEqual(
    buildDocumentLineUdfValues(
      { udf: { U_PackingType: '   ' } },
      { definitions: LINE_UDF_DEFINITIONS },
    ),
    { U_PackingType: null },
  );
});
