const express = require('express');
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post('/test', (req, res) => {
    res.json(req.body);
});

app.listen(3001, async () => {
    console.log("Server listening");
    const res = await fetch('http://localhost:3001/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ candidateId: '123', selected: true })
    });
    console.log(await res.json());
    process.exit();
});
