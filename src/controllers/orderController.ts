import { Request, Response } from 'express';
import { Order, OrderItem, OrderStatusHistory, User, Pattern } from '../models';

export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const { userId, status } = req.query;
    
    const whereClause: any = {};
    if (userId) whereClause.user_id = userId;
    if (status) whereClause.status = status;

    const orders = await Order.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name'],
        },
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Pattern,
              as: 'pattern',
              attributes: ['id', 'name', 'status'],
            },
          ],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    res.json({
      success: true,
      data: orders,
      count: orders.length,
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getOrdersByUserId = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const orders = await Order.findAll({
      where: { user_id: userId },
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Pattern,
              as: 'pattern',
              attributes: ['id', 'name', 'status'],
            },
          ],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    res.json({
      success: true,
      data: orders,
      count: orders.length,
    });
  } catch (error) {
    console.error('Get orders by user ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const order = await Order.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name'],
        },
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Pattern,
              as: 'pattern',
              attributes: ['id', 'name', 'status'],
            },
          ],
        },
        {
          model: OrderStatusHistory,
          as: 'statusHistory',
          order: [['created_at', 'DESC']],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Get order by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const createOrder = async (req: Request, res: Response) => {
  try {
    const { user_id, order_number, total_amount, shipping_address } = req.body;

    // Validate required fields
    if (!user_id || !total_amount) {
      return res.status(400).json({
        success: false,
        message: 'User ID and total amount are required',
      });
    }

    // Check if user exists
    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Generate order number if not provided
    const generatedOrderNumber = order_number || `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Check if order number is unique
    if (order_number) {
      const existingOrder = await Order.findOne({ where: { order_number } });
      if (existingOrder) {
        return res.status(400).json({
          success: false,
          message: 'Order number already exists',
        });
      }
    }

    const order = await Order.create({
      user_id,
      order_number: generatedOrderNumber,
      total_amount,
      shipping_address,
      status: 'pending',
    });

    // Create initial status history entry
    await OrderStatusHistory.create({
      order_id: order.id,
      status: 'pending',
      notes: 'Order created',
    });

    // Fetch the created order with includes
    const createdOrder = await Order.findByPk(order.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name'],
        },
        {
          model: OrderStatusHistory,
          as: 'statusHistory',
          order: [['created_at', 'DESC']],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: createdOrder,
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const updateOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { total_amount, shipping_address } = req.body;

    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Check if order can be updated (not cancelled or completed)
    if (order.status === 'cancelled' || order.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update cancelled or completed orders',
      });
    }

    // Prepare update data
    const updateData: any = {};
    if (total_amount !== undefined) updateData.total_amount = total_amount;
    if (shipping_address !== undefined) updateData.shipping_address = shipping_address;

    await order.update(updateData);

    // Fetch the updated order with includes
    const updatedOrder = await Order.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name'],
        },
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Pattern,
              as: 'pattern',
              attributes: ['id', 'name', 'status'],
            },
          ],
        },
      ],
    });

    res.json({
      success: true,
      message: 'Order updated successfully',
      data: updatedOrder,
    });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Order is already cancelled',
      });
    }

    if (order.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel completed orders',
      });
    }

    await order.update({ status: 'cancelled' });

    // Create status history entry
    await OrderStatusHistory.create({
      order_id: order.id,
      status: 'cancelled',
      notes: reason || 'Order cancelled',
    });

    res.json({
      success: true,
      message: 'Order cancelled successfully',
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getOrderItems = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if order exists
    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const orderItems = await OrderItem.findAll({
      where: { order_id: id },
      include: [
        {
          model: Pattern,
          as: 'pattern',
          attributes: ['id', 'name', 'status'],
        },
      ],
      order: [['created_at', 'ASC']],
    });

    res.json({
      success: true,
      data: orderItems,
      count: orderItems.length,
    });
  } catch (error) {
    console.error('Get order items error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const addOrderItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { pattern_id, quantity, price } = req.body;

    // Validate required fields
    if (!pattern_id || price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Pattern ID and price are required',
      });
    }

    // Check if order exists
    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Check if order can be modified
    if (order.status === 'cancelled' || order.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify cancelled or completed orders',
      });
    }

    // Check if pattern exists
    const pattern = await Pattern.findByPk(pattern_id);
    if (!pattern) {
      return res.status(404).json({
        success: false,
        message: 'Pattern not found',
      });
    }

    const orderItem = await OrderItem.create({
      order_id: parseInt(id!),
      pattern_id,
      quantity,
      price,
    });

    // Fetch the created item with includes
    const createdItem = await OrderItem.findByPk(orderItem.id, {
      include: [
        {
          model: Pattern,
          as: 'pattern',
          attributes: ['id', 'name', 'status'],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: 'Order item added successfully',
      data: createdItem,
    });
  } catch (error) {
    console.error('Add order item error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const updateOrderItem = async (req: Request, res: Response) => {
  try {
    const { id, itemId } = req.params;
    const { quantity, price } = req.body;

    // Check if order exists
    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Check if order can be modified
    if (order.status === 'cancelled' || order.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify cancelled or completed orders',
      });
    }

    const orderItem = await OrderItem.findOne({
      where: { id: itemId, order_id: id }
    });

    if (!orderItem) {
      return res.status(404).json({
        success: false,
        message: 'Order item not found',
      });
    }

    // Prepare update data
    const updateData: any = {};
    if (quantity !== undefined) updateData.quantity = quantity;
    if (price !== undefined) updateData.price = price;

    await orderItem.update(updateData);

    // Fetch the updated item with includes
    const updatedItem = await OrderItem.findByPk(itemId, {
      include: [
        {
          model: Pattern,
          as: 'pattern',
          attributes: ['id', 'name', 'status'],
        },
      ],
    });

    res.json({
      success: true,
      message: 'Order item updated successfully',
      data: updatedItem,
    });
  } catch (error) {
    console.error('Update order item error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const removeOrderItem = async (req: Request, res: Response) => {
  try {
    const { id, itemId } = req.params;

    // Check if order exists
    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Check if order can be modified
    if (order.status === 'cancelled' || order.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify cancelled or completed orders',
      });
    }

    const orderItem = await OrderItem.findOne({
      where: { id: itemId, order_id: id }
    });

    if (!orderItem) {
      return res.status(404).json({
        success: false,
        message: 'Order item not found',
      });
    }

    await orderItem.destroy();

    res.json({
      success: true,
      message: 'Order item removed successfully',
    });
  } catch (error) {
    console.error('Remove order item error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    // Validate required fields
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required',
      });
    }

    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Validate status transition
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
      });
    }

    const oldStatus = order.status;
    await order.update({ status });

    // Create status history entry
    await OrderStatusHistory.create({
      order_id: order.id,
      status,
      notes: notes || `Status changed from ${oldStatus} to ${status}`,
    });

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: order,
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getOrderStatusHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if order exists
    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const statusHistory = await OrderStatusHistory.findAll({
      where: { order_id: id },
      order: [['created_at', 'DESC']],
    });

    res.json({
      success: true,
      data: statusHistory,
      count: statusHistory.length,
    });
  } catch (error) {
    console.error('Get order status history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getOrderByNumber = async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    
    const order = await Order.findOne({
      where: { order_number: orderNumber },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name'],
        },
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Pattern,
              as: 'pattern',
              attributes: ['id', 'name', 'status'],
            },
          ],
        },
        {
          model: OrderStatusHistory,
          as: 'statusHistory',
          order: [['created_at', 'DESC']],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found with this order number',
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Get order by number error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getOrdersByStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.params;

    const orders = await Order.findAll({
      where: { status },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name'],
        },
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Pattern,
              as: 'pattern',
              attributes: ['id', 'name', 'status'],
            },
          ],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    res.json({
      success: true,
      data: orders,
      count: orders.length,
    });
  } catch (error) {
    console.error('Get orders by status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};