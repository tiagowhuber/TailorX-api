import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/userController';

const router = Router();

// GET /users - Get all users (protected)
router.get('/', authenticateToken, getAllUsers);

// GET /users/:id - Get user by ID (protected)
router.get('/:id', authenticateToken, getUserById);

// POST /users - Create new user (protected)
router.post('/', authenticateToken, createUser);

// PUT /users/:id - Update user (protected)
router.put('/:id', authenticateToken, updateUser);

// DELETE /users/:id - Delete user (protected)
router.delete('/:id', authenticateToken, deleteUser);

export default router;