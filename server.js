const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Serve static files from the project directory (optional, if you add CSS/JS later)
// app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
