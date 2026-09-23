'use strict';

const isAllSapUsersDefault = (value) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return true;
  const numericUserId = Number(normalized);
  return Number.isFinite(numericUserId) && numericUserId <= 0;
};

const isAllBusinessPartnersDefault = (value) => {
  const normalized = String(value ?? '').trim();
  return !normalized || normalized === '-1';
};

const getRowValue = (row = {}, ...columnNames) => {
  const acceptedNames = new Set(columnNames.map((name) => String(name).toUpperCase()));
  const entry = Object.entries(row || {}).find(([key]) => acceptedNames.has(String(key).toUpperCase()));
  return entry?.[1];
};

const getSapDefaultReportCode = (row = {}) => String(
  getRowValue(row, 'DfltReport') || '',
).trim();

const selectSapDefaultReportRow = ({ rows = [], userId = null, cardCode = '' } = {}) => {
  const normalizedUserId = String(userId ?? '').trim();
  const normalizedCardCode = String(cardCode || '').trim().toUpperCase();

  return (rows || [])
    .map((row, index) => {
      const rowType = String(getRowValue(row, 'TYPE') ?? '').trim().toUpperCase();
      if (rowType && rowType !== 'L') return null;

      const rowUserId = String(getRowValue(row, 'UserId') ?? '').trim();
      const rowCardCode = String(getRowValue(row, 'CardCode') ?? '').trim().toUpperCase();
      const allUsers = isAllSapUsersDefault(rowUserId);
      const allBusinessPartners = isAllBusinessPartnersDefault(rowCardCode);
      const exactUser = Boolean(normalizedUserId) && rowUserId === normalizedUserId;
      const exactBusinessPartner = Boolean(normalizedCardCode)
        && rowCardCode === normalizedCardCode;

      if (!allUsers && !exactUser) return null;
      if (!allBusinessPartners && !exactBusinessPartner) return null;

      // SAP supports defaults for a specific BP, a specific user, or both.
      // The most specific combination wins; a BP-specific assignment takes
      // precedence over a user-wide assignment for that document.
      const score = (exactBusinessPartner ? 20 : 0) + (exactUser ? 10 : 0);
      return { row, score, index };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.row || null;
};

module.exports = {
  getSapDefaultReportCode,
  selectSapDefaultReportRow,
};
