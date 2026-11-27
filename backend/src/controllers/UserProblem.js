const { isObjectIdOrHexString } = require('mongoose');
const { normalizeLanguage, getLanguageDisplayName, judgeTests } = require('../utils/ProblemUtility');
const Problem = require('../models/problem');
const User = require('../models/user');
const Submission = require('../models/submission');
const SolutionVideo = require('../models/solutionVideo');

const assembleCode = require('../utils/assembleCode');
const active = { archivedAt: null };
const summaryFields = '_id title difficulty tags';
const editableFields = [
    'title', 'description', 'difficulty', 'tags', 'visibleTestCases',
    'hiddenTestCases', 'startCode', 'referenceSolution', 'driverCode', 'editorial'
];
const gradingFields = ['visibleTestCases', 'hiddenTestCases', 'startCode', 'referenceSolution', 'driverCode'];

function problemView(problem) {
    return {
        ...problem,
        tags: problem.tags === 'linked list' ? 'linkedList' : problem.tags
    };
}

function problemChanges(body) {
    const changes = Object.fromEntries(editableFields
        .filter(field => Object.hasOwn(body, field))
        .map(field => [field, body[field]]));

    if (Array.isArray(changes.visibleTestCases)) {
        changes.visibleTestCases = changes.visibleTestCases.map(test => ({
            input: test?.input,
            output: test?.output,
            explanation: test?.explanation ?? test?.explaination,
            explaination: test?.explanation ?? test?.explaination
        }));
    }

    for (const field of ['startCode', 'referenceSolution']) {
        if (Array.isArray(changes[field])) {
            const codeField = field === 'startCode' ? 'initialCode' : 'completeCode';
            changes[field] = changes[field].map(entry => ({
                language: getLanguageDisplayName(entry?.language),
                [codeField]: entry?.[codeField]
            }));
        }
    }

    return changes;
}

async function validateProblem(problem) {
    await problem.validate();
    const drivers = (problem.driverCode || []).filter(d => d.template);
    const languages = drivers.map(d => normalizeLanguage(d.language));
    if (new Set(languages).size !== languages.length || drivers.some(d => !normalizeLanguage(d.language) || !problem.startCode.some(c => normalizeLanguage(c.language) === normalizeLanguage(d.language)) || d.template.split('{{SOLUTION}}').length !== 2 || Buffer.byteLength(d.template) > 65536)) throw new Error('Invalid driver template');
    if (problem.title.length > 300 || problem.description.length > 16000 || problem.visibleTestCases.length + problem.hiddenTestCases.length > 30) throw new Error('Problem exceeds size limits');
    for (const test of [...problem.visibleTestCases, ...problem.hiddenTestCases]) if (test.input.length > 16000 || test.output.length > 16000) throw new Error('Test case exceeds size limits');
    for (const entry of [...problem.startCode, ...problem.referenceSolution]) if (Buffer.byteLength(entry.initialCode ?? entry.completeCode) > 65536) throw new Error('Code exceeds size limits');
    if (!problem.visibleTestCases?.length || !problem.hiddenTestCases?.length ||
        !problem.referenceSolution?.length || !problem.startCode?.length) {
        throw new Error('Provide visible tests, hidden tests, starter code, and reference solutions');
    }

    const starterLanguages = problem.startCode.map(entry => normalizeLanguage(entry.language));
    const solutionLanguages = problem.referenceSolution.map(entry => normalizeLanguage(entry.language));
    const starters = new Set(starterLanguages);
    if (starters.has(undefined) || starters.size !== starterLanguages.length ||
        new Set(solutionLanguages).size !== solutionLanguages.length ||
        starters.size !== solutionLanguages.length || solutionLanguages.some(language => !starters.has(language))) {
        throw new Error('Provide matching starter code and reference solutions for each supported language in the problem');
    }
}

async function validateReferenceSolutions(problem) {
    for (const { language, completeCode } of problem.referenceSolution) {
        const tests = [...problem.visibleTestCases, ...problem.hiddenTestCases];
        const results = await judgeTests(assembleCode(problem, language, completeCode), language, tests);
        const failed = results.findIndex(test => test.status_id !== 3);
        if (failed !== -1) return `${language} reference failed test ${failed+1} (Judge0 status ${results[failed].status_id})`;
    }
    return null;
}

async function saveProblem(req, res, updating) {
    const { id } = req.params;
    if (updating && !isObjectIdOrHexString(id)) return res.status(400).send('Invalid problem ID');

    const changes = problemChanges(req.body ?? {});
    if (!Object.keys(changes).length) return res.status(400).send('No editable fields supplied');

    try {
        const problem = updating
            ? await Problem.findOne({ _id: id, ...active })
            : new Problem({ problemCreator: req.result._id });
        if (!problem) return res.status(404).send('Problem not found');

        problem.set(changes);
        const gradingChanged = !updating || gradingFields.some(field => Object.hasOwn(changes, field));
        try {
            if (gradingChanged) await validateProblem(problem);
            else await problem.validate(Object.keys(changes));
        } catch (err) {
            return res.status(400).send(err.message || 'Invalid problem fields or limits');
        }

        if (gradingChanged) {
            try {
                const failure = await validateReferenceSolutions(problem);
                if (failure) {
                    return res.status(400).send(failure);
                }
            } catch {
                return res.status(502).send('Unable to validate reference solutions with Judge0');
            }
        }

        if (updating) {
            const fields = Object.fromEntries(Object.keys(changes).map(field => [field, problem.get(field)]));
            const version = problem.__v === undefined ? { $exists: false } : problem.__v;
            const result = await Problem.updateOne({ _id: id, ...active, __v: version }, {
                $set: fields,
                $inc: { __v: 1 }
            });
            if (!result.matchedCount) return res.status(409).send('Problem changed while the update was in progress');
            return res.status(200).send('Problem updated successfully');
        }

        await problem.save();
        return res.status(201).send('Problem Saved Successfully');
    } catch {
        return res.status(500).send('Unable to save problem');
    }
}

async function createProblem(req, res) { return saveProblem(req, res, false); }
async function updateProblem(req, res) { return saveProblem(req, res, true); }

async function deleteProblem(req, res) {
    const { id } = req.params;
    if (!isObjectIdOrHexString(id)) return res.status(400).send('Invalid problem ID');

    try {
        const result = await Problem.updateOne({ _id: id, ...active }, { archivedAt: new Date() });
        if (!result.matchedCount) return res.status(404).send('Problem not found');
        return res.status(200).send('Successfully Deleted');
    } catch {
        return res.status(500).send('Unable to delete problem');
    }
}

async function getProblemById(req, res) {
    const { id } = req.params;
    if (!isObjectIdOrHexString(id)) return res.status(400).send('Invalid problem ID');

    try {
        const problem = await Problem.findOne({ _id: id, ...active })
            .select(`${summaryFields} description visibleTestCases startCode editorial`)
            .lean();
        if (!problem) return res.status(404).send('Problem not found');

        const video = await SolutionVideo.findOne({ problemId: id, retiredAt: null })
            .sort({ createdAt: -1, _id: -1 }).select('secureUrl thumbnailUrl duration -_id').lean();
        const playback = /^https:\/\//.test(video?.secureUrl) ? {
            secureUrl: video.secureUrl,
            thumbnailUrl: /^https:\/\//.test(video.thumbnailUrl) ? video.thumbnailUrl : undefined,
            duration: video.duration
        } : {};

        return res.status(200).json({
            ...problemView(problem),
            ...playback,
            visibleTestCases: (problem.visibleTestCases ?? []).map(test => ({
                ...test,
                explanation: test.explanation ?? test.explaination,
                explaination: test.explaination ?? test.explanation
            })),
            startCode: (problem.startCode ?? []).map(entry => ({
                ...entry, language: getLanguageDisplayName(entry.language)
            })),

        });
    } catch {
        return res.status(500).send('Unable to load problem');
    }
}

async function getAllProblem(req, res) {
    try {
        const problems = await Problem.find(active).select(summaryFields).lean();
        return res.status(200).json(problems.map(problemView));
    } catch {
        return res.status(500).send('Unable to load problems');
    }
}

async function solvedAllProblembyUser(req, res) {
    try {
        const problems = await Problem.find({ _id: { $in: req.result.problemSolved ?? [] }, ...active })
            .select(summaryFields).lean();
        return res.status(200).json(problems.map(problemView));
    } catch {
        return res.status(500).send('Unable to load solved problems');
    }
}

async function submittedProblem(req, res) {
    const { id: problemId } = req.params;
    if (!isObjectIdOrHexString(problemId)) return res.status(400).send('Invalid problem ID');

    try {
        const submissions = await Submission.find({ userId: req.result._id, problemId })
            .sort({ createdAt: -1 }).lean();
        return res.status(200).json(submissions);
    } catch {
        return res.status(500).send('Unable to load submissions');
    }
}

async function getAdminProblem(req, res) {
    if (!isObjectIdOrHexString(req.params.id)) return res.status(400).send('Invalid problem ID');
    try {
        const problem = await Problem.findOne({_id:req.params.id, ...active}).lean();
        if (!problem) return res.status(404).send('Problem not found');
        return res.json(problemView(problem));
    } catch { return res.status(500).send('Unable to load problem'); }
}
async function getSolutions(req, res) {
    if (!isObjectIdOrHexString(req.params.id)) return res.status(400).send('Invalid problem ID');
    try {
        const problem = await Problem.findOne({_id:req.params.id, ...active}).select('referenceSolution').lean();
        if (!problem) return res.status(404).send('Problem not found');
        return res.json(problem.referenceSolution);
    } catch { return res.status(500).send('Unable to load solutions'); }
}
module.exports = { getAdminProblem, getSolutions,
    createProblem, updateProblem, deleteProblem, getProblemById,
    getAllProblem, solvedAllProblembyUser, submittedProblem
};
