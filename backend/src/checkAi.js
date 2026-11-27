require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function checkAi() {
    const apiKey = process.env.GEMINI_KEY?.trim();
    const model = process.env.GEMINI_MODEL?.trim().replace(/^models\//, '');
    if (!apiKey) throw new Error('Set GEMINI_KEY in backend/.env');
    const client = new GoogleGenAI({ apiKey });
    const models = await client.models.list();
    console.log('Available Gemini text generation models:');
    for await (const item of models) {
        if (item.name?.includes('gemini') && item.supportedActions?.includes('generateContent')) console.log(item.name.replace(/^models\//, ''));
    }
    if (!model) throw new Error('Choose a listed model and set GEMINI_MODEL in backend/.env');
    const result = await client.models.generateContent({model, contents:'Reply with OK.', config:{maxOutputTokens:128, abortSignal:AbortSignal.timeout(20000)}});
    if (!result.text?.trim()) throw new Error('Model returned no text');
    console.log('Gemini test successful:', model);
}
checkAi().catch(error => {
    console.error('Gemini check failed:', error.status || error.name);
    console.error('Check GEMINI_KEY, GEMINI_MODEL, API quota and internet connection.');
    process.exitCode = 1;
});
