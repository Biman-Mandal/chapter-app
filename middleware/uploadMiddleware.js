const multer = require("multer");
const path = require("path");
const fs = require("fs");

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  // Accept images, videos, and audio only
  const mime = file.mimetype || "";
  if (mime.startsWith("image/") || mime.startsWith("video/") || mime.startsWith("audio/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image, video and audio files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    // allow up to 200MB per file (adjust if needed)
    fileSize: 200 * 1024 * 1024,
  },
});

module.exports = upload;