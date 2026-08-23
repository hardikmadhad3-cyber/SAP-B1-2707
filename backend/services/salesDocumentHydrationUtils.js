'use strict';

const formatSapDate = (value) => {
  if (!value) return '';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().split('T')[0];
  }
  return String(value).trim().split('T')[0];
};

const buildLineDeliveryDateFields = (line = {}) => {
  const lineDeliveryDate = formatSapDate(
    line.ShipDate ?? line.shipDate ?? line.lineDeliveryDate,
  );
  return {
    lineDeliveryDate,
    ShipDate: lineDeliveryDate,
  };
};

module.exports = {
  buildLineDeliveryDateFields,
  formatSapDate,
};
