# PEPPOL Middleware Server

A Node.js/Express middleware server for uploading XML files, asynchronous processing via a Java backend, and PDF generation with real-time WebSocket status updates.

## Features

- **XML File Upload** with validation
- **Asynchronous Processing** via Java backend
- **Real-time Communication** via WebSocket (Socket.IO)
- **Worker Pool** for concurrent processing
- **Temporary File Storage**
- **PDF Generation** with live status
- **Robust Error Handling**

## Requirements

- Node.js (v14 or higher)
- npm or yarn
- PEPPOL Java backend (for XML processing)

## Installation

1. **Clone the project** (if applicable)
2. **Install dependencies**:
   ```bash
   cd middleware
   npm install
   ```
3. **Configure environment variables**:
   Create a `.env` file in the `middleware/` folder:
   ```env
   # FlowData file configuration
   FLOW_DATA_FILE_PATH=../utils/FlowDataSimple.xml

   # File size limit (in MB)
   MAX_FILE_SIZE_MB=2

   # Server port
   PORT=3000
   ```

## Usage

Start the middleware server:
```bash
npm start
# or
# ou
node server.js
```

The server starts on the configured port (default: 3000).

## 📡 API Endpoints

### POST `/upload`
Upload and process an XML file.

**Parameters** :
- `file` : XML file (required)
- `email` : User email (required)
- `name` : User name (required)
- `company` : Company (required)
- `phone` : Phone (required)
- `correlationId` : Correlation ID (optional)
- `modelpath` : Model path (optional)
- `flowId` : Flow ID (optional)
- `priority` : Priority (optional)

**Response** :
```json
{
  "uploadId": "uuid-unique",
  "status": "PROCESSING"
}
```

### GET `/uploads/:uploadId/output.pdf`
Access to the generated PDF.

### GET `/`
Server status.

## 🔌 WebSocket Events

### Connection
```javascript
const socket = io('http://localhost:3000');
```

### Subscribe to an upload
```javascript
socket.emit('subscribe', uploadId);
```

### listen to status updates
```javascript
socket.on('status', (message) => {
  console.log('Status:', message);
  // message contains: { uploadId, status, pdfUrl?, errorMessage? }
});
```

### Possible statuses
- `SUBMITTED` : Upload submitted
- `PROCESSING` : Processing
- `GENERATING` : PDF generation
- `FETCHING_PDF` : PDF fetching
- `FINISHED` : Success
- `FAILED` : Failure

## ⚙️ Architecture

### Worker Pool
- **Max concurrency** : 20 jobs at the same time
- **Queue** : Jobs in queue if limit reached
- **Automatic management** : Start/stop jobs

### File storage
- **Uploads temporary** : `./uploads/`
- **Structure** : `./uploads/{uploadId}/`
- **Files** : `input.xml`, `request_info.xml`, `output.pdf`

### WebSocket Communication
- **Map of sockets** : `uploadId → Set<Socket>`
- **Automatic cleanup** : Disconnected socket cleanup
- **Broadcast** : Status broadcast to all subscribed clients

## 🔧 Configuration

### Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `MAX_FILE_SIZE_MB` | Maximum file size | `2` |
| `FLOW_DATA_FILE_PATH` | FlowData file path | `../utils/FlowDataSimple.xml` |

### Folder structure
```
middleware/
├── server.js              # principal server
├── routes/
│   └── upload.js          # upload route
├── services/
│   ├── backendClient.js   # Client backend Java
│   └── fileStorage.js     # file storage service
├── utils/
│   ├── generateUploadId.js
│   └── FlowDataSimple.xml
├── uploads/               # temporary files
└── .env                   # Configuration
```

## 🐛 Error handling

### Upload errors
- File too large
- Invalid file type
- Missing required fields

### Processing errors
- XML validation failure
- Backend Java error
- Generation timeout

### Logs
- Console for development
- WebSocket statuses for client
- Disconnection handling

## 🔒 Security

### Production
- **CORS** : Replace `'*'` by the frontend URL
- **Validation** : Strengthen file validation
- **Rate limiting** : Add request limits
- **HTTPS** : Use HTTPS in production

## 📊 Monitoring

### Metrics
- Number of active jobs
- Queue size
- Processing time
- Success/failure rate

### Logs
```bash
# Start
Server listening on port 3000

# Upload
[UPLOAD] FlowData loaded from: ../utils/FlowDataSimple.xml

# Errors
ERROR ASYNC PROCESSING: [error details]
```

## 🤝 Integration

### Frontend React
```javascript
// Upload
const formData = new FormData();
formData.append('file', xmlFile);
formData.append('email', 'user@example.com');
// ... autres champs

const response = await fetch('http://localhost:3000/upload', {
  method: 'POST',
  body: formData
});

// WebSocket
const socket = io('http://localhost:3000');
socket.emit('subscribe', uploadId);
socket.on('status', handleStatus);
```

### Backend Java
- **Endpoint** : Configured in `backendClient.js`
- **Protocol** : HTTP/HTTPS
- **Format** : Multipart form data
- **Response** : PDF in base64 or file

## 📝 Development notes

### Attention points
- **Memory leaks** : Socket disconnection handling
- **Queue** : Queue management
- **Timeouts** : Appropriate configuration
- **Backend errors** : Error propagation to frontend

### Possible Improvements
- **Persistance** : Database for uploads
- **Cache** : PDF caching
- **Compression** : File compression
- **Monitoring** : Advanced metrics 