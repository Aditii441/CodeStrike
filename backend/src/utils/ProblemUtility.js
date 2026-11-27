const axios = require('axios');
const { setTimeout: delay } = require('node:timers/promises');

const languages = new Map([
    ['cpp', 2],
    ['c', 1],
    ['python', 10],
    ['java', 4]
]);

const displayNames = new Map([
    ['cpp', 'C++'],
    ['java', 'Java'],
    ['c', 'C'],
    ['python', 'Python']
]);

function normalizeLanguage(language) {
    if (typeof language !== 'string') return undefined;
    const value = language.trim().toLowerCase();
    const normalized = value === 'c++' ? 'cpp' : value === 'python3' ? 'python' : value;
    return languages.has(normalized) ? normalized : undefined;
}

function getLanguageById(language) {
    return languages.get(normalizeLanguage(language));
}

function getLanguageDisplayName(language) {
    return displayNames.get(normalizeLanguage(language)) ?? language;
}

async function requestBatch(options, timeout = 5000) {
    try {
        const { data } = await axios.request({
            url: `${(process.env.JUDGE0_URL || 'http://localhost:2358').replace(/\/+$/, '')}/submissions/batch`,
            proxy: false,
            maxRedirects: 0,
            timeout,
            ...options
        });
        return data;
    } catch {
        throw new Error('Judge0 request failed');
    }
}

async function submitBatch(submissions) {
    if (!Array.isArray(submissions) || !submissions.length) throw new Error('No test cases to judge');

    const result = await requestBatch({
        method: 'POST',
        params: { base64_encoded: false },
        data: { submissions }
    });
    if (!Array.isArray(result) || result.length !== submissions.length ||
        result.some(item => typeof item?.token !== 'string' || !item.token.trim()) ||
        new Set(result.map(item => item.token)).size !== submissions.length) {
        throw new Error('Judge0 did not return a token for each test case');
    }
    return result;
}

async function submitToken(tokens) {
    if (!Array.isArray(tokens) || !tokens.length || tokens.some(t => typeof t !== "string" || !t.trim()) || new Set(tokens).size !== tokens.length) throw new Error('No Judge0 tokens to poll');

    const deadline = performance.now() + 25000;
    let remaining = deadline - performance.now();
    while (remaining > 0) {
        const result = await requestBatch({
            method: 'GET',
            params: {
                tokens: tokens.join(','),
                base64_encoded: false,
                fields: 'token,language_id,status_id,time,memory,stdout,stderr,compile_output,message'
            }
        }, Math.ceil(Math.min(5000, remaining)));

        if (!Array.isArray(result?.submissions) || result.submissions.length !== tokens.length) {
            throw new Error('Judge0 returned an incomplete batch');
        }

        const byToken = new Map(result.submissions.map(test => [test?.token, test]));
        const ordered = tokens.map(token => byToken.get(token));
        if (ordered.some(test => !Number.isInteger(test?.status_id) ||
            test.status_id < 1 || test.status_id > 14)) {
            throw new Error('Judge0 returned an invalid result');
        }

        if (ordered.every(test => test.status_id > 2)) return ordered;
        await delay(Math.min(1000, Math.max(0, deadline - performance.now())));
        remaining = deadline - performance.now();
    }
    throw new Error('Judge0 timed out');
}

async function judgeTests(code, language, testCases) {
    const languageId = getLanguageById(language);
    if (!languageId) throw new Error('Unsupported language');

    const batch = await submitBatch(testCases.map(testCase => ({
        source_code: code,
        enable_network: false,
        language_id: languageId,
        stdin: testCase.input,
        expected_output: testCase.output
    })));
    const results = await submitToken(batch.map(result => result.token));
    if (results.some(test => test.status_id === 13)) {
        throw new Error('Judge0 reported an internal error');
    }
    return results;
}

module.exports = { getLanguageById, submitBatch, submitToken, normalizeLanguage, getLanguageDisplayName, judgeTests };
