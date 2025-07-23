const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const uploadsDir = path.join(__dirname, 'public', 'uploads');

// Ensure upload folder exists
(async () => {
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
  } catch (err) {
    console.error('Error creating uploads directory:', err);
  }
})();

// Multer setup
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
  limits: { fileSize: 50 * 1024 * 1024 } // Increased to 50MB
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

// Image upload with sharp processing
app.post('/api/upload', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file || req.file.size === 0) {
      return res.status(400).json({ error: 'No file uploaded or file is empty' });
    }

    const originalPath = req.file.path;
    const outputFilename = `${Date.now()}-converted.jpg`;
    const outputPath = path.join(uploadsDir, outputFilename);

    await sharp(originalPath)
      .rotate() // Fix EXIF orientation
      .jpeg({ quality: 80 }) // Compress + convert to jpg
      .toFile(outputPath);

    await fs.unlink(originalPath); // Delete original upload

    res.json({ filename: outputFilename });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Image processing failed' });
  }
});

// GET boxes
app.get('/api/boxes', (req, res) => res.json(boxes));

// POST box
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

// PUT box
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

// DELETE box
app.delete('/api/boxes/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const index = boxes.findIndex(box => box.id === id);
    if (index !== -1) {
      const deletedPhoto = boxes[index].photo;
      if (deletedPhoto) {
        const photoPath = path.join(uploadsDir, deletedPhoto);
        await fs.unlink(photoPath).catch(() => {}); // Skip if already deleted
      }
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

app.listen(PORT, () => console.log(`🚚 Server running on http://localhost:${PORT}`));
