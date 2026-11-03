const Problem = require("../models/problem");
const Submission = require("../models/submission");
const {
    getLanguageById,
    submitBatch,
    submitToken
} = require("../utils/ProblemUtility");


const submitCode = async (req, res) => {
    try {
        const userId = req.result._id;
        const problemId = req.params.id;
        const { code, language } = req.body;

        if (!userId || !problemId || !code || !language) {
            return res.status(400).send("Code and language are required");
        }

        const problem = await Problem.findById(problemId);

        if (!problem) {
            return res.status(404).send("Problem not found");
        }

        const languageId = getLanguageById(language);

        if (!languageId) {
            return res.status(400).send("Unsupported language");
        }

        // Create submission record first
        const submittedResult = await Submission.create({
            userId,
            problemId,
            code,
            language,
            status: "pending",
            testCasesTotal: problem.hiddenTestCases.length
        });

        // Create Judge0 submissions for hidden test cases
        const submissions = problem.hiddenTestCases.map((testcase) => ({
            source_code: code,
            language_id: languageId,
            stdin: testcase.input,
            expected_output: testcase.output
        }));

        // Send all test cases to Judge0
        const submitResult = await submitBatch(submissions);

        const resultToken = submitResult.map(
            (value) => value.token
        );

        // Wait until Judge0 finishes all test cases
        const testResult = await submitToken(resultToken);
        console.log("SUBMIT JUDGE0 RESULT:", testResult);

        let testCasesPassed = 0;
        let runtime = 0;
        let memory = 0;
        let status = "accepted";
        let errorMessage = "";

        for (const test of testResult) {

            if (test.status_id === 3) {
                // Accepted
                testCasesPassed++;

                if (test.time) {
                    runtime += parseFloat(test.time);
                }

                if (test.memory) {
                    memory = Math.max(memory, test.memory);
                }

            } else {

                // Something went wrong
                status = "rejected";

                errorMessage =
                    test.stderr ||
                    test.compile_output ||
                    test.message ||
                    "Test case failed";

                // Stop checking further status
                break;
            }
        }

        // Save final result
        submittedResult.status = status;
        submittedResult.runtime = runtime;
        submittedResult.memory = memory;
        submittedResult.errorMessage = errorMessage;
        submittedResult.testCasesPassed = testCasesPassed;

        await submittedResult.save();

        // Mark problem solved only if ALL test cases passed
        if (
            status === "accepted" &&
            !req.result.problemsolved.includes(problemId)
        ) {
            req.result.problemsolved.push(problemId);
            await req.result.save();
        }

        res.status(201).send(submittedResult);

    } catch (err) {
        console.log(err);
        res.status(400).send("Error: " + err);
    }
};


const runCode = async (req, res) => {
    try {
        const userId = req.result._id;
        const problemId = req.params.id;
        const { code, language } = req.body;

        if (!userId || !problemId || !code || !language) {
            return res.status(400).send("Code and language are required");
        }

        const problem = await Problem.findById(problemId);

        if (!problem) {
            return res.status(404).send("Problem not found");
        }

        const languageId = getLanguageById(language);

        if (!languageId) {
            return res.status(400).send("Unsupported language");
        }

        // Use visible test cases for Run Code
        const submissions = problem.visibleTestCases.map((testcase) => ({
            source_code: code,
            language_id: languageId,
            stdin: testcase.input,
            expected_output: testcase.output
        }));

        // Send test cases to Judge0
        const submitResult = await submitBatch(submissions);

        const resultToken = submitResult.map(
            (value) => value.token
        );

        // Wait for results
        const testResult = await submitToken(resultToken);

        res.status(200).send(testResult);

    } catch (err) {
        console.log(err);
        res.status(400).send("Error: " + err);
    }
};


module.exports = {
    submitCode,
    runCode
};