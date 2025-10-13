import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getAllOrders,
  getOrdersByUserId,
  getOrderById,
  createOrder,
  updateOrder,
  cancelOrder,
  getOrderItems,
  addOrderItem,
  updateOrderItem,
  removeOrderItem,
  updateOrderStatus,
  getOrderStatusHistory,
  getOrderByNumber,
  getOrdersByStatus,
} from '../controllers/orderController';

const router = Router();

// GET /orders - Get all orders (with optional user and status filters) (protected)
router.get('/', authenticateToken, getAllOrders);

// GET /orders/user/:userId - Get all orders for a specific user (protected)
router.get('/user/:userId', authenticateToken, getOrdersByUserId);

// GET /orders/number/:orderNumber - Get order by order number (protected)
router.get('/number/:orderNumber', authenticateToken, getOrderByNumber);

// GET /orders/status/:status - Get orders by status (protected)
router.get('/status/:status', authenticateToken, getOrdersByStatus);

// GET /orders/:id - Get order by ID (protected)
router.get('/:id', authenticateToken, getOrderById);

// POST /orders - Create new order (protected)
router.post('/', authenticateToken, createOrder);

// PUT /orders/:id - Update order (protected)
router.put('/:id', authenticateToken, updateOrder);

// DELETE /orders/:id - Cancel order (soft delete by setting status to cancelled) (protected)
router.delete('/:id', authenticateToken, cancelOrder);

// GET /orders/:id/items - Get order items for an order (protected)
router.get('/:id/items', authenticateToken, getOrderItems);

// POST /orders/:id/items - Add item to order (protected)
router.post('/:id/items', authenticateToken, addOrderItem);

// PUT /orders/:id/items/:itemId - Update order item (protected)
router.put('/:id/items/:itemId', authenticateToken, updateOrderItem);

// DELETE /orders/:id/items/:itemId - Remove item from order (protected)
router.delete('/:id/items/:itemId', authenticateToken, removeOrderItem);

// PUT /orders/:id/status - Update order status (protected)
router.put('/:id/status', authenticateToken, updateOrderStatus);

// GET /orders/:id/status-history - Get order status history (protected)
router.get('/:id/status-history', authenticateToken, getOrderStatusHistory);

export default router;