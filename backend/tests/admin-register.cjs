const assert = require('node:assert/strict');
const Module = require('node:module');
const load = Module._load;
let created;
Module._load = function(name,...args) {
    if(name==='../config/redis') return {};
    if(name==='../models/user') return {create:async data=>{created=data;return {_id:'new',...data}}};
    if(name==='../utils/validator') return ()=>{};
    if(name==='bcrypt') return {hash:async()=> 'hashed'};
    if(name==='jsonwebtoken') return {sign(){throw Error('Admin registration must not sign a token')}};
    return load.call(this,name,...args);
};
const {adminRegister}=require('../src/controllers/userAuthent');
Module._load=load;
(async()=>{
 const req={body:{firstName:'Test',emailId:'test@example.com',password:'Example123!',role:'user'}};
 const res={status(n){this.code=n;return this},send(message){this.message=message},cookie(){throw Error('Admin cookie must not change')}};
 await adminRegister(req,res);
 assert.equal(res.code,201);assert.equal(created.password,'hashed');assert.equal(created.role,'user');
 console.log('PASS admin registration preserves current session');
})().catch(e=>{console.error(e);process.exitCode=1});
