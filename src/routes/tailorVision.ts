import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { generateMeasurements, upload } from '../controllers/tailorVisionController';

const router = Router();

// POST /tailor-vision/generate - Generate measurements from images
router.post(
  '/generate', 
  authenticateToken, 
  upload.fields([
    { name: 'front_image', maxCount: 1 }, 
    { name: 'side_image', maxCount: 1 }
  ]), 
  generateMeasurements
);

export default router;
