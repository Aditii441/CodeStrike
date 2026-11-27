const express = require('express');
const submitRouter = express.Router();
const userMiddleware = require('../middleware/userMiddleware');
const { submitCode, runCode, customRun } = require('../controllers/userSubmission');
const redis = require('../config/redis');

// Bound execution requests per user to protect the shared Judge0 service.
async function executionLimit(req, res, next) {
    try {
        const count = await redis.eval(
            "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
            { keys: [`execution-limit:${req.result._id}`], arguments: [] }
        );
        if (count > 20) {
            res.set('Retry-After', '60');
            return res.status(429).send('Execution limit reached. Try again in a minute.');
        }
        next();
    } catch {
        return res.status(503).send('Execution temporarily unavailable');
    }
}

submitRouter.post('/submit/:id', userMiddleware, executionLimit, submitCode);
submitRouter.post('/run/:id', userMiddleware, executionLimit, runCode);
submitRouter.post('/custom/:id', userMiddleware, executionLimit, customRun);
module.exports = submitRouter;
