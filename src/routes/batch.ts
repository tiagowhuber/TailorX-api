import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { batchGenerate } from '../controllers/batchController';

const router = Router();

// POST /batch/generate - Generate patterns for multiple persons and designs, returns ZIP of PLT files
router.post('/generate', authenticateToken, batchGenerate);

export default router;
