const axios = require('axios');
const FormData = require('form-data');
const { XMLParser } = require('fast-xml-parser');

const BACKEND_API_URL_POST = process.env.BACKEND_API_URL_POST;
const BACKEND_API_URL_GET_STATUS = process.env.BACKEND_API_URL_GET_STATUS;
const BACKEND_API_URL_GET_DOC = process.env.BACKEND_API_URL_GET_DOC;
const TENANT_ID = process.env.TENANT_ID;
const USERNAME = process.env.APP_USERNAME || 'admin';
const PASSWORD = process.env.APP_PASSWORD || 'admin';

const BACKEND_GENERATOR_SPACE=process.env.GENERATOR_SPACE
const BACKEND_GENERATOR_STAGE=process.env.GENERATOR_STAGE
const BACKEND_GENERATOR_UNIT=process.env.GENERATOR_UNIT
const BACKEND_GENERATOR_TEMPLATENAME=process.env.GENERATOR_TEMPLATENAME
const BACKEND_GENERATOR_LANG=process.env.GENERATOR_LANG

// replace URL variables with values
function formatUrl(url, params) {
  return Object.entries(params).reduce(
    (acc, [key, value]) => acc.replace(`{${key}}`, value),
    url
  );
}

// polling status
async function waitForStatus(requestId, maxTries = 20, delayMs = 3000, onStatus) {
  const basicAuth = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
  for (let i = 0; i < maxTries; i++) {
    const statusUrl = formatUrl(BACKEND_API_URL_GET_STATUS, { requestId });
    try {
      const res = await axios.get(statusUrl, {
        headers: {
          'X-Tenant-ID': TENANT_ID,
          'Authorization': `Basic ${basicAuth}`
        }
      });
      let status, errorMessage, errorCode, documentId, documentIds;
      // Buffer or XML string
      if (typeof res.data === 'string' || Buffer.isBuffer(res.data)) {
        const parser = new XMLParser();
        const xmlString = Buffer.isBuffer(res.data) ? res.data.toString() : res.data;
        const parsed = parser.parse(xmlString);
        status = parsed.Status?.Status;
        errorMessage = parsed.Status?.ErrorMessage;
        errorCode = parsed.Status?.ErrorCode;
        documentId = parsed.Status?.Document?.DocumentId;
        documentIds = parsed.Status?.Document?.DocumentId ? [parsed.Status.Document.DocumentId] : [];
      } else {
        // JSON
        status = res.data.status;
        errorMessage = res.data.errorMessage;
        errorCode = res.data.errorCode;
        documentId = res.data.documentId;
        documentIds = res.data.documentIds;
      }

      if (onStatus) {
        onStatus({ status, errorMessage, errorCode });
      }
      if (status === 'FINISHED') {
        return Array.isArray(documentIds) && documentIds.length > 0 ? documentIds[0] : documentId;
      }
      if (status === 'FAILED') {
        throw new Error(errorMessage || 'PDF generation failed');
      }
    } catch (err) {
      console.error('Erreur lors du polling status:', err.response ? err.response.data : err.message);
      throw err;
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  throw new Error('Timeout waiting for PDF generation');
}

// main function
// onStatus: callback(statusUpdate) called at each key step
async function generateAndFetchPDF(options = {}, onStatus) {
  // 1. create form-data for the POST
  const form = new FormData();
  if (options.data) {
    form.append('data', options.data, {
      filename: options.data.originalname || 'data.xml',
      contentType: 'application/xml'
    });
  }
  if (options.flowData) {
    form.append('flowData', options.flowData, {
      filename: options.flowData.originalname || 'flowData.xml',
      contentType: 'application/xml'
    });
  }

  form.append('correlationId', 'ExternalReference');
  form.append('flowId', 'PEPPOL_PDF');
  form.append('priority', 'NORMAL');
  form.append('modelpath', `/${BACKEND_GENERATOR_SPACE}/${BACKEND_GENERATOR_STAGE}/${BACKEND_GENERATOR_UNIT}/${BACKEND_GENERATOR_TEMPLATENAME}/${BACKEND_GENERATOR_LANG}/compiled.lgp`);
  //if (options.correlationId) form.append('correlationId', options.correlationId);
  //if (options.modelpath) form.append('modelpath', options.modelpath);
  //if (options.flowId) form.append('flowId', options.flowId);
  //if (options.priority) form.append('priority', options.priority);
  //if (options.username || USERNAME) form.append('username', options.username || USERNAME);
  //if (options.password || PASSWORD) form.append('password', options.password || PASSWORD);

  // Basic Auth header
  const basicAuth = Buffer.from(`${options.username || USERNAME}:${options.password || PASSWORD}`).toString('base64');
  const headers = {
    ...form.getHeaders(),
    'X-Tenant-ID': options.tenantId || TENANT_ID,
    'Authorization': `Basic ${basicAuth}`
  };
  
  // 2. POST to create the request
  const response = await axios.post(BACKEND_API_URL_POST, form, {
    headers,
    responseType: 'arraybuffer', // To support XML or JSON
    timeout: 10000
  });
  
  let requestId;
  const contentType = response.headers['content-type'] || '';
  if (contentType.includes('xml')) {
    const parser = new XMLParser();
    const xmlString = response.data.toString();
    const parsed = parser.parse(xmlString);
    requestId = parsed.Request && parsed.Request.RequestId;
  } else if (contentType.includes('json')) {
    const json = JSON.parse(response.data.toString());
    requestId = json.requestId;
  }
  

  if (!requestId) throw new Error('No requestId returned from backend');

  if (onStatus) {
    try {
      onStatus({ status: 'SUBMITTED', requestId });
    } catch (err) {
      console.error('Erreur dans le callback onStatus:', err);
    }
  }
  
  // 3. polling status
  const documentId = await waitForStatus(requestId, 20, 3000, onStatus);

  // 4. get the document
  const basicAuthentication = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
  if (onStatus) onStatus({ status: 'FETCHING_PDF', documentId });
  const docUrl = formatUrl(BACKEND_API_URL_GET_DOC, { requestId, documentId });
  const docRes = await axios.get(docUrl, { responseType: 'arraybuffer', headers: {
    'X-Tenant-ID': options.tenantId || TENANT_ID,
    'Authorization': `Basic ${basicAuthentication}`
  } });

  // 5. return the PDF or an error
  const contentTypePDF = docRes.headers['content-type'];
  if (contentTypePDF.includes('application/pdf')) {
    if (onStatus) onStatus({ status: 'PDF_READY', documentId });
    return { type: 'pdf', data: docRes.data };
  } else {
    throw new Error('Unexpected document type returned');
  }
}

module.exports = { generateAndFetchPDF };