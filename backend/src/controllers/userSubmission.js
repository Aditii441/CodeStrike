const { isObjectIdOrHexString } = require('mongoose');
const Problem = require('../models/problem');
const Submission = require('../models/submission');
const User = require('../models/user');
const { normalizeLanguage, judgeTests } = require('../utils/ProblemUtility');

const assembleCode = require('../utils/assembleCode');
function verdict(id) {
    return ({3:'Accepted',4:'Wrong Answer',5:'Time Limit Exceeded',6:'Compilation Error',14:'Execution Format Error'})[id] || 'Runtime Error';
}
async function runCode(req, res) {
    const { id: problemId } = req.params;
    const { code, language } = req.body ?? {};
    const normalizedLanguage = normalizeLanguage(language);
    if (!isObjectIdOrHexString(problemId) || typeof code !== 'string' || !code.trim() || Buffer.byteLength(code) > 65536) {
        return res.status(400).send('A valid problem ID and code are required');
    }
    if (!normalizedLanguage) return res.status(400).send('Unsupported language');

    try {
        const problem = await Problem.findOne({ _id: problemId, archivedAt: null });
        if (!problem) return res.status(404).send('Problem not found');

        if (!problem.startCode.some(entry => normalizeLanguage(entry.language) === normalizedLanguage)) return res.status(400).send('Language unavailable for this problem');
        const testCases = problem.visibleTestCases;
        if (!testCases.length) return res.status(409).send('Problem has no test cases for this action');

        let results;
        try { results = await judgeTests(assembleCode(problem, normalizedLanguage, code), normalizedLanguage, testCases); }
        catch { return res.status(502).send('Judging service unavailable'); }
        const passed = results.filter(test => test.status_id === 3);
        const accepted = passed.length === testCases.length;
        const runtime = results.reduce((total, test) => total + (Number(test.time) || 0), 0);
        const memory = results.reduce((peak, test) => Math.max(peak, Number(test.memory) || 0), 0);

            return res.status(200).json({
                success: accepted,
                testCases: results.map(({ token, ...test }, index) => ({
                    ...test, stdin: testCases[index].input, expected_output: testCases[index].output
                })),
                runtime, memory
            });
    } catch { return res.status(500).send('Unable to run code'); }
}
async function submitCode(req, res) {
    const { id: problemId } = req.params;
    const { code, language } = req.body ?? {};
    const normalizedLanguage = normalizeLanguage(language);
    if (!isObjectIdOrHexString(problemId) || typeof code !== 'string' || !code.trim() || Buffer.byteLength(code) > 65536) {
        return res.status(400).send('A valid problem ID and code are required');
    }
    if (!normalizedLanguage) return res.status(400).send('Unsupported language');

    const userId = req.result._id;
    let submission;
    try {
        const problem = await Problem.findOne({ _id: problemId, archivedAt: null });
        if (!problem) return res.status(404).send('Problem not found');

        if (!problem.startCode.some(entry => normalizeLanguage(entry.language) === normalizedLanguage)) return res.status(400).send('Language unavailable for this problem');
        const testCases = problem.hiddenTestCases;
        if (!testCases.length) return res.status(409).send('Problem has no test cases for this action');

        submission = await Submission.create({userId, problemId, code, language: normalizedLanguage, testCasesTotal: testCases.length});
        let results;
        try { results = await judgeTests(assembleCode(problem, normalizedLanguage, code), normalizedLanguage, testCases); }
        catch { await Submission.updateOne({_id:submission._id}, {status:'error',errorMessage:'Judging service unavailable'}); return res.status(502).send('Judging service unavailable'); }
        const passed = results.filter(test => test.status_id === 3);
        const accepted = passed.length === testCases.length;
        const runtime = results.reduce((total, test) => total + (Number(test.time) || 0), 0);
        const memory = results.reduce((peak, test) => Math.max(peak, Number(test.memory) || 0), 0);

        submission.status = accepted ? 'accepted' : 'rejected';
        submission.testCasesPassed = passed.length;
        submission.runtime = runtime;
        submission.memory = memory;
        submission.errorMessage = accepted ? '' : verdict(results.find(test => test.status_id !== 3)?.status_id);
        await submission.save();

        if (accepted) {
            await User.updateOne({ _id: userId }, { $addToSet: { problemSolved: problemId } });
        }

        return res.status(201).json({
            ...submission.toObject(),
            accepted,
            totalTestCases: submission.testCasesTotal,
            passedTestCases: submission.testCasesPassed
        });
    } catch { return res.status(500).send('Unable to submit code'); }
}
async function customRun(req,res){
 const {id}=req.params;const {code,language,input}=req.body||{};const lang=normalizeLanguage(language);
 if(!isObjectIdOrHexString(id)||!lang||typeof code!=='string'||!code.trim()||Buffer.byteLength(code)>65536||typeof input!=='string'||Buffer.byteLength(input)>16000)return res.status(400).send('Invalid custom input, code or language');
 try{const problem=await Problem.findOne({_id:id,archivedAt:null});if(!problem)return res.status(404).send('Problem not found');
 if(!problem.startCode.some(e=>normalizeLanguage(e.language)===lang))return res.status(400).send('Language unavailable');
 const [result]=await judgeTests(assembleCode(problem,lang,code),lang,[{input}]);
 // No reference execution on arbitrary input: output is observational, not a correctness verdict.
 return res.status(200).json({custom:true,success:result.status_id===3,runtime:Number(result.time)||0,memory:Number(result.memory)||0,testCases:[{status_id:result.status_id,stdin:input,stdout:result.stdout,stderr:result.stderr,compile_output:result.compile_output}]});
 }catch{return res.status(502).send('Unable to execute custom input');}
}
module.exports = {runCode, submitCode, customRun};
