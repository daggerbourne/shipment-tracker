const { authenticate, requireRole } = require('./middleware/authMiddleware');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

const app = express();
const authRoutes = require('./routes/auth');
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const uploadsDir = path.join(__dirname, 'public', 'uploads');
const mongoose = require('mongoose');


//mongoose connector
mongoose.connect('mongodb+srv://shipment-trackerDB:Zn00ZWFfwUGYpF4q@shipment-tracker.dvffhqe.mongodb.net/shipmentApp?retryWrites=true&w=majority&appName=shipment-tracker', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

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
  console.log('📥 fileFilter MIME:', file.mimetype);
  console.log('📥 fileFilter fieldname:', file.fieldname);
  if (!file.mimetype.startsWith('image/')) {
    console.warn(`❌ Rejected file with MIME: ${file.mimetype}`);
    return cb(new Error('Only image files are allowed'), false);
  }
  cb(null, true);
},
  limits: { fileSize: 50 * 1024 * 1024 } // Increased to 50MB
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/api', authRoutes);

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
    console.log('\n--- Upload started ---');
    console.log('Incoming upload from IP:', req.ip);
    console.log('Request headers:', req.headers);

    if (!req.file) {
      console.warn('❌ No file received');
      return res.status(400).json({ error: 'No file uploaded or file is empty' });
    }

    console.log('🔍 Received upload request');
    console.log('🔍 req.file:', req.file);
    console.log('🔍 req.body:', req.body);
    console.log('✔ File received');
    console.log('MIME type:', req.file.mimetype);
    console.log('Original name:', req.file.originalname);
    console.log('File size:', req.file.size);

    if (req.file.size === 0) {
      console.warn('❌ File is empty');
      return res.status(400).json({ error: 'Uploaded file is empty' });
    }

    const outputFilename = `${Date.now()}-converted.jpg`;
    const outputPath = path.join(uploadsDir, outputFilename);

   try {
  await sharp(req.file.path)
    .rotate()
    .jpeg({ quality: 80 })
    .toFile(outputPath);

  await fs.unlink(req.file.path);
} catch (sharpErr) {
  console.error('❌ Sharp processing failed:', sharpErr.message);
  return res.status(500).json({ error: 'Image processing failed', detail: sharpErr.message });
}
    console.log('✅ Upload successful:', outputFilename);
    res.json({ filename: outputFilename });

  } catch (err) {
    console.error('🔥 Upload error:', err.message);
    res.status(500).json({ error: 'Image processing failed', detail: err.message });
  }
});




// 👀 All logged-in users (Viewer or Contributor) can see boxes
app.get('/api/boxes', authenticate, (req, res) => res.json(boxes));

// ✍️ Only Contributors can add/edit/delete
app.post('/api/boxes', authenticate, requireRole('contributor'), async (req, res) => {
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
app.put('/api/boxes/:id', authenticate, requireRole('contributor'), async (req, res) => {
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
app.delete('/api/boxes/:id', authenticate, requireRole('contributor'), async (req, res) => {
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
