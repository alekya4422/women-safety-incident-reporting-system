import multer from 'multer';

// Use memory storage so we can validate file signature and strip EXIF before writing to disk
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 3 // Max 3 images
  },
  fileFilter: (req, file, cb) => {
    // Basic preliminary mime check (server validates magic bytes strictly in service)
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
    }
  }
});

export default upload;
