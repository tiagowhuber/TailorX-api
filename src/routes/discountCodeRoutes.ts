import { Router } from 'express';
import { 
    validateDiscountCode, 
    getUserDiscountCodes, 
    getAllDiscountCodes, 
    createDiscountCode, 
    assignDiscountCodeToUser 
} from '../controllers/discountCodeController';
import { authenticateToken } from '../middleware/auth'; // Assuming auth middleware exists

const router = Router();

// Public routes (or partially protected)
router.post('/validate', validateDiscountCode);

// Protected routes
router.get('/user/:userId', authenticateToken, getUserDiscountCodes);
router.post('/assign', authenticateToken, assignDiscountCodeToUser);
router.get('/admin/all', authenticateToken, getAllDiscountCodes); // Should probably have admin check
router.post('/create', authenticateToken, createDiscountCode); // Should probably have admin check

export default router;
