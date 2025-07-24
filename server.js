require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const uploadRoute = require('./routes/upload');
const http = require('http');
const { Server } = require('socket.io');
const pendingUploads = require('./pendingUploads');
const backendClient = require('./services/backendClient');
const fileStorage = require('./services/fileStorage');

const app = express();
const PORT = process.env.PORT || 3000;

// socket server is instantiated on the HTTP server
// same port as the HTTP server
// same origin as the HTTP server
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*', // TODO: For production, we should only allow the frontend URL
        methods: ['GET', 'POST']
    }
});

// Map uploadId -> Set of sockets
const uploadSockets = new Map();

// for each connection, we create a socket
// the socket is used to send status updates to the client
// the socket is used to send the output PDF to the client
io.on('connection', (socket) => {
    // The client must send the uploadId to monitor
    socket.on('subscribe', (uploadId) => {
        if (!uploadSockets.has(uploadId)) {
            uploadSockets.set(uploadId, new Set());
        }
        uploadSockets.get(uploadId).add(socket);
        socket.uploadId = uploadId;

        // Check the presence of the upload in pending
        const pending = pendingUploads.get(uploadId);
        if (pending) {
            (async () => {
                try {
                    const backendResult = await backendClient.generateAndFetchPDF(pending.options, (statusUpdate) => {
                        if (statusUpdate.status === 'PDF_READY' || statusUpdate.status === 'FINISHED') return;
                        if (uploadSockets.has(uploadId)) {
                            for (const socket of uploadSockets.get(uploadId)) {
                                socket.emit('status', { uploadId, ...statusUpdate });
                            }
                        }
                    });
                    if (backendResult.type === 'pdf') {
                        await fileStorage.saveOutputPdf(uploadId, backendResult.data);
                        if (uploadSockets.has(uploadId)) {
                            for (const socket of uploadSockets.get(uploadId)) {
                                // Get the base URL dynamically from the handshake
                                const DOCS_URL = `${socket.handshake.headers['x-forwarded-proto'] || 'http'}://${socket.handshake.headers.host}`;
                                socket.emit('status', { uploadId, status: 'FINISHED', pdfUrl: `${DOCS_URL}/uploads/${uploadId}/output.pdf` });
                            }
                        }
                    } else {
                        if (uploadSockets.has(uploadId)) {
                            for (const socket of uploadSockets.get(uploadId)) {
                                socket.emit('status', { uploadId, status: 'FAILED', errorMessage: 'Unknown backend response type' });
                            }
                        }
                    }
                } catch (err) {
                    if (uploadSockets.has(uploadId)) {
                        for (const socket of uploadSockets.get(uploadId)) {
                            socket.emit('status', { uploadId, status: 'FAILED', errorMessage: err.message });
                        }
                    }
                    console.error('ERROR ASYNC PROCESSING:', err);
                }
            })();
            pendingUploads.delete(uploadId);
        }
    });
    // When the client disconnects, we remove the socket from the uploadSockets map
    socket.on('disconnect', () => {
        const { uploadId } = socket;
        if (uploadId && uploadSockets.has(uploadId)) {
            uploadSockets.get(uploadId).delete(socket);
            if (uploadSockets.get(uploadId).size === 0) {
                uploadSockets.delete(uploadId);
            }
        }
    });
});

// Expose io and uploadSockets for use in routes
app.set('io', io);
app.set('uploadSockets', uploadSockets);

// Authorize CORS for all origins (adapt for production)
app.use(cors({
    origin: '*', // Replace '*' with your frontend URL in production
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// Expose the uploads folder for access to files from the frontend
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/upload', uploadRoute);

app.get('/', (req, res) => {
    res.send('PEPPOL Middleware API running.');
});

httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
