import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getUserAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from '../controllers/userAddressController';

const router = Router();

// GET /user-addresses - Get all addresses for the authenticated user
router.get('/', authenticateToken, getUserAddresses);

// POST /user-addresses - Create a new address
router.post('/', authenticateToken, createAddress);

// PUT /user-addresses/:id - Update an address
router.put('/:id', authenticateToken, updateAddress);

// DELETE /user-addresses/:id - Delete an address
router.delete('/:id', authenticateToken, deleteAddress);

export default router;
