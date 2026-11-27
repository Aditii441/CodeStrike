const express = require('express');

const authRouter =  express.Router();
const {register, login,logout, adminRegister,deleteProfile} = require('../controllers/userAuthent')
const userMiddleware = require("../middleware/userMiddleware");
const adminMiddleware = require('../middleware/adminMiddleware');

const redis = require('../config/redis');
const authLimit = async (req,res,next) => {
    try {
        const count = await redis.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n", {keys:[`auth-limit:${req.ip}`],arguments:[]});
        if (count > 20) { res.set('Retry-After','60'); return res.status(429).send('Too many authentication requests'); }
        next();
    } catch { res.status(503).send('Authentication unavailable'); }
};
const {getProfile,updateProfile,getRecommendations}=require('../controllers/profile');
authRouter.get('/recommendations',userMiddleware,getRecommendations);
authRouter.get('/profile',userMiddleware,getProfile);
authRouter.patch('/profile',userMiddleware,updateProfile);
// Register
authRouter.post('/register', authLimit, register);
authRouter.post('/login', authLimit, login);
authRouter.post('/logout', userMiddleware, logout);
authRouter.post('/admin/register', adminMiddleware ,adminRegister);
authRouter.delete('/deleteProfile',userMiddleware,deleteProfile);
authRouter.get('/check',userMiddleware,(req,res)=>{

    const reply = {
        firstName: req.result.firstName,
        emailId: req.result.emailId,
        _id:req.result._id,
        role:req.result.role,
    }

    res.status(200).json({
        user:reply,
        message:"Valid User"
    });
})
// authRouter.get('/getProfile',getProfile);


module.exports = authRouter;

// login
// logout
// GetProfile

