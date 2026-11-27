const assert = require('node:assert/strict');
const Module = require('node:module');
const original = Module._load;
let request, failure;
Module._load = function(name,...args) {
    if(name==='@google/genai') return {GoogleGenAI:class {models={generateContent:async input=>{request=input;if(failure)throw failure;return {text:'Try a hash map.'}}}}};
    if(name==='mongoose') return {isObjectIdOrHexString:()=>true};
    if(name==='../config/redis') return {eval:async()=>1};
    if(name==='../models/problem') return {findOne:()=>({select:()=>({lean:async()=>({title:'Two Sum',hiddenTestCases:[{input:'SECRET'}]})})})};
    return original.call(this,name,...args);
};
const solve = require('../src/controllers/solveDoubt');Module._load=original;
process.env.GEMINI_KEY='mock';process.env.GEMINI_MODEL='models/mock';
const req={result:{_id:'user'},body:{problemId:'id',messages:[{role:'user',parts:[{text:'Hint'}]}],code:'my code',execution:'wrong answer'}};
const res={statusCode:200,status(n){this.statusCode=n;return this},json(data){this.data=data;return this},set(){}};
(async()=>{await solve(req,res);assert.equal(res.data.message,'Try a hash map.');assert.equal(request.model,'mock');assert.match(request.config.systemInstruction,/wrong answer/);assert.doesNotMatch(request.config.systemInstruction,/SECRET/);failure={status:404,name:'Error'};await solve(req,res);assert.equal(res.statusCode,502);assert.match(res.data.message,/ai:check/);req.body.messages.push(req.body.messages[0]);await solve(req,res);assert.equal(res.statusCode,400);console.log('PASS AI mock: context, hidden test exclusion, model normalization, provider error, role validation');})().catch(e=>{console.error(e);process.exitCode=1});
