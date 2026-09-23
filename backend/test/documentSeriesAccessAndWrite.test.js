'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const {loadDocumentSeriesAccess}=require('../services/documentSeriesAccess');
const {readSeriesPermissions}=require('../services/sapSeriesPermissions');
const {validateMarketingSeriesWrite,endpoints}=require('../services/documentSeriesWriteValidation');
test('missing company configuration never borrows an environment account',async()=>{
 for(const config of [
  {serviceLayer:{username:'manager'}},
  {userMapping:{sapUserCode:'  '},serviceLayer:{username:'manager'}},
  {sap:{userName:'manager'}},
 ]){
  await assert.rejects(loadDocumentSeriesAccess({configLoader:async()=>config,
   read:async()=>{assert.fail('must not query a fallback user');}}),
   e=>e.statusCode===422&&e.code==='SAP_SERIES_USER_CONFIGURATION');
 }
});
test('uses selected company SAP account and its actual permissions when override is absent',async()=>{
 const result=await loadDocumentSeriesAccess({configLoader:async()=>({userMapping:{companySapUserCode:'company-user'}}),
 read:async(table,columns,where)=>{assert.deepEqual(where,{USER_CODE:'company-user'});return [{USER_CODE:'company-user',USERID:7,SUPERUSER:'N'}];},
 permissionReader:async()=>({manualAllowed:false,groups:new Set([2])})});
 assert.equal(result.userId,7);assert.equal(result.manualAllowed,false);assert.equal(await result.canUseGroup(1),false);
});
test('configured company user must exist and be unlocked',async()=>{
 for(const rows of [[],[{USER_CODE:'manager',Locked:'Y'}]]){
  await assert.rejects(loadDocumentSeriesAccess({configLoader:async()=>({userMapping:{companySapUserCode:'manager'}}),read:async()=>rows}),/does not exist or is locked/);
 }
});
test('mapped user must exist and be unlocked in selected company',async()=>{
 for(const rows of [[],[{USER_CODE:'alex',USERID:2,SUPERUSER:'N',Locked:'Y'}]]){
  await assert.rejects(loadDocumentSeriesAccess({configLoader:async()=>({userMapping:{sapUserCode:'alex'}}),read:async()=>rows}),/does not exist or is locked/);
 }
});
test('superuser uses mapped SAP identity and needs no permission catalogue',async()=>{
 const result=await loadDocumentSeriesAccess({configLoader:async()=>({userMapping:{sapUserCode:'manager'}}),
 read:async(table,columns,where)=>{assert.deepEqual(where,{USER_CODE:'manager'});return [{USER_CODE:'manager',USERID:1,SUPERUSER:'Y'}];}});
 assert.equal(result.userId,1);assert.equal(result.manualAllowed,true);assert.equal(await result.canUseGroup(30),true);
});
test('effective rights combine direct and active group grants, excluding expired groups',async()=>{
 const tables={USR3:[{PermId:'manual-test',Permission:'N'},{PermId:'group1-test',Permission:'F'}],
 USR7:[{GroupId:1},{GroupId:2,DueDate:'2025-01-01'}],OUGR:[{GroupId:1},{GroupId:2}]};
 const permissions=await readSeriesPermissions({user:{USERID:2},now:'2026-02-15',
 catalogue:{manual:'manual-test',groups:{1:'group1-test',2:'group2-test',3:'expired-test'}},
 read:async(table,columns,where)=>table==='UGR1'?(where.GroupLink===1?[{PermId:'manual-test',Permission:'F'},{PermId:'group2-test',Permission:'F'}]:[{PermId:'expired-test',Permission:'F'}]):tables[table]});
 assert.equal(permissions.manualAllowed,true);assert.deepEqual([...permissions.groups],[1,2]);
});
test('non-superuser results use request-specific rights',async()=>{
 const result=await loadDocumentSeriesAccess({configLoader:async()=>({userMapping:{sapUserCode:'alex',companySapUserCode:'manager'},serviceLayer:{username:'manager'}}),
 read:async()=>[{USER_CODE:'alex',USERID:2,SUPERUSER:'N'}],
 permissionReader:async()=>({manualAllowed:false,groups:new Set([2])})});
 assert.equal(await result.canUseGroup(1),false);assert.equal(await result.canUseGroup(2),true);
});
const options=(result,inspect=()=>{})=>({db:{},resolve:async context=>{inspect(context);return result;}});
test('automatic document creation revalidates selected series and removes number preview',async()=>{
 for(const [endpoint,objectCode]of Object.entries(endpoints)){
  const config={method:'POST',url:endpoint,data:{Series:127,DocNum:335,DocDate:'2026-02-15'}};
  await validateMarketingSeriesWrite(config,options({series:[{Series:127}],docSubType:'--'},ctx=>{assert.equal(ctx.objectCode,objectCode);assert.equal(ctx.purpose,'posting');}));
  assert.equal(config.data.Series,127);assert.equal('DocNum'in config.data,false);
 }
});
test('stale series are rejected without silently choosing another default',async()=>{
 await assert.rejects(validateMarketingSeriesWrite({method:'POST',url:'Orders',data:{Series:97}},options({series:[{Series:127}],defaultSeries:127})),/eligible numbering series/);
});
test('manual requires permission and a positive integer; automatic cannot be handwritten',async()=>{
 const manual=n=>({method:'POST',url:'Invoices',data:{Series:-1,DocNum:n}});
 await assert.rejects(validateMarketingSeriesWrite(manual(1),options({manualAllowed:false})),/manual document numbering/);
 for(const n of [0,-1,'1.5','abc',undefined])await assert.rejects(validateMarketingSeriesWrite(manual(n),options({manualAllowed:true})),/positive integer/);
 const config=manual(400);await validateMarketingSeriesWrite(config,options({manualAllowed:true}));assert.equal(config.data.HandWritten,'tYES');assert.equal(config.data.DocNum,400);
 await assert.rejects(validateMarketingSeriesWrite({method:'POST',url:'Orders',data:{Series:1,HandWritten:'tYES'}},options({series:[{Series:1}]})),/handwritten/);
});
test('manual and automatic India payloads use the resolved native GST type',async()=>{
 for(const manual of [true,false]){
  const config={method:'POST',url:'Invoices',data:{Series:manual?-1:1,DocNum:40}};
  await validateMarketingSeriesWrite(config,options({manualAllowed:true,series:[{Series:1}],country:'IN',docSubType:'--'}));
  assert.equal(config.data.GSTTransactionType,'gsttrantyp_BillOfSupply');
 }
});
test('updates and cancellation actions retain historical identity without new-series lookup',async()=>{
 for(const config of [{method:'PATCH',url:'Orders(1)'},{method:'POST',url:'Orders(1)/Cancel'},{method:'GET',url:'Orders'}]){
  await validateMarketingSeriesWrite(config,{resolve:async()=>{throw Error('unexpected creation lookup');}});
 }
});

test('next-number preview validates the same context and returns only SAP configured next number',async()=>{
 const {getDocumentSeriesNumberPreview}=require('../services/documentSeriesNumberPreview');
 const context={objectCode:'17',seriesId:'127',targetDate:'2026-02-15',branch:2};
 const result=await getDocumentSeriesNumberPreview(context,async options=>{assert.equal(options,context);return {series:[{Series:127,NextNumber:335}]};});
 assert.deepEqual(result,{nextNumber:335});
 await assert.rejects(getDocumentSeriesNumberPreview({...context,seriesId:'97'},async()=>({series:[]})),/not eligible/);
});
