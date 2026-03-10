import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { createPayment, getPaymentState, getPaymentByOrderId } from '../controllers/paymentController';

const router = express.Router();

/**
 * POST /api/payments/create
 * Create a new payment transaction
 */
router.post('/create', authenticateToken, createPayment);

/**
 * PUT /api/payments/confirm/:token
 * Confirm payment status with Transbank
 */
router.put('/confirm/:token', getPaymentState);

/**
 * GET /api/payments/order/:orderId
 * Get payment status by order ID
 */
router.get('/order/:orderId', authenticateToken, getPaymentByOrderId);

export default router;
