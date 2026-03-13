import { Request, Response } from 'express';
import Order from '../models/Order';
import OrderItem from '../models/OrderItem';
import OrderStatusHistory from '../models/OrderStatusHistory';
import User from '../models/User';
import Pattern from '../models/Pattern';
import Design from '../models/Design';
import OrderedPattern from '../models/OrderedPattern';
import DiscountCode from '../models/DiscountCode';
import UserDiscountCodeRedemption from '../models/UserDiscountCodeRedemption';
import { generateFreeSewingPattern, cleanMirroredSvg } from '../utils/freesewing';
import { validateDiscountCodeLogic } from '../services/discountService';

const TBK_URL = process.env.TRANSBANK_API_URL || 'https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions';
const TBK_ID = process.env.TRANSBANK_COMMERCE_CODE || '';
const TBK_SECRET = process.env.TRANSBANK_API_KEY || '';
const SKIP_PAY = process.env.SKIP_PAY === 'true';

interface CartItem {
  patternId: number;
  patternName: string;
  designId: number;
  designName: string;
  price: number;
  quantity: number;
  status: string;
  addedAt: string;
  imageUrl?: string;
}

/**
 * Create a new payment transaction with Transbank
 */
export const createPayment = async (req: Request, res: Response) => {
  console.log("Creating payment with body:", req.body);
  const { cart, user_id, return_url, subtotal, discountCode } = req.body;
  
  if (!cart || cart.length <= 0 || !Array.isArray(cart)) {
    return res.status(400).json({ 
      success: false,
      message: "Cart is empty or invalid" 
    });
  }

  if (!user_id) {
    return res.status(400).json({ 
      success: false,
      message: "User ID is required" 
    });
  }

  if (!subtotal || subtotal <= 0) {
    return res.status(400).json({ 
      success: false,
      message: "Invalid subtotal amount" 
    });
  }

  try {
    // Verify user exists
    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    // Verify all patterns exist and are valid
    const patternIds = cart.map((item: CartItem) => item.patternId);
    const patterns = await Pattern.findAll({
      where: { id: patternIds }
    });

    if (patterns.length !== patternIds.length) {
      return res.status(404).json({ 
        success: false,
        message: "Some patterns in cart were not found" 
      });
    }

    // Validate no archived patterns
    const archivedPatterns = patterns.filter(p => p.status === 'archived');
    if (archivedPatterns.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: "Cart contains archived patterns that cannot be purchased" 
      });
    }

    // Calculate total amount (rounded for CLP)
    const totalAmount = Math.round(subtotal);
    
    if (isNaN(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid final amount calculated" 
      });
    }

    // Validate and calculate discount if a code was provided
    let discountAmount = 0;
    let finalCodeId: number | null = null;

    if (discountCode) {
      const enrichedCart = cart.map((item: CartItem) => ({
        ...item,
        design_id: item.designId,
      }));

      const validation = await validateDiscountCodeLogic(discountCode, user_id, enrichedCart);

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: validation.message
        });
      }

      discountAmount = Math.round(validation.discountAmount || 0);
      finalCodeId = validation.discountCode?.id ?? null;
    }

    const finalAmount = Math.max(0, totalAmount - discountAmount);

    // Generate session ID (timestamp + random)
    const session_id = `session-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    // Create order with pending status
    const order = await Order.create({
      user_id: user_id,
      order_number: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      total_amount: totalAmount,
      discount_code_id: finalCodeId,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      status: 'pending',
      payment_status: 'pending',
      payment_method: 'webpay',
      session_id: session_id,
      payment_token: '',
      payment_url: ''
    });

    // Create order items from cart
    const orderItemsData = cart.map((item: CartItem) => ({
      order_id: order.id,
      pattern_id: item.patternId,
      quantity: item.quantity,
      price: item.price
    }));

    await OrderItem.bulkCreate(orderItemsData);

    // Create initial order status history
    await OrderStatusHistory.create({
      order_id: order.id,
      status: 'pending',
      notes: 'Order created, awaiting payment'
    });

    const buy_order = order.id.toString();

    // --- SKIP_PAY: bypass Transbank and auto-confirm for testing ---
    if (SKIP_PAY) {
      console.log('[SKIP_PAY] Skipping Transbank, auto-confirming order', order.id);

      await order.update({
        status: 'confirmed',
        payment_status: 'completed',
        transaction_id: buy_order,
        payment_token: `skip-pay-${buy_order}`,
        payment_url: ''
      });

      await OrderStatusHistory.create({
        order_id: order.id,
        status: 'confirmed',
        notes: '[SKIP_PAY] Payment auto-confirmed for testing'
      });

      // Run the same post-payment logic as AUTHORIZED
      try {
        const orderItems = await OrderItem.findAll({
          where: { order_id: order.id },
          include: [
            {
              model: Pattern,
              as: 'pattern',
              include: [{ model: Design, as: 'design' }]
            }
          ]
        });

        for (const item of orderItems) {
          const originalPattern = (item as any).pattern;
          if (originalPattern && originalPattern.design) {
            const newName = originalPattern.name && originalPattern.name.includes(order.order_number)
              ? originalPattern.name
              : `${originalPattern.name} - ${order.order_number}`;
            await originalPattern.update({ name: newName });

            const design = originalPattern.design;
            if (design.freesewing_pattern) {
              const mirroredPatternType = `${design.freesewing_pattern} mirrored`;
              try {
                let { svg: mirroredSvg } = await generateFreeSewingPattern({
                  patternType: mirroredPatternType,
                  measurements: originalPattern.measurements_used as any,
                  settings: originalPattern.settings_used as any,
                });
                mirroredSvg = cleanMirroredSvg(mirroredSvg);
                await OrderedPattern.create({
                  order_id: order.id,
                  pattern_id: originalPattern.id,
                  svg_normal: originalPattern.svg_data,
                  svg_mirrored: mirroredSvg
                });
              } catch (genError) {
                console.error(`[SKIP_PAY] Failed to generate admin copy for pattern ${originalPattern.id}:`, genError);
              }
            }
          }
        }
      } catch (adminActionError) {
        console.error('[SKIP_PAY] Error performing post-payment admin actions:', adminActionError);
      }

      if (order.discount_code_id) {
        try {
          await UserDiscountCodeRedemption.create({
            user_id: order.user_id,
            discount_code_id: order.discount_code_id,
            order_id: order.id
          });
          await DiscountCode.increment('current_total_uses', {
            by: 1,
            where: { id: order.discount_code_id }
          });
        } catch (redemptionError) {
          console.error(`[SKIP_PAY] Failed to record discount code redemption for order ${order.id}:`, redemptionError);
        }
      }

      return res.status(200).json({
        success: true,
        data: {
          token: `skip-pay-${buy_order}`,
          url: '',
          orderId: order.id,
          orderNumber: order.order_number,
          discountAmount,
          finalAmount,
          skip_pay: true
        }
      });
    }
    // --- END SKIP_PAY ---

    try {
      // Create Transbank transaction
      const response = await fetch(TBK_URL, {
        method: "POST",
        headers: {
          "Tbk-Api-Key-Id": TBK_ID,
          "Tbk-Api-Key-Secret": TBK_SECRET,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          buy_order: buy_order,
          session_id: session_id,
          amount: finalAmount,
          return_url: return_url || "http://localhost:5173/payment/confirmation",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Transbank API error:', errorText);
        throw new Error('Failed to create Transbank transaction');
      }

      const responseData = await response.json();
      
      // Update order with payment token and URL
      await order.update({
        payment_token: responseData.token,
        payment_url: responseData.url,
        transaction_id: buy_order
      });

      // Return response with order ID
      res.status(200).json({
        success: true,
        data: {
          ...responseData,
          orderId: order.id,
          discountAmount,
          finalAmount
        }
      });
    } catch (error: any) {
      console.error("Error in Transbank request:", error);
      
      // Update order status to failed
      await order.update({
        payment_status: 'failed',
        status: 'cancelled'
      });
      
      await OrderStatusHistory.create({
        order_id: order.id,
        status: 'cancelled',
        notes: `Payment creation failed: ${error.message}`
      });

      res.status(500).json({ 
        success: false,
        message: "Failed to process payment request",
        error: error.message 
      });
    }
  } catch (error: any) {
    console.error("Payment creation failed:", {
      requestBody: req.body,
      errorMessage: error.message,
      errorStack: error.stack,
    });
    res.status(500).json({ 
      success: false,
      message: "Failed to process payment request", 
      error: error.message 
    });
  }
};

/**
 * Get payment status from Transbank and update order
 */
export const getPaymentState = async (req: Request, res: Response) => {
  const token = req.params.token;
  
  if (!token) {
    return res.status(400).json({ 
      success: false,
      message: "Payment token is required" 
    });
  }

  try {
    // Confirm transaction with Transbank
    const response = await fetch(`${TBK_URL}/${token}`, {
      method: "PUT",
      headers: {
        "Tbk-Api-Key-Id": TBK_ID,
        "Tbk-Api-Key-Secret": TBK_SECRET,
        "Content-Type": "application/json",
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ 
          success: false,
          status: 'NOT_FOUND',
          message: 'Transaction not found in Transbank system' 
        });
      }
      const errorText = await response.text();
      console.error('Transbank status error:', errorText);
      throw new Error(`Transbank API returned status ${response.status}`);
    }

    const transbankData = await response.json();
    console.log("Transbank response:", transbankData);

    // Find order by transaction ID (buy_order)
    const order = await Order.findByPk(parseInt(transbankData.buy_order));
    
    if (!order) {
      return res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
    }

    try {
      // Update order based on payment status
      let orderStatus: string = order.status || 'pending';
      let paymentStatus = 'pending';
      let notes = '';

      switch (transbankData.status) {
        case 'AUTHORIZED':
          orderStatus = 'confirmed';
          paymentStatus = 'completed';
          notes = 'Payment authorized successfully';
          break;
        
        case 'FAILED':
          orderStatus = 'cancelled';
          paymentStatus = 'failed';
          notes = 'Payment failed';
          break;
          
        case 'REJECTED':
          orderStatus = 'cancelled';
          paymentStatus = 'rejected';
          notes = 'Payment rejected';
          break;
          
        case 'CANCELED':
          orderStatus = 'cancelled';
          paymentStatus = 'cancelled';
          notes = 'Payment cancelled by user';
          break;
        
        default:
          paymentStatus = transbankData.status.toLowerCase();
          notes = `Payment status: ${transbankData.status}`;
      }

      // Update order
      await order.update({
        status: orderStatus,
        payment_status: paymentStatus,
        transaction_id: transbankData.buy_order
      });

      // Create status history entry
      await OrderStatusHistory.create({
        order_id: order.id,
        status: orderStatus,
        notes: notes
      });

      // Post-payment logic: Generate Admin Patterns
      if (transbankData.status === 'AUTHORIZED') {
        try {
          console.log(`Payment authorized for Order #${order.id}. Generating admin patterns...`);
          
          // Fetch order items with pattern and design details
          const orderItems = await OrderItem.findAll({
            where: { order_id: order.id },
            include: [
              {
                model: Pattern,
                as: 'pattern',
                include: [{ model: Design, as: 'design' }]
              }
            ]
          });

          for (const item of orderItems) {
            const originalPattern = (item as any).pattern;
            if (originalPattern && originalPattern.design) {
               // 1. Update original pattern name with order number
               const newName = originalPattern.name && originalPattern.name.includes(order.order_number) 
                  ? originalPattern.name 
                  : `${originalPattern.name} - ${order.order_number}`;
                  
               await originalPattern.update({ name: newName });
               
               // 2. Create OrderedPattern entry with normal and mirrored versions
               const design = originalPattern.design;
               if (design.freesewing_pattern) {
                  const mirroredPatternType = `${design.freesewing_pattern} mirrored`;
                  
                  try {
                    console.log(`Generating mirrored admin copy for Pattern ${originalPattern.id}`);
                    
                    let { svg: mirroredSvg } = await generateFreeSewingPattern({
                      patternType: mirroredPatternType,
                      measurements: originalPattern.measurements_used as any,
                      settings: originalPattern.settings_used as any,
                    });

                    // Clean mirrored SVG
                    mirroredSvg = cleanMirroredSvg(mirroredSvg);

                    // Create OrderedPattern
                    await OrderedPattern.create({
                        order_id: order.id,
                        pattern_id: originalPattern.id,
                        svg_normal: originalPattern.svg_data,
                        svg_mirrored: mirroredSvg
                    });

                  } catch (genError) {
                    console.error(`Failed to generate admin copy for pattern ${originalPattern.id}:`, genError);
                  }
               }
            }
          }
        } catch (adminActionError) {
          console.error("Error performing post-payment admin actions:", adminActionError);
        }

        // Record discount code redemption
        if (order.discount_code_id) {
          try {
            await UserDiscountCodeRedemption.create({
              user_id: order.user_id,
              discount_code_id: order.discount_code_id,
              order_id: order.id
            });
            await DiscountCode.increment('current_total_uses', {
              by: 1,
              where: { id: order.discount_code_id }
            });
          } catch (redemptionError) {
            console.error(`Failed to record discount code redemption for order ${order.id}:`, redemptionError);
          }
        }
      }

      // Return appropriate response based on status
      switch (transbankData.status) {
        case 'AUTHORIZED':
          return res.status(200).json({
            success: true,
            data: {
              ...transbankData,
              orderId: order.id,
              orderNumber: order.order_number
            }
          });
        
        case 'FAILED':
        case 'REJECTED':
          return res.status(400).json({
            success: false,
            data: transbankData,
            message: 'Payment was rejected or failed'
          });
          
        case 'CANCELED':
          return res.status(400).json({
            success: false,
            data: transbankData,
            message: 'Payment was cancelled by the user'
          });
        
        default:
          return res.status(400).json({
            success: false,
            data: transbankData,
            message: `Payment has unexpected status: ${transbankData.status}`
          });
      }
    } catch (error: any) {
      console.error("Error processing payment status:", error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to process payment status', 
        error: error.message 
      });
    }
  } catch (error: any) {
    console.error("Error contacting Transbank:", error);
    res.status(500).json({ 
      success: false,
      message: "Could not retrieve order from payment provider", 
      error: error.message 
    });
  }
};

/**
 * Get payment status by order ID (for checking order status)
 */
export const getPaymentByOrderId = async (req: Request, res: Response) => {
  const orderIdParam = req.params.orderId;
  
  if (!orderIdParam) {
    return res.status(400).json({ 
      success: false,
      message: "Order ID is required" 
    });
  }
  
  const orderId = parseInt(orderIdParam as string);

  if (isNaN(orderId)) {
    return res.status(400).json({ 
      success: false,
      message: "Invalid order ID" 
    });
  }

  try {
    const order = await Order.findByPk(orderId);
    
    if (!order) {
      return res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
    }

    // Verify user has access to this order
    if (req.user && order.user_id !== req.user.id) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied' 
      });
    }

    res.status(200).json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        status: order.status,
        paymentStatus: order.payment_status,
        paymentMethod: order.payment_method,
        totalAmount: order.total_amount,
        createdAt: order.created_at
      }
    });
  } catch (error: any) {
    console.error("Error fetching payment status:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch payment status", 
      error: error.message 
    });
  }
};
