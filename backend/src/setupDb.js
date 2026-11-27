const dns = require('node:dns');
dns.setServers(['1.1.1.1', '1.0.0.1']);
require('dotenv').config();
const mongoose = require('mongoose');
const connect = require('./config/db');
const Problem = require('./models/problem');
const Submission = require('./models/submission');
const User = require('./models/user');
const SolutionVideo = require('./models/solutionVideo');

async function setupVideoIndexes() {
    const activeVideos = SolutionVideo.find({ retiredAt: null })
        .select('_id problemId').sort({ problemId: 1, createdAt: -1, _id: -1 }).lean().cursor();

    let previousProblem;
    let retired = 0;
    for await (const video of activeVideos) {
        const problemId = String(video.problemId);
        if (problemId === previousProblem) {
            const result = await SolutionVideo.updateOne({ _id: video._id, retiredAt: null }, {
                $set: { retiredAt: new Date() }
            });
            retired += result.modifiedCount;
        }
        previousProblem = problemId;
    }
    await SolutionVideo.createIndexes();
    console.log(`Video indexes ready. Retired ${retired} duplicate video records.`);
}

async function setupDatabase() {
    const adminEmail = process.argv[2]?.trim().toLowerCase();
    if (!process.env.DB_STRING) throw new Error('Missing DB_STRING');
    await connect();
    if (process.argv[2] === '--video-indexes') {
        await setupVideoIndexes();
        return;
    }

    await Promise.all([User.init(), Problem.init(), Submission.init()]);

    // Remove the old unique index only if it is on the solved array alone.
    const indexes = await User.collection.indexes();
    const legacyIndex = indexes.find(index =>
        index.unique && Object.keys(index.key).length === 1 && index.key.problemSolved === 1);
    if (legacyIndex) {
        await User.collection.dropIndex(legacyIndex.name);
        console.log('Removed the legacy unique index on problemSolved');
    }

    const accepted = Submission.aggregate([
        { $match: { status: 'accepted', testCasesTotal: { $gt: 0 },
            $expr: { $eq: ['$testCasesPassed', '$testCasesTotal'] } } },
        { $group: { _id: { userId: '$userId', problemId: '$problemId' } } }
    ]).cursor({ batchSize: 100 });

    let repaired = 0;
    for await (const { _id: { userId, problemId } } of accepted) {
        if (!await Problem.exists({ _id: problemId, archivedAt: null })) continue;
        const result = await User.updateOne({ _id: userId }, { $addToSet: { problemSolved: problemId } });
        repaired += result.modifiedCount;
    }
    console.log(`Reconciled ${repaired} solved-problem entries`);

    if (adminEmail) {
        const user = await User.findOneAndUpdate({ emailId: adminEmail }, { role: 'admin' });
        if (!user) throw new Error('Register the account before promoting it');
        console.log('Account promoted. Sign in again to refresh the session.');
    }
}

setupDatabase().catch(error => {
    console.error('Database setup failed:', error.message);
    process.exitCode = 1;
}).finally(() => mongoose.disconnect());
