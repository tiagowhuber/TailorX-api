import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { uploadProfilePicture } from '../middleware/upload';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  uploadUserProfilePicture,
  deleteUserProfilePicture,
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

// POST /users/:id/profile-picture - Upload profile picture (protected)
router.post(
  '/:id/profile-picture',
  authenticateToken,
  uploadProfilePicture.single('profile_picture'),
  uploadUserProfilePicture
);

// DELETE /users/:id/profile-picture - Delete profile picture (protected)
router.delete('/:id/profile-picture', authenticateToken, deleteUserProfilePicture);

export default router;