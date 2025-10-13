import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getAllPatterns,
  getPatternsByUserId,
  getPatternById,
  createPattern,
  updatePattern,
  deletePattern,
  getPatternSvg,
  generatePattern,
  finalizePattern,
  archivePattern,
  getPatternsByDesignId,
  getPatternsByStatus,
} from '../controllers/patternController';

const router = Router();

// GET /patterns - Get all patterns (with optional user and status filters) (protected)
router.get('/', authenticateToken, getAllPatterns);

// GET /patterns/user/:userId - Get all patterns for a specific user (protected)
router.get('/user/:userId', authenticateToken, getPatternsByUserId);

// GET /patterns/design/:designId - Get all patterns for a specific design (protected)
router.get('/design/:designId', authenticateToken, getPatternsByDesignId);

// GET /patterns/status/:status - Get patterns by status (protected)
router.get('/status/:status', authenticateToken, getPatternsByStatus);

// POST /patterns/generate - Generate new pattern from design and measurements (protected)
router.post('/generate', authenticateToken, generatePattern);

// GET /patterns/:id - Get pattern by ID (protected)
router.get('/:id', authenticateToken, getPatternById);

// POST /patterns - Create new pattern (generate from design and measurements) (protected)
router.post('/', authenticateToken, createPattern);

// PUT /patterns/:id - Update pattern (name, status, etc.) (protected)
router.put('/:id', authenticateToken, updatePattern);

// DELETE /patterns/:id - Delete pattern (protected)
router.delete('/:id', authenticateToken, deletePattern);

// GET /patterns/:id/svg - Get SVG data for pattern (protected)
router.get('/:id/svg', authenticateToken, getPatternSvg);

// PUT /patterns/:id/finalize - Finalize pattern (change status to finalized) (protected)
router.put('/:id/finalize', authenticateToken, finalizePattern);

// PUT /patterns/:id/archive - Archive pattern (change status to archived) (protected)
router.put('/:id/archive', authenticateToken, archivePattern);

export default router;