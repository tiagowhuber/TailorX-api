import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getAllDesigns,
  getDesignById,
  createDesign,
  updateDesign,
  deleteDesign,
  getDesignMeasurements,
  addDesignMeasurement,
  removeDesignMeasurement,
  getDesignByFreeSewingPattern,
  getActiveDesigns,
} from '../controllers/designController';

const router = Router();

// GET /designs - Get all designs (with optional active filter) (public)
router.get('/', getAllDesigns);

// GET /designs/active - Get only active designs (public)
router.get('/active', getActiveDesigns);

// GET /designs/freesewing/:pattern - Get design by FreeSewing pattern name (public)
router.get('/freesewing/:pattern', getDesignByFreeSewingPattern);

// GET /designs/:id - Get design by ID (public)
router.get('/:id', getDesignById);

// POST /designs - Create new design (protected)
router.post('/', authenticateToken, createDesign);

// PUT /designs/:id - Update design (protected)
router.put('/:id', authenticateToken, updateDesign);

// DELETE /designs/:id - Delete design (soft delete by setting is_active to false) (protected)
router.delete('/:id', authenticateToken, deleteDesign);

// GET /designs/:id/measurements - Get required measurements for a design (public)
router.get('/:id/measurements', getDesignMeasurements);

// POST /designs/:id/measurements - Add required measurement to design (protected)
router.post('/:id/measurements', authenticateToken, addDesignMeasurement);

// DELETE /designs/:id/measurements/:measurementTypeId - Remove required measurement from design (protected)
router.delete('/:id/measurements/:measurementTypeId', authenticateToken, removeDesignMeasurement);

export default router;