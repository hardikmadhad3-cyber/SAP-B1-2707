import {
  getDefaultSeriesForCurrentYear,
  getSapVisibleDocumentSeries,
  normalizeDocumentSeriesList,
} from './seriesDefaults';

describe('series default helpers', () => {
  test('deduplicates by SAP series code', () => {
    expect(normalizeDocumentSeriesList([
      { Series: 1, SeriesName: 'SO 25-26' },
      { Series: 1, SeriesName: 'Duplicate' },
      { Series: 2, SeriesName: 'SO 26-27' },
    ])).toEqual([
      { Series: 1, SeriesName: 'SO 25-26' },
      { Series: 2, SeriesName: 'SO 26-27' },
    ]);
  });

  test('finds the current financial year series', () => {
    const series = getDefaultSeriesForCurrentYear([
      { Series: 1, SeriesName: 'DCS02324', Indicator: '2023-2024' },
      { Series: 2, SeriesName: 'DCS02425', Indicator: '2024-2025' },
      { Series: 3, SeriesName: 'DCS02526', Indicator: '2025-2026' },
    ], new Date('2026-02-15T00:00:00'));

    expect(series.Series).toBe(3);
  });

  test('shows only the selected SAP series when a noisy list is returned', () => {
    const visible = getSapVisibleDocumentSeries([
      { Series: 10, SeriesName: 'AYPLS021' },
      { Series: 11, SeriesName: 'DCS023' },
      { Series: 12, SeriesName: 'DCS02324' },
      { Series: 13, SeriesName: 'EXS02526' },
    ], { selectedSeries: '10', postingDate: '2026-08-11' });

    expect(visible).toEqual([{ Series: 10, SeriesName: 'AYPLS021' }]);
  });

  test('supports lowercase service document series objects', () => {
    const visible = getSapVisibleDocumentSeries([
      { series: '1', seriesName: 'GST21-22' },
      { series: '2', seriesName: 'AYDC2223' },
      { series: '3', seriesName: 'AYDC2324' },
    ], { selectedSeries: 'manual', postingDate: '11-08-2026' });

    expect(visible).toEqual([{ series: '1', seriesName: 'GST21-22' }]);
  });

  test('keeps all SAP series in the preferred financial-year indicator', () => {
    const visible = getSapVisibleDocumentSeries([
      { Series: 256, SeriesName: 'EXSO2425', Indicator: 'FY2024-25' },
      { Series: 257, SeriesName: 'DCSO2425', Indicator: 'FY2024-25' },
      { Series: 328, SeriesName: 'EXSO2526', Indicator: 'FY2025-26', IsDefault: true },
      { Series: 329, SeriesName: 'DCSO2526', Indicator: 'FY2025-26' },
    ], { selectedSeries: '328', postingDate: '2026-08-12' });

    expect(visible.map((series) => series.Series)).toEqual([328, 329]);
  });
});
