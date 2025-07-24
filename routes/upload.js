const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fileStorage = require('../services/fileStorage');
const backendClient = require('../services/backendClient');
const generateUploadId = require('../utils/generateUploadId');
const fs = require('fs');
const pendingUploads = require('../pendingUploads');

const MAX_FILE_SIZE_MB = process.env.MAX_FILE_SIZE_MB ? parseInt(process.env.MAX_FILE_SIZE_MB) : 2;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() !== '.xml') {
            return cb(new Error('Only .xml files are allowed'));
        }
        cb(null, true);
    }
});

module.exports.pendingUploads = pendingUploads;

// Upload route
router.post('/', upload.fields([
    { name: 'data', maxCount: 1 },
    { name: 'flowData', maxCount: 1 },
    { name: 'file', maxCount: 1 }
]), async (req, res) => {
    let uploadId;
    try {
        const io = req.app.get('io');
        const uploadSockets = req.app.get('uploadSockets');

        // user info and additional fields
        const { email, name, company, phone, correlationId, modelpath, flowId, priority } = req.body;

        // files
        const dataFile = req.files['data'] ? req.files['data'][0] : null;
        const flowDataFile = req.files['flowData'] ? req.files['flowData'][0] : null;
        const mainFile = req.files['file'] ? req.files['file'][0] : null;
        let flowDataBuffer;
        if (flowDataFile) {
            flowDataBuffer = flowDataFile.buffer;
        } else {
            // if not uploaded, use a static file
            flowDataBuffer = fs.readFileSync(path.join(__dirname, '../utils/FlowDataSimple.xml'));
        }
        if (!mainFile && !dataFile) {
            return res.status(400).json({ error: 'No XML file uploaded.' });
        }
        // generate unique ID
        uploadId = generateUploadId();
        // save input.xml and request_info.xml
        await fileStorage.saveInputXml(uploadId, (dataFile ? dataFile.buffer : mainFile.buffer));
        await fileStorage.saveRequestInfoXml(uploadId, { email, name, company, phone });
        // prepare options for generateAndFetchPDF
        const options = {
            data: dataFile ? dataFile.buffer : mainFile.buffer,
            flowData: flowDataBuffer,
            correlationId,
            modelpath,
            flowId,
            priority
        };
        // store the upload in pending
        pendingUploads.set(uploadId, { options });
        // respond immediately with the uploadId
        return res.json({ uploadId, status: 'PROCESSING' });
    } catch (err) {
        if (uploadId) {
            return res.status(500).json({ error: err.message, uploadId });
        } else {
            return res.status(500).json({ error: err.message });
        }
    }
});

module.exports = router;
