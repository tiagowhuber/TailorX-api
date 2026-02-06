import { Request, Response } from 'express';
import { Order, OrderItem, Pattern, Design, User, DiscountCode, UserDiscountCodeRedemption, sequelize } from '../models';
import { validateDiscountCodeLogic } from '../services/discountService';

export const createPayment = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const { user_id, cart, discountCode } = req.body; // cart should be array of items

    if (!user_id || !cart || !Array.isArray(cart) || cart.length === 0) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Invalid payment request' });
    }

    // 1. Validate User
    const user = await User.findByPk(user_id);
    if (!user) {
        await t.rollback();
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    // 2. Validate Items & Prices (Server-side calculation)
    let calculatedSubtotal = 0;
    const orderItemsData = [];
    const designCache: Record<number, Design> = {};

    for (const item of cart) {
        // item should have patternId
        const pattern = await Pattern.findByPk(item.patternId, {
            include: [{ model: Design, as: 'design' }]
        });

        if (!pattern) {
             await t.rollback();
             return res.status(404).json({ success: false, message: `Pattern ${item.patternId} not found` });
        }

        // Price logic: Pattern price usually comes from Design base_price
        // In TailorX, Pattern might not have price column, Design has base_price
        let price = 0;
        if (pattern.design) {
            price = Number(pattern.design.base_price);
        }
        
        // Use quantity from cart or default to 1
        const quantity = item.quantity || 1;
        calculatedSubtotal += price * quantity;

        orderItemsData.push({
            pattern_id: pattern.id,
            quantity,
            price
        });
        
        // Enrich item for discount validation (needs design info)
        item.design_id = pattern.design_id;
        item.price = price; // Ensure price is trusted from server
    }

    // 3. Handle Discount
    let discountAmount = 0;
    let finalCodeId: number | null = null;
    let finalAmount = calculatedSubtotal;
    
    if (discountCode) {
         const validation = await validateDiscountCodeLogic(discountCode, user_id, cart);
         
         if (validation.isValid) {
             discountAmount = validation.discountAmount || 0;
             finalCodeId = validation.discountCode?.id ?? null;
         } else {
             // If validation fails but code was provided, return error
             await t.rollback();
             return res.status(400).json({ success: false, message: validation.message });
         }
    }
    
    finalAmount = Math.max(0, calculatedSubtotal - discountAmount);
    
    // Generate Order Number
    const orderNumber = `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // 4. Create Order
    const order = await Order.create({
        user_id,
        order_number: orderNumber,
        status: 'pending',
        total_amount: calculatedSubtotal, // Original subtotal
        discount_code_id: finalCodeId,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        shipping_address: 'TBD' // Should be passed or defaulted
    }, { transaction: t });

    // 5. Create Order Items
    for (const itemData of orderItemsData) {
        await OrderItem.create({
            order_id: order.id,
            pattern_id: itemData.pattern_id,
            quantity: itemData.quantity,
            price: itemData.price
        }, { transaction: t });
    }

    // 6. Log Redemption & Update Stats
    if (finalCodeId) {
       await UserDiscountCodeRedemption.create({
          user_id,
          discount_code_id: finalCodeId,
          order_id: order.id
       }, { transaction: t });
       
       const codeToUpdate = await DiscountCode.findByPk(finalCodeId, { transaction: t });
       if (codeToUpdate) {
           await codeToUpdate.increment('current_total_uses', { by: 1, transaction: t });
       }
    }

    await t.commit();

    // 7. Return Response (Mock Webpay or success)
    res.json({
        success: true,
        data: {
            orderId: order.id,
            orderNumber: order.order_number,
            // Mocking a redirect flow or direct success
            url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/confirm-mock?token=mock_${order.id}`,
            token: `mock_token_${order.id}`,
            amount: finalAmount
        }
    });

  } catch (error) {
    await t.rollback();
    console.error('Create payment error:', error);
    res.status(500).json({ success: false, message: 'Internal server error processing payment' });
  }
};

export const confirmPayment = async (req: Request, res: Response) => {
    // Mock confirmation
    try {
        const { token } = req.params;
        // In real flow, token used to query Webpay
        // Extract orderId from mock token
        if (!token) {
            return res.status(400).json({ success: false, message: 'Token required' });
        }
        const orderIdStr = token.replace('mock_token_', '');
        const orderId = parseInt(orderIdStr);

        if (isNaN(orderId)) {
             return res.status(400).json({ success: false, message: 'Invalid token' });
        }

        const order = await Order.findByPk(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Update status
        await order.update({ status: 'completed' }); // Or 'processing'

        res.json({
            success: true,
            data: {
                status: 'AUTHORIZED',
                orderId: order.id,
                orderNumber: order.order_number,
                amount: order.final_amount || order.total_amount,
                transaction_date: new Date()
            }
        });

    } catch (error) {
        console.error('Confirm payment error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const getPaymentStatus = async (req: Request, res: Response) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findByPk(orderId);
        
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        res.json({
            success: true,
            data: {
                orderId: order.id,
                orderNumber: order.order_number,
                status: order.status === 'completed' ? 'confirmed' : 'pending',
                paymentStatus: order.status === 'completed' ? 'AUTHORIZED' : 'PENDING',
                paymentMethod: 'webpay',
                totalAmount: order.final_amount || order.total_amount,
                createdAt: order.created_at
            }
        });
    } catch (error) {
        console.error('Get payment status error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
