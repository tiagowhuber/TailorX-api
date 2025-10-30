import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// Use /tmp directory for serverless environments (Vercel, AWS Lambda)
// Local development will use uploads directory
// WARNING: In serverless, /tmp is ephemeral - files are lost after function execution
// For production, consider using cloud storage (S3, Cloudinary, Vercel Blob, etc.)
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const uploadDir = isServerless 
  ? '/tmp/uploads/profile-pictures'
  : path.join(__dirname, '../../uploads/profile-pictures');

// Ensure uploads directory exists (lazy initialization)
const ensureUploadDir = () => {
  if (!fs.existsSync(uploadDir)) {
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
    } catch (error) {
      console.warn('Could not create upload directory:', error);
    }
  }
};

// Configure storage
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    // Ensure directory exists before upload
    ensureUploadDir();
    cb(null, uploadDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    // Generate unique filename: userId_timestamp_randomstring.ext
    const userId = req.params.id;
    const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `user_${userId}_${uniqueSuffix}${ext}`);
  }
});

// File filter to accept only images
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
  }
};

// Configure multer
export const uploadProfilePicture = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB max file size
  }
});

// Helper function to delete old profile picture
export const deleteProfilePicture = (filePath: string): void => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  }
};

// Helper to get full path from URL
export const getFilePathFromUrl = (url: string): string => {
  if (!url) return '';
  
  // Extract filename from URL (e.g., /uploads/profile-pictures/user_1_123456.jpg)
  const filename = url.split('/').pop() || '';
  return path.join(uploadDir, filename);
};
