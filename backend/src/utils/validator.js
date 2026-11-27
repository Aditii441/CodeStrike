const validator = require('validator');
function fail(message) { const error = new Error(message); error.name = 'InputValidationError'; throw error; }
function validate(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) fail('Invalid registration details');
    for (const field of ['firstName','lastName']) {
        if (field === 'lastName' && data[field] === undefined) continue;
        if (typeof data[field] !== 'string' || data[field].trim().length < 3 || data[field].trim().length > 20) fail(field + ' must contain 3–20 characters');
    }
    if (typeof data.emailId !== 'string' || !validator.isEmail(data.emailId.trim())) fail('Enter a valid email address');
    if (typeof data.password !== 'string' || Buffer.byteLength(data.password, 'utf8') > 72 || !validator.isStrongPassword(data.password)) fail('Password must contain at least 8 characters, uppercase, lowercase, number and special character, and at most 72 UTF-8 bytes');
    if (data.age !== undefined && (typeof data.age !== 'number' || !Number.isFinite(data.age) || data.age < 6 || data.age > 80)) fail('Invalid age');
}
module.exports = validate;
