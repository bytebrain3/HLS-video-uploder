import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define upload directory
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folderId = "default"; // Use the folderId passed from `uploadVideo`
    const folderPath = path.join(uploadDir, folderId);

    // Create folder if it doesn't exist
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }

    cb(null, folderPath); // Set the upload destination
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname); // Save with the original filename
  },
});

// File filter to accept both images and videos
const fileFilter = (req, file, cb) => {
  // Accept image MIME types
  const imageMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
  ];

  // Accept video MIME types
  const videoMimeTypes = [
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/avi",
    "video/x-msvideo",
    "video/x-matroska",
  ];

  if (imageMimeTypes.includes(file.mimetype) || videoMimeTypes.includes(file.mimetype)) {
    cb(null, true); // Accept the file
  } else {
    cb(new Error("Invalid file type. Only image and video files are allowed."), false); // Reject the file
  }
};

// Configure multer with storage and file filter
const upload = multer({ storage, fileFilter });

export { upload };
