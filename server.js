const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const date = new Date();
        const year = date.getFullYear().toString();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dir = path.join(__dirname, 'uploads', year, month, day);

        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

app.use(express.static('public'));

app.post('/save-pdf', upload.single('pdf'), (req, res) => {
    res.json({ message: 'PDF saved successfully' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
