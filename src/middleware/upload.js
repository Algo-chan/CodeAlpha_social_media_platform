const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isCloudinaryConfigured } = require('../utils/cloudinary');

const uploadsDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const memoryStorage = multer.memoryStorage();

const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
    error.status = 400;
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

const limits = {
  fileSize: 5 * 1024 * 1024, // 5MB limit
};

const diskUpload = multer({
  storage: diskStorage,
  limits,
  fileFilter,
});

const memoryUpload = multer({
  storage: memoryStorage,
  limits,
  fileFilter,
});

/**
 * Express middleware wrapper for single image upload with normalized error handling.
 * Dynamically selects memoryStorage when Cloudinary is configured, otherwise falls back to diskStorage.
 */
function uploadPostMedia(req, res, next) {
  const uploader = isCloudinaryConfigured() ? memoryUpload : diskUpload;
  const singleUpload = uploader.single('image');

  singleUpload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: {
              message: 'File size exceeds maximum limit of 5MB',
              code: 'FILE_TOO_LARGE',
            },
          });
        }
        return res.status(400).json({
          success: false,
          error: {
            message: err.message,
            code: err.code || 'UPLOAD_ERROR',
          },
        });
      }

      return res.status(err.status || 400).json({
        success: false,
        error: {
          message: err.message || 'File upload failed',
          code: err.code || 'INVALID_FILE',
        },
      });
    }

    next();
  });
}

module.exports = {
  upload: diskUpload,
  uploadPostMedia,
};
