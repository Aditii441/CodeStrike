const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/user');
const redisClient = require('../config/redis');
const userMiddleware = async (req,res,next) => {
    try {
        const {token} = req.cookies || {};
        if (typeof token !== 'string' || !token) return res.status(401).send('Token is not present');
        const payload = jwt.verify(token, process.env.JWT_KEY, {algorithms:['HS256']});
        if (!mongoose.isObjectIdOrHexString(payload._id)) return res.status(401).send('Invalid Token');
        const result = await User.findById(payload._id).select('-password');
        if (!result || await redisClient.exists(`token:${token}`)) return res.status(401).send('Invalid Token');
        
        req.result = result;
        next();
    } catch (err) {
        if (['TokenExpiredError','JsonWebTokenError','NotBeforeError'].includes(err.name)) return res.status(401).send('Invalid Token');
        return res.status(503).send('Authentication service unavailable');
    }
};
module.exports = userMiddleware;
