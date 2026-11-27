// Driver templates contain exactly one {{SOLUTION}} marker. Legacy problems use complete programs.
function assembleCode(problem, language, code) {
    const normalize = value => ({'c++':'cpp',cpp:'cpp',c:'c',java:'java',python:'python',python3:'python'})[String(value).toLowerCase()];
    const driver = (problem.driverCode || []).find(entry => normalize(entry.language) === normalize(language));
    if (!driver?.template) return code;
    const parts = driver.template.split('{{SOLUTION}}');
    if (parts.length !== 2) throw new Error('Driver must contain exactly one {{SOLUTION}} marker');
    return parts[0] + code + parts[1];
}
module.exports = assembleCode;
