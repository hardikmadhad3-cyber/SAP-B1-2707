import {
  formatCompactNumber,
  formatPercent,
  getChartDomain,
  getTrendTone,
} from './dashboardUtils';

test('formats compact dashboard values and trend percentages', () => {
  expect(formatCompactNumber(66220000)).toMatch(/66\.22|6\.62/);
  expect(formatPercent(12.345)).toBe('+12.3%');
  expect(formatPercent(null)).toBe('No comparison');
});

test('assigns positive, negative, and neutral trend tones', () => {
  expect(getTrendTone(1)).toBe('positive');
  expect(getTrendTone(-1)).toBe('negative');
  expect(getTrendTone(0)).toBe('neutral');
});

test('creates a chart domain that includes zero and negative values', () => {
  expect(getChartDomain([10, -5, 2])).toEqual({ min: -5, max: 10 });
  expect(getChartDomain([0, 0])).toEqual({ min: 0, max: 1 });
});
