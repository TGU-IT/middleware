const fs = require('fs');
const path = require('path');
const { BlobServiceClient } = require('@azure/storage-blob');
const xml2js = require('xml2js');
const util = require('util');
const mkdir = util.promisify(fs.mkdir);
const writeFile = util.promisify(fs.writeFile);

const USE_AZURE = process.env.USE_AZURE === 'true';
const UPLOADS_DIR = process.env.UPLOADS_DIR || 'uploads';

let blobServiceClient, containerClient;
if (USE_AZURE) {
    blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    containerClient = blobServiceClient.getContainerClient(process.env.AZURE_CONTAINER_NAME);
}

async function ensureLocalDir(uploadId) {
    const dir = path.join(UPLOADS_DIR, uploadId);
    await mkdir(dir, { recursive: true });
    return dir;
}

// save input xml
async function saveInputXml(uploadId, buffer) {
    if (USE_AZURE) {
        const blockBlobClient = containerClient.getBlockBlobClient(`${uploadId}/input.xml`);
        await blockBlobClient.uploadData(buffer);
    } else {
        const dir = await ensureLocalDir(uploadId);
        await writeFile(path.join(dir, 'input.xml'), buffer);
    }
}


// save request info
async function saveRequestInfoXml(uploadId, info) {
    const builder = new xml2js.Builder();
    const xml = builder.buildObject({ request: info });
    if (USE_AZURE) {
        const blockBlobClient = containerClient.getBlockBlobClient(`${uploadId}/request_info.xml`);
        await blockBlobClient.uploadData(Buffer.from(xml));
    } else {
        const dir = await ensureLocalDir(uploadId);
        await writeFile(path.join(dir, 'request_info.xml'), xml);
    }
}

// save output pdf
async function saveOutputPdf(uploadId, buffer) {
    if (USE_AZURE) {
        const blockBlobClient = containerClient.getBlockBlobClient(`${uploadId}/output.pdf`);
        await blockBlobClient.uploadData(buffer);
    } else {
        const dir = await ensureLocalDir(uploadId);
        await writeFile(path.join(dir, 'output.pdf'), buffer);
    }
}

// save validation xml
async function saveValidationXml(uploadId, buffer) {
    if (USE_AZURE) {
        const blockBlobClient = containerClient.getBlockBlobClient(`${uploadId}/validation.xml`);
        await blockBlobClient.uploadData(buffer);
    } else {
        const dir = await ensureLocalDir(uploadId);
        await writeFile(path.join(dir, 'validation.xml'), buffer);
    }
}

module.exports = {
    saveInputXml,
    saveRequestInfoXml,
    saveOutputPdf,
    saveValidationXml
};
