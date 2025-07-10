require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const uploadRoute = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 3000;

// Autoriser le CORS pour toutes les origines (adapter en prod)
app.use(cors({
    origin: '*', // Remplace '*' par l'URL de ton front-end en production
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// Exposer le dossier uploads pour accès aux fichiers depuis le front
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/upload', uploadRoute);

app.get('/', (req, res) => {
    res.send('PEPPOL Middleware API running.');
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
