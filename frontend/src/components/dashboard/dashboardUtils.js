export const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatCompactNumber = (value, maximumFractionDigits = 2) => {
  const amount = toFiniteNumber(value);
  try {
    return new Intl.NumberFormat('en-IN', {
      notation: 'compact',
      maximumFractionDigits,
    }).format(amount);
  } catch (_error) {
    return amount.toFixed(maximumFractionDigits);
  }
};

export const formatAmount = (value, maximumFractionDigits = 0) => {
  const amount = toFiniteNumber(value);
  try {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits,
    }).format(amount);
  } catch (_error) {
    return amount.toFixed(maximumFractionDigits);
  }
};

export const formatPercent = (value) => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'No comparison';
  const amount = Number(value);
  return `${amount > 0 ? '+' : ''}${amount.toFixed(1)}%`;
};

export const getTrendTone = (value) => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'neutral';
  if (Number(value) > 0.0001) return 'positive';
  if (Number(value) < -0.0001) return 'negative';
  return 'neutral';
};

export const formatDashboardDate = (value) => {
  if (!value) return '';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const getChartDomain = (values = []) => {
  const normalized = values.map(toFiniteNumber);
  const min = Math.min(0, ...normalized);
  const max = Math.max(0, ...normalized);
  if (min === max) return { min: 0, max: 1 };
  return { min, max };
};
