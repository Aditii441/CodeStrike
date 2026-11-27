const { randomUUID } = require('node:crypto');
const redisClient = require("../config/redis");
const User =  require("../models/user")
const validate = require('../utils/validator');
const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');
const sameSite = process.env.COOKIE_SAME_SITE || 'lax';
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || sameSite === 'none',
    sameSite
};
const sessionCookieOptions = { ...cookieOptions, maxAge: 60 * 60 * 1000 };


const register = async (req,res)=>{
    
    try{
        // validate the data;

      validate(req.body); 
      const {firstName, emailId, password}  = req.body;

      req.body.password = await bcrypt.hash(password, 10);
      req.body.role = 'user'
    //
    
     const user =  await User.create({
         firstName: firstName.trim(), emailId: emailId.trim().toLowerCase(), password: req.body.password,
         lastName: req.body.lastName?.trim(), age: req.body.age, role: req.body.role
     });
     const token =  jwt.sign({_id:user._id , emailId:emailId, role:'user'},process.env.JWT_KEY,{expiresIn: 60*60, jwtid: randomUUID()});
     const reply = {
        firstName: user.firstName,
        emailId: user.emailId,
        _id: user._id,
        role:user.role,
    }
    
     res.cookie('token',token,sessionCookieOptions);
     res.status(201).json({
        user:reply,
        message:"Loggin Successfully"
    })
    }
    catch(err){
        if (err.code === 11000) return res.status(409).send('Email already registered');
        if (err.name === 'InputValidationError') return res.status(400).send(err.message);
        if (err.name === 'ValidationError' || err.name === 'CastError') return res.status(400).send('Invalid registration details');
        res.status(503).send('Registration unavailable');
    }
}


const login = async (req,res)=>{

    try{
        const {emailId, password} = req.body ?? {};

        if (typeof emailId !== 'string' || !emailId.trim())
            return res.status(401).send("Incorrect email or password");
        if (typeof password !== 'string' || !password || Buffer.byteLength(password, "utf8") > 72)
            return res.status(401).send("Incorrect email or password");

        const user = await User.findOne({emailId: emailId.trim().toLowerCase()});
        if (!user){
            return res.status(401).send("Incorrect email or password");
        }

        const match = await bcrypt.compare(password,user.password);

        if(!match)
            return res.status(401).send("Incorrect email or password");

        const reply = {
            firstName: user.firstName,
            emailId: user.emailId,
            _id: user._id,
            role:user.role,
        }

        const token =  jwt.sign({_id:user._id , emailId:emailId, role:user.role},process.env.JWT_KEY,{expiresIn: 60*60, jwtid: randomUUID()});
        res.cookie('token',token,sessionCookieOptions);
        res.status(201).json({
            user:reply,
            message:"Loggin Successfully"
        })
    }
    catch(err){
        res.status(503).send("Login unavailable");
    }
}


// logOut feature

const logout = async(req,res)=>{

    try{
        const {token} = req.cookies;
        const payload = jwt.verify(token, process.env.JWT_KEY, {algorithms:["HS256"]});


        await redisClient.set(`token:${token}`, 'Blocked', { expiration: { type: 'EXAT', value: payload.exp } });
    //    Token add kar dung Redis ke blockList
    //    Cookies ko clear kar dena.....

    res.clearCookie('token', cookieOptions);
    res.send("Logged Out Succesfully");

    }
    catch(err){
       res.status(503).send("Logout unavailable");
    }
}


const adminRegister = async(req,res)=>{
    try{
        // validate the data;
    //   if(req.result.role!='admin')
    //     return res.status(401).send("Incorrect email or password");  
      validate(req.body); 
      const { firstName, emailId, password } = req.body;
      req.body.role ??= 'admin';
      if (!['admin','user'].includes(req.body.role)) return res.status(400).send('Invalid role');

      req.body.password = await bcrypt.hash(password, 10);
    //
    
     await User.create({
         firstName: firstName.trim(), emailId: emailId.trim().toLowerCase(), password: req.body.password,
         lastName: req.body.lastName?.trim(), age: req.body.age, role: req.body.role
     });
     res.status(201).send("User Registered Successfully");
    }
    catch(err){
        if (err.code === 11000) return res.status(409).send('Email already registered');
        if (err.name === 'InputValidationError') return res.status(400).send(err.message);
        if (err.name === 'ValidationError' || err.name === 'CastError') return res.status(400).send('Invalid registration details');
        res.status(503).send('Registration unavailable');
    }
}

const deleteProfile = async(req,res)=>{
  
    try{
       const userId = req.result._id;
      
    // userSchema delete
    await User.findByIdAndDelete(userId);
    res.clearCookie('token', cookieOptions);

    // Submission se bhi delete karo...
    
    // await Submission.deleteMany({userId});
    
    res.status(200).send("Deleted Successfully");

    }
    catch(err){
      
        res.status(500).send("Internal Server Error");
    }
}

module.exports = {register, login,logout,adminRegister,deleteProfile};