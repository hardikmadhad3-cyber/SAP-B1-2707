'use strict';
const { resolveMarketingDocumentSeries } = require('./documentSeriesDbUtils');
// Number previews use exactly the same company/user/date/subtype eligibility as
// the selector. NNM1.NextNumber is a preview; only SAP allocates a final number.
const getDocumentSeriesNumberPreview = async (options, resolve = resolveMarketingDocumentSeries) => {
  const result = await resolve(options);
  const selected = result.series.find(row => String(row.Series) === String(options.seriesId));
  if (!selected) throw Object.assign(new Error(result.reason || 'The selected series is not eligible in the current SAP context.'), {statusCode:400,code:'SAP_DOCUMENT_SERIES'});
  return { nextNumber: selected.NextNumber };
};
module.exports = { getDocumentSeriesNumberPreview };
