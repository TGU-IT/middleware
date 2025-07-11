const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fileStorage = require('../services/fileStorage');
const backendClient = require('../services/backendClient');
const generateUploadId = require('../utils/generateUploadId');

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

// Upload route
router.post('/', upload.single('file'), async (req, res) => {
    try {
        // User info
        const { email, name, company, phone } = req.body;
        if (!req.file) {
            return res.status(400).json({ error: 'No XML file uploaded.' });
        }
        // Generate unique upload ID
        const uploadId = generateUploadId();
        // Save input.xml and request_info.xml
        await fileStorage.saveInputXml(uploadId, req.file.buffer);
        await fileStorage.saveRequestInfoXml(uploadId, { email, name, company, phone });
        // Call backend API
        const backendResult = await backendClient.validateXml(uploadId, req.file.buffer);
        // Save backend result
        if (backendResult.type === 'pdf') {
            await fileStorage.saveOutputPdf(uploadId, backendResult.data);
            // Return PDF preview URL or file
            return res.json({ uploadId, pdfUrl: `/uploads/${uploadId}/output.pdf` });
        } else if (backendResult.type === 'validation') {
            await fileStorage.saveValidationXml(uploadId, backendResult.data);
            // Return error details
            return res.status(422).json({ uploadId, errors: backendResult.errors });
        } else {
            throw new Error('Unknown backend response type');
        }
    } catch (err) {
        if (uploadId) {
            return res.status(500).json({ error: err.message, uploadId });
        } else {
            return res.status(500).json({ error: err.message });
        }
    }
});

module.exports = router;
