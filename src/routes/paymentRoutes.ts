import { Router } from 'express';
import { createPayment, getPaymentState, getPaymentByOrderId } from '../controllers/paymentController';
import { authenticateToken } from '../middleware/auth'; 

const router = Router();

// Routes
router.post('/create', authenticateToken, createPayment);
router.put('/confirm/:token', getPaymentState); // Public callback usually
router.get('/order/:orderId', authenticateToken, getPaymentByOrderId);

export default router;
