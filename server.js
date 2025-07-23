const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const uploadsDir = path.join(__dirname, 'public', 'uploads');

(async () => {
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
  } catch (err) {
    console.error('Error creating uploads directory:', err);
  }
})();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let boxes = [];
(async () => {
  try {
    if (await fs.access(DATA_FILE).then(() => true).catch(() => false)) {
      boxes = JSON.parse(await fs.readFile(DATA_FILE));
    }
  } catch (err) {
    console.error('Error reading data.json:', err);
  }
})();

app.post('/api/upload', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ filename: req.file.filename });
});

app.get('/api/boxes', (req, res) => res.json(boxes));

app.post('/api/boxes', async (req, res) => {
  try {
    const box = { id: uuidv4(), ...req.body };
    boxes.push(box);
    await fs.writeFile(DATA_FILE, JSON.stringify(boxes, null, 2));
    res.status(201).json({ message: 'Box added', id: box.id });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/boxes/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const index = boxes.findIndex(box => box.id === id);
    if (index !== -1) {
      boxes[index] = { id, ...req.body };
      await fs.writeFile(DATA_FILE, JSON.stringify(boxes, null, 2));
      res.json({ message: 'Box updated' });
    } else {
      res.status(404).json({ error: 'Box not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/boxes/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const index = boxes.findIndex(box => box.id === id);
    if (index !== -1) {
      boxes.splice(index, 1);
      await fs.writeFile(DATA_FILE, JSON.stringify(boxes, null, 2));
      res.json({ message: 'Box deleted' });
    } else {
      res.status(404).json({ error: 'Box not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));