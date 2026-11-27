const router = require('express').Router();
const userMiddleware = require('../middleware/userMiddleware');
const solveDoubt = require('../controllers/solveDoubt');

router.post('/chat', userMiddleware, solveDoubt);

module.exports = router;
