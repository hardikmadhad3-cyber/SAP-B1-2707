import {getDefaultSeriesForCurrentYear,getSapVisibleDocumentSeries,normalizeDocumentSeriesList,pickDocumentSeries,canUseManualSeries} from './seriesDefaults';
test('preserves every eligible series despite names or selected series',()=>{
 const rows=[{Series:1,SeriesName:'1999'},{Series:2,SeriesName:'2026',IsDefault:true}];
 expect(getSapVisibleDocumentSeries(rows,{selectedSeries:'1'})).toEqual(rows);
 expect(getDefaultSeriesForCurrentYear(rows).Series).toBe(2);
});
test('falls back in SAP series-key order, never alphabetically or by fiscal-year labels',()=>{
 expect(getDefaultSeriesForCurrentYear([
  {Series:274,SeriesName:'CAN2627'},
  {Series:273,SeriesName:'JKLC2627'},
  {Series:272,SeriesName:'JKLD2627'},
 ])).toMatchObject({Series:272});
});
test('deduplicates by identity and supports lower-case historical records',()=>{
 expect(normalizeDocumentSeriesList([{series:1},{series:1},{series:2}])).toEqual([{series:1},{series:2}]);
});
test('historical locked series are display-only',()=>{
 const rows=[{Series:1,Locked:'Y',IsLoadedDocumentSeries:true},{Series:2}];
 expect(getSapVisibleDocumentSeries(rows)).toEqual([{Series:2}]);
 expect(getSapVisibleDocumentSeries(rows,{includeHistorical:true})).toEqual(rows);
 expect(pickDocumentSeries(rows,1).Series).toBe(2);
});
test('preserves eligible selection and does not invent a default',()=>{
 const rows=[{Series:1},{Series:2}];
 expect(pickDocumentSeries(rows,'2').Series).toBe(2);
 expect(pickDocumentSeries(rows,'99').Series).toBe(1);
});
test('manual requires explicit server availability, including empty automatic list',()=>{
 expect(canUseManualSeries({series:[]})).toBe(false);
 expect(canUseManualSeries({series:[],manualAllowed:true})).toBe(true);
});
test('explicit posting date honors SAP period bounds over an out-of-period default',()=>{
 const rows=[
  {Series:1,SeriesName:'Older',IsDefault:true,FromDate:'2025-04-01',ToDate:'2026-03-31'},
  {Series:2,SeriesName:'Current',FromDate:'2026-04-01',ToDate:'2027-03-31'},
 ];
 expect(getDefaultSeriesForCurrentYear(rows,new Date('2026-09-17T00:00:00')).Series).toBe(2);
 expect(getDefaultSeriesForCurrentYear(rows,'2027-04-01')).toBeNull();
});
