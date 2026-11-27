const assert = require('node:assert/strict');
const Module = require('node:module');
const original = Module._load;
let response, request;
Module._load = function(name,...args){if(name==='axios')return {request:async options=>{request=options;return {data:response}}};return original.call(this,name,...args)};
const u=require('../src/utils/ProblemUtility');Module._load=original;
(async()=>{
for(const [lang,id] of Object.entries({cpp:2,'C++':2,C:1,Java:4,Python:10,python3:10}))assert.equal(u.getLanguageById(lang),id);
assert.equal(u.getLanguageById('javascript'),undefined);
console.log('PASS language mapping (7 assertions)');
response=[{token:'a'},{token:'b'}];await u.submitBatch([{},{}]);assert.equal(request.method,'POST');
response=[{token:'a'},{token:'a'}];await assert.rejects(u.submitBatch([{},{}]));
response={submissions:[{token:'b',status_id:4},{token:'a',status_id:3}]};assert.deepEqual((await u.submitToken(['a','b'])).map(x=>x.status_id),[3,4]);
response={submissions:[{token:'a',status_id:99}]};await assert.rejects(u.submitToken(['a']));
response=[{token:'a'}];await assert.rejects(u.submitBatch([{},{}]));
console.log('PASS batch request, duplicate tokens, ordering, invalid status, incomplete batch');
})().catch(e=>{console.error(e);process.exitCode=1});
