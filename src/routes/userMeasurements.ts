import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getAllUserMeasurements,
  getUserMeasurementsByUserId,
  getUserMeasurementById,
  createUserMeasurement,
  updateUserMeasurement,
  deleteUserMeasurement,
  batchCreateUpdateUserMeasurements,
  getUserMeasurementByUserAndType,
} from '../controllers/userMeasurementController';

const router = Router();

// GET /user-measurements - Get all user measurements (with optional user filter) (protected)
router.get('/', authenticateToken, getAllUserMeasurements);

// GET /user-measurements/user/:userId - Get all measurements for a specific user (protected)
router.get('/user/:userId', authenticateToken, getUserMeasurementsByUserId);

// GET /user-measurements/user/:userId/type/:typeId - Get specific measurement for user by type (protected)
router.get('/user/:userId/type/:typeId', authenticateToken, getUserMeasurementByUserAndType);

// POST /user-measurements/batch - Create or update multiple measurements for a user (protected)
router.post('/batch', authenticateToken, batchCreateUpdateUserMeasurements);

// GET /user-measurements/:id - Get specific user measurement by ID (protected)
router.get('/:id', authenticateToken, getUserMeasurementById);

// POST /user-measurements - Create new user measurement (protected)
router.post('/', authenticateToken, createUserMeasurement);

// PUT /user-measurements/:id - Update user measurement (protected)
router.put('/:id', authenticateToken, updateUserMeasurement);

// DELETE /user-measurements/:id - Delete user measurement (protected)
router.delete('/:id', authenticateToken, deleteUserMeasurement);

export default router;