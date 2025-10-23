import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  loginUser,
  registerUser,
  logoutUser,
  getCurrentUser,
  refreshToken,
  googleAuth,
} from '../controllers/authController';

const router = Router();

// POST /auth/login - User login (public)
router.post('/login', loginUser);

// POST /auth/register - User registration (public)
router.post('/register', registerUser);

// POST /auth/google - Google OAuth login (public)
router.post('/google', googleAuth);

// POST /auth/logout - User logout (protected)
router.post('/logout', authenticateToken, logoutUser);

// GET /auth/me - Get current user (protected)
router.get('/me', authenticateToken, getCurrentUser);

// POST /auth/refresh - Refresh JWT token (protected)
router.post('/refresh', authenticateToken, refreshToken);

export default router;