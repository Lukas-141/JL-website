// Simple file upload server with GitHub auto-sync
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Image upload destination
const uploadDir = path.join(__dirname, 'assets', 'images');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('✓ Created assets/images directory');
}

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const sanitized = path.basename(file.originalname, ext)
      .replace(/[^a-z0-9-]/gi, '-')
      .replace(/-+/g, '-')
      .toLowerCase();
    const fileName = `${sanitized}_${Date.now()}${ext}`;
    cb(null, fileName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}`));
    }
  }
});

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }

  try {
    const fileName = req.file.filename;
    const relativeUrl = `assets/images/${fileName}`;

    // Auto-commit and push to GitHub (async, don't wait)
    gitPushAsync(fileName);

    res.json({
      success: true,
      fileName,
      url: `/${relativeUrl}`,
      message: `✓ "${req.file.originalname}" uploaded as "${fileName}"`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uploadDir, time: new Date().toISOString() });
});

// List uploaded images
app.get('/api/images', (req, res) => {
  try {
    const files = fs.readdirSync(uploadDir);
    const images = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    res.json({ success: true, images });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Async git push (non-blocking)
function gitPushAsync(fileName) {
  setImmediate(() => {
    try {
      const gitDir = __dirname;

      // Only push if git is configured
      try {
        execSync('git config user.email', { cwd: gitDir, stdio: 'pipe' });
      } catch {
        console.log('⚠️  Git not configured, skipping auto-push');
        return;
      }

      // Add, commit, and push
      execSync(`git add assets/images/${fileName}`, { cwd: gitDir });
      execSync(`git commit -m "upload: ${fileName}"`, { cwd: gitDir });
      execSync('git push origin main', { cwd: gitDir });

      console.log(`✓ ${fileName} pushed to GitHub`);
    } catch (err) {
      console.error(`⚠️  Git push failed for ${fileName}:`, err.message);
    }
  });
}

app.listen(PORT, () => {
  console.log(`\n🖼️  Image Upload Server`);
  console.log(`📁 Upload directory: ${uploadDir}`);
  console.log(`🚀 Server running: http://localhost:${PORT}`);
  console.log(`📤 Upload endpoint: POST http://localhost:${PORT}/api/upload\n`);
});
