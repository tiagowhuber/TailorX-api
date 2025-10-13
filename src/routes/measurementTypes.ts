import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getAllMeasurementTypes,
  getMeasurementTypeById,
  createMeasurementType,
  updateMeasurementType,
  deleteMeasurementType,
  getMeasurementTypeByFreeSewingKey,
} from '../controllers/measurementTypeController';

const router = Router();

// GET /measurement-types - Get all measurement types (public)
router.get('/', getAllMeasurementTypes);

// GET /measurement-types/freesewing/:key - Get measurement type by FreeSewing key (public)
router.get('/freesewing/:key', getMeasurementTypeByFreeSewingKey);

// GET /measurement-types/:id - Get measurement type by ID (public)
router.get('/:id', getMeasurementTypeById);

// POST /measurement-types - Create new measurement type (protected)
router.post('/', authenticateToken, createMeasurementType);

// PUT /measurement-types/:id - Update measurement type (protected)
router.put('/:id', authenticateToken, updateMeasurementType);

// DELETE /measurement-types/:id - Delete measurement type (protected)
router.delete('/:id', authenticateToken, deleteMeasurementType);

export default router;