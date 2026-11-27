const dns = require('node:dns');
dns.setServers(['1.1.1.1', '1.0.0.1']);
require('dotenv').config();
const mongoose = require('mongoose');
const connect = require('./config/db');
const User = require('./models/user');
const Problem = require('./models/problem');
const problems = require('../data/problems.json');
const assembleCode = require('./utils/assembleCode');
const { judgeTests } = require('./utils/ProblemUtility');

async function seed() {
    const email = process.argv[2]?.trim().toLowerCase();
    if (!email) throw new Error('Usage: npm run seed:problems -- admin@example.com');
    await connect();
    const admin = await User.findOne({ emailId: email, role: 'admin' });
    if (!admin) throw new Error('Admin account not found');
    for (const data of problems) {
        if (await Problem.countDocuments({ archivedAt: null }) >= 10) break;
        if (await Problem.exists({ title: data.title })) continue;
        const problem = new Problem({ ...data, problemCreator: admin._id });
        await problem.validate();
        const tests = [...data.visibleTestCases, ...data.hiddenTestCases];
        for (const { language, completeCode } of data.referenceSolution) {
            // Small batches keep the local Judge0 queue manageable.
            for (let i = 0; i < tests.length; i += 3) {
                const results = await judgeTests(assembleCode(problem, language, completeCode), language, tests.slice(i, i+3));
                if (results.some(result => result.status_id !== 3)) throw new Error(`${data.title}: ${language} validation failed`);
            }
        }
        await problem.save();
        console.log(`Added ${data.title}`);
    }
    console.log('Active problems:', await Problem.countDocuments({ archivedAt: null }));
}
seed().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
