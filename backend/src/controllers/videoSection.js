const { randomUUID } = require('node:crypto');
const { isObjectIdOrHexString } = require('mongoose');
const cloudinary = require('cloudinary').v2;
const redis = require('../config/redis');
const Problem = require('../models/problem');
const SolutionVideo = require('../models/solutionVideo');

const providerTimeout = 10000;
let indexesReady;

async function withProviderTimeout(request) {
    let timer;
    try {
        return await Promise.race([
            request,
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('Cloudinary timed out')), providerTimeout);
            })
        ]);
    } finally {
        clearTimeout(timer);
    }
}

function videoError(res, status, message) {
    return res.status(status).json({ error: message, message });
}

async function prepareVideo(res) {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (![CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET].every(value => value?.trim())) {
        videoError(res, 503, 'Video editorials are not configured');
        return false;
    }

    cloudinary.config({
        cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY,
        api_secret: CLOUDINARY_API_SECRET, secure: true
    });

    try {
        indexesReady ??= SolutionVideo.createIndexes();
        await indexesReady;
        return true;
    } catch {
        indexesReady = undefined;
        videoError(res, 503, 'Video indexes are unavailable. Check database setup and existing video records.');
        return false;
    }
}

function savedVideo(res, video, status = 201) {
    return res.status(status).json({
        message: 'Video solution saved successfully',
        videoSolution: {
            id: video._id, thumbnailUrl: video.thumbnailUrl,
            duration: video.duration, uploadedAt: video.createdAt
        }
    });
}

async function generateUploadSignature(req, res) {
    const { problemId } = req.params;
    if (!isObjectIdOrHexString(problemId)) return videoError(res, 400, 'Invalid problem ID');
    if (!await prepareVideo(res)) return;

    try {
        if (!await Problem.exists({ _id: problemId, archivedAt: null })) {
            return videoError(res, 404, 'Problem not found');
        }
        if (await SolutionVideo.exists({ problemId, retiredAt: null })) {
            return videoError(res, 409, 'Delete the existing video before uploading another');
        }

        const publicId = `codestrike-solutions/${problemId.toLowerCase()}/${req.result._id}/${randomUUID()}`;
        const timestamp = Math.floor(Date.now() / 1000);
        const { api_key, api_secret, cloud_name } = cloudinary.config();
        const signature = cloudinary.utils.api_sign_request({ timestamp, public_id: publicId, overwrite: false }, api_secret);
        await redis.set(`video-upload:${publicId}`, 'issued', { expiration: { type: 'EX', value: 3600 } });

        res.set('Cache-Control', 'no-store');
        return res.json({
            signature, timestamp, public_id: publicId, overwrite: false, api_key, cloud_name,
            upload_url: `https://api.cloudinary.com/v1_1/${cloud_name}/video/upload`
        });
    } catch {
        return videoError(res, 503, 'Unable to prepare the video upload');
    }
}

async function saveVideoMetadata(req, res) {
    const { problemId, cloudinaryPublicId } = req.body ?? {};
    if (!isObjectIdOrHexString(problemId) || typeof cloudinaryPublicId !== 'string') {
        return videoError(res, 400, 'A valid problem ID and Cloudinary public ID are required');
    }

    const userId = req.result._id;
    const prefix = `codestrike-solutions/${problemId.toLowerCase()}/${userId}/`;
    if (!cloudinaryPublicId.startsWith(prefix) ||
        !/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/.test(cloudinaryPublicId.slice(prefix.length))) {
        return videoError(res, 400, 'The upload does not match this problem and uploader');
    }
    if (!await prepareVideo(res)) return;

    try {
        const activeProblem = { _id: problemId, archivedAt: null };
        if (!await Problem.exists(activeProblem)) return videoError(res, 404, 'Problem not found');

        const current = await SolutionVideo.findOne({ problemId, retiredAt: null });
        if (current) {
            if (current.cloudinaryPublicId === cloudinaryPublicId && String(current.userId) === String(userId)) {
                return savedVideo(res, current, 200);
            }
            return videoError(res, 409, 'A video is already registered for this problem');
        }
        if (!await redis.exists(`video-upload:${cloudinaryPublicId}`)) {
            return videoError(res, 400, 'Upload signature expired or was never issued');
        }

        let resource;
        try {
            resource = await withProviderTimeout(cloudinary.api.resource(cloudinaryPublicId, {
                resource_type: 'video', timeout: providerTimeout
            }));
        } catch (error) {
            if (error.http_code === 404) return videoError(res, 404, 'Uploaded video not found');
            return videoError(res, 502, 'Unable to verify the uploaded video');
        }

        if (resource?.public_id !== cloudinaryPublicId || resource.resource_type !== 'video' ||
            resource.type !== 'upload' || typeof resource.secure_url !== 'string' ||
            !/^https:\/\//.test(resource.secure_url) ||
            !Number.isFinite(resource.duration) || resource.duration <= 0) {
            return videoError(res, 422, 'Cloudinary did not return valid video metadata');
        }

        if (!Number.isSafeInteger(resource.bytes) || resource.bytes <= 0 || resource.bytes > 104857600 || !['mp4','webm','mov'].includes(String(resource.format).toLowerCase())) return videoError(res, 422, 'Invalid video size or format');
        if (!await Problem.exists(activeProblem)) return videoError(res, 404, 'Problem not found');

        const thumbnailUrl = cloudinary.url(cloudinaryPublicId, {
            secure: true, resource_type: 'video', type: 'upload', format: 'jpg',
            version: resource.version, start_offset: 'auto'
        });
        const video = await SolutionVideo.create({
            problemId, userId, cloudinaryPublicId, secureUrl: resource.secure_url,
            thumbnailUrl, duration: resource.duration
        });
        try { await redis.del(`video-upload:${cloudinaryPublicId}`); } catch {}
        return savedVideo(res, video);
    } catch (error) {
        if (error.code === 11000) {
            const existing = await SolutionVideo.findOne({problemId, cloudinaryPublicId, userId, retiredAt:null}).catch(() => null);
            if (existing) return savedVideo(res, existing, 200);
            return videoError(res, 409, 'A video is already registered for this problem');
        }
        return videoError(res, 503, 'Unable to save video metadata');
    }
}

async function deleteVideo(req, res) {
    const { problemId } = req.params;
    if (!isObjectIdOrHexString(problemId)) return videoError(res, 400, 'Invalid problem ID');
    if (!await prepareVideo(res)) return;

    try {
        const video = await SolutionVideo.findOne({ problemId, retiredAt: null });
        if (!video) return videoError(res, 404, 'Video not found');
        if (video) {
            try {
                const result = await withProviderTimeout(cloudinary.uploader.destroy(video.cloudinaryPublicId, {
                    resource_type: 'video', invalidate: true, timeout: providerTimeout
                }));
                if (!['ok', 'not found'].includes(result?.result)) {
                    return videoError(res, 502, 'Cloudinary did not confirm video removal');
                }
            } catch (error) {
                if (error.http_code !== 404) return videoError(res, 502, 'Unable to remove the Cloudinary video');
            }
            await SolutionVideo.deleteOne({ _id: video._id });
        }

        return res.json({ message: 'Video deleted successfully' });
    } catch {
        return videoError(res, 503, 'Unable to remove video metadata');
    }
}

module.exports = { generateUploadSignature, saveVideoMetadata, deleteVideo };
