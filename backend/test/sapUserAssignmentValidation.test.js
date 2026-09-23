'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSapUserAssignment } = require('../services/sapUserAssignmentValidation');
const { getRequestContext, runWithRequestContext, setCompanyContextOverride } = require('../services/requestContextService');
const dependencies = (users = [{USER_CODE:'alex',Locked:'N'}]) => ({
 db: {}, registry: {queryOne:async(sql,params)=>({CompanyId:params.companyId,DbName:'Company'+params.companyId})},
 reader:async()=>({read:async(table,columns,where)=>{
  assert.equal(table,'OUSR');assert.deepEqual(where,{USER_CODE:'alex'});
  return users;
 }})
});
test('rejects assignments when neither override nor company SAP username is configured',async()=>{
 await assert.rejects(validateSapUserAssignment({CompanyId:1,SapUserCode:' '},dependencies()),/Configure a SAP username/);
});
test('validates and trims SAP login against the selected company',async()=>{
 assert.equal(await validateSapUserAssignment({CompanyId:2,SapUserCode:' alex '},dependencies()),'alex');
 for(const rows of [[],[{USER_CODE:'alex',Locked:'Y'}]]){
  await assert.rejects(validateSapUserAssignment({CompanyId:2,SapUserCode:'alex'},dependencies(rows)),/does not exist|locked/);
 }
});
test('database errors stay errors, never successful assignments',async()=>{
 const deps=dependencies();deps.reader=async()=>{throw Error('SAP unavailable');};
 await assert.rejects(validateSapUserAssignment({CompanyId:2,SapUserCode:'alex'},deps),/SAP unavailable/);
});
test('parallel company checks remain isolated and restore the caller context',async()=>{
 await runWithRequestContext({},async()=>{
  setCompanyContextOverride({CompanyId:99});
  await Promise.all([1,2].map(companyId=>{
   const deps=dependencies();deps.reader=async()=>({read:async()=>{
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(getRequestContext().companyOverride.CompanyId,companyId);
    return [{USER_CODE:'alex',Locked:'N'}];
   }});
   return validateSapUserAssignment({CompanyId:companyId,SapUserCode:'alex'},deps);
  }));
  assert.equal(getRequestContext().companyOverride.CompanyId,99);
 });
});

test('blank override validates company SAP username without persisting a separate mapping',async()=>{
 const deps=dependencies();deps.registry.queryOne=async()=>({CompanyId:2,DbName:'Company2',SapUsername:'alex'});
 assert.equal(await validateSapUserAssignment({CompanyId:2,SapUserCode:''},deps),null);
});
