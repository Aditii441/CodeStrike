const router = require('express').Router();
const adminMiddleware = require('../middleware/adminMiddleware');
const { generateUploadSignature, saveVideoMetadata, deleteVideo } = require('../controllers/videoSection');

router.get('/create/:problemId', adminMiddleware, generateUploadSignature);
router.post('/save', adminMiddleware, saveVideoMetadata);
router.delete('/delete/:problemId', adminMiddleware, deleteVideo);

module.exports = router;
