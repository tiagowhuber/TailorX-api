import { Router } from 'express';
import { createPayment, confirmPayment, getPaymentStatus } from '../controllers/paymentController';
import { authenticateToken } from '../middleware/auth'; 

const router = Router();

// Routes
router.post('/create', authenticateToken, createPayment);
router.put('/confirm/:token', confirmPayment); // Public callback usually
router.get('/order/:orderId', authenticateToken, getPaymentStatus);

export default router;
