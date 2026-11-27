const assert = require('node:assert/strict');
const Module = require('node:module');
const load = Module._load;
let archived=false, status=3, saves=0, solved=0, used;
const problem={startCode:[{language:'C++'}],visibleTestCases:[{input:'visible',output:'1'}],hiddenTestCases:[{input:'SECRET',output:'2'}]};
Module._load=function(name,...args){
 if(name==='mongoose') return {isObjectIdOrHexString:()=>true};
 if(name==='../models/problem') return {findOne:async()=>archived?null:problem};
 if(name==='../models/submission') return {create:async data=>({...data,save:async()=>{saves++},toObject(){return {status:this.status,errorMessage:this.errorMessage}}})};
 if(name==='../models/user') return {updateOne:async()=>{solved++}};
 if(name==='../utils/ProblemUtility') return {normalizeLanguage:x=>x==='cpp'||x==='C++'?'cpp':undefined,judgeTests:async(c,l,t)=>{used=t;return [{status_id:status,stdout:'SECRET',time:'0.01',memory:100}]}};
 return load.call(this,name,...args);
};
const {runCode,submitCode,customRun}=require('../src/controllers/userSubmission'); Module._load=load;
const req={params:{id:'id'},body:{code:'code',language:'cpp'},result:{_id:'user'}};
const response=()=>({status(n){this.code=n;return this},json(x){this.body=x;return this},send(x){this.body=x;return this}});
(async()=>{let r=response();await runCode(req,r);assert.equal(r.code,200);assert.equal(used,problem.visibleTestCases);assert.equal(saves,0);r=response();await submitCode(req,r);assert.equal(r.code,201);assert.equal(used,problem.hiddenTestCases);assert.equal(solved,1);assert(!JSON.stringify(r.body).includes('SECRET'));for(const [id,verdict] of [[4,'Wrong Answer'],[5,'Time Limit Exceeded'],[6,'Compilation Error'],[7,'Runtime Error']]){status=id;r=response();await submitCode(req,r);assert.equal(r.body.errorMessage,verdict);assert(!JSON.stringify(r.body).includes('SECRET'));} status=3;const beforeSaves=saves,beforeSolved=solved;r=response();await customRun({...req,body:{...req.body,input:"custom"}},r);assert.equal(r.code,200);assert.equal(r.body.custom,true);assert.deepEqual(used,[{input:"custom"}]);assert.equal(saves,beforeSaves);assert.equal(solved,beforeSolved);archived=true;r=response();await submitCode(req,r);assert.equal(r.code,404);console.log('PASS submission mock: run isolation, accepted tracking, four verdicts, hidden output exclusion, archive rejection');})().catch(e=>{console.error(e);process.exitCode=1});
