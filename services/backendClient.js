const axios = require('axios');
const FormData = require('form-data');

const BACKEND_API_URL = process.env.BACKEND_API_URL;

async function validateXml(uploadId, xmlBuffer) {
    const form = new FormData();
    form.append('file', xmlBuffer, { filename: 'input.xml', contentType: 'application/xml' });
    form.append('upload_id', uploadId);
    try {
        const response = await axios.post(BACKEND_API_URL, form, {
            headers: form.getHeaders(),
            responseType: 'arraybuffer', // Handle both PDF and XML
            validateStatus: status => status < 500
        });
        const contentType = response.headers['content-type'];
        if (contentType.includes('application/pdf')) {
            return { type: 'pdf', data: response.data };
        } else if (contentType.includes('application/xml')) {
            return { type: 'validation', data: response.data, errors: response.data.toString() };
        } else {
            throw new Error('Unexpected backend response');
        }
    } catch (err) {
        throw new Error('Backend validation failed: ' + err.message);
    }
}

module.exports = { validateXml };
