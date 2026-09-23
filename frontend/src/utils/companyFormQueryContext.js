export const buildCompanyFormQueryContext = (docEntry, header = {}) => ({
  docEntry: docEntry || header.docEntry || header.DocEntry || null,
  cardCode:
    header.cardCode
    || header.CardCode
    || header.customerCode
    || header.vendorCode
    || header.buyerCode
    || header.supplierCode
    || null,
  postingDate:
    header.postingDate
    || header.documentDate
    || header.docDate
    || header.DocDate
    || null,
  branchId:
    header.branchId
    ?? header.bplId
    ?? header.BPLId
    ?? header.branchCode
    ?? null,
});
