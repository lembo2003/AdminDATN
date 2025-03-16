/**
 * File upload middleware using multer
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { generateRandomString } = require('../utils/helpers');

// Ensure upload directories exist
const createUploadDirectories = () => {
  const uploadDirs = [
    path.join(__dirname, '../public/uploads'),
    path.join(__dirname, '../public/uploads/rooms'),
    path.join(__dirname, '../public/uploads/menu'),
    path.join(__dirname, '../public/uploads/staff'),
    path.join(__dirname, '../public/uploads/users')
  ];
  
  uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Create directories on startup
createUploadDirectories();

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = path.join(__dirname, '../public/uploads');
    
    // Determine upload directory based on route
    if (req.originalUrl.includes('/rooms')) {
      uploadPath = path.join(__dirname, '../public/uploads/rooms');
    } else if (req.originalUrl.includes('/menu') || req.originalUrl.includes('/order-items')) {
      uploadPath = path.join(__dirname, '../public/uploads/menu');
    } else if (req.originalUrl.includes('/staff')) {
      uploadPath = path.join(__dirname, '../public/uploads/staff');
    } else if (req.originalUrl.includes('/users')) {
      uploadPath = path.join(__dirname, '../public/uploads/users');
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = `${Date.now()}-${generateRandomString(6)}`;
    const extname = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${extname}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Accept only images
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

/**
 * Convert file path to URL
 * @param {string} filepath - File path
 * @returns {string} File URL
 */
const filePathToUrl = (filepath) => {
  if (!filepath) return null;
  
  // Convert path to URL format
  const publicDir = path.join(__dirname, '../public');
  return filepath.replace(publicDir, '').replace(/\\/g, '/');
};

/**
 * Generate URL for uploaded file
 * @param {Object} req - Express request object
 * @returns {function} Middleware
 */
const processUploadedFile = (req, res, next) => {
  if (req.file) {
    // Add file URL to request object
    req.fileUrl = `/uploads/${path.basename(req.file.path)}`;
  }
  next();
};

/**
 * Handle file upload errors
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {function} next - Express next function
 */
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Multer error
    if (err.code === 'LIMIT_FILE_SIZE') {
      req.flash('error_msg', 'File too large. Maximum size is 5MB.');
    } else {
      req.flash('error_msg', `Upload error: ${err.message}`);
    }
    return res.redirect('back');
  } else if (err) {
    // Other errors
    req.flash('error_msg', err.message || 'Error processing file upload');
    return res.redirect('back');
  }
  next();
};

module.exports = {
  upload,
  processUploadedFile,
  handleUploadError,
  filePathToUrl
};