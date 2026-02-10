import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { createPayment, getPaymentStatus, confirmPayment } from '../controllers/paymentController';

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
router.put('/confirm/:token', confirmPayment);

/**
 * GET /api/payments/status/:orderId
 * Get payment status by order ID
 */
router.get('/status/:orderId', authenticateToken, getPaymentStatus);

export default router;
