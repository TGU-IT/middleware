require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const uploadRoute = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 3000;

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

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
