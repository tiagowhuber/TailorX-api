import { Request, Response } from 'express';
import { DiscountCode, UserHasDiscountCode, UserDiscountCodeRedemption, User } from '../models';
import { validateDiscountCodeLogic } from '../services/discountService';

export const getAllDiscountCodes = async (req: Request, res: Response) => {
  try {
    const codes = await DiscountCode.findAll({
      order: [['starts_at', 'DESC']],
      include: [
        {
          model: User,
          as: 'users', // Assigned users
          attributes: ['id', 'first_name', 'last_name', 'email'],
          through: {
            attributes: ['assigned_at']
          }
        },
        {
          model: UserDiscountCodeRedemption,
          as: 'redemptions', // Usage history
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'first_name', 'last_name', 'email']
            }
          ]
        }
      ]
    });

    res.json({
      success: true,
      data: codes
    });
  } catch (error) {
    console.error('Get all discount codes error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const validateDiscountCode = async (req: Request, res: Response) => {
  try {
    const { code, userId, cartItems } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Discount code is required' });
    }

    const result = await validateDiscountCodeLogic(code, userId, cartItems);

    if (!result.isValid) {
        return res.status(400).json({ success: false, message: result.message });
    }

    return res.json({
      success: true,
      data: {
        discountCode: result.discountCode,
        discountAmount: result.discountAmount,
        isFreeShipping: result.isFreeShipping,
        isValid: true
      }
    });

  } catch (error) {
    console.error('Validate discount code error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getUserDiscountCodes = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const userCodes = await UserHasDiscountCode.findAll({
      where: { user_id: userId },
      include: [
        {
          model: DiscountCode,
          as: 'discountCode', // Use the alias defined in models/index.ts. Actually, UserHasDiscountCode belongsTo DiscountCode
          attributes: ['id', 'code', 'value', 'discount_type', 'max_discount_amount', 'starts_at', 'expires_at', 'is_active', 'applies_to_design_id', 'max_uses_per_user']
        }
      ]
    });
    
    // Filter out codes that have reached max_uses_per_user
    const activeCodes = [];
    
    for (const uc of userCodes) {
        // Sequelize returns associated model on the instance, but types might be tricky.
        const code = (uc as any).discountCode;
        if (!code) continue;
        
        if (code.max_uses_per_user) {
            const redemptionCount = await UserDiscountCodeRedemption.count({
                where: {
                    user_id: userId,
                    discount_code_id: code.id
                }
            });
            
            if (redemptionCount >= code.max_uses_per_user) {
                continue; // Skip this code
            }
        }
        
        activeCodes.push(code);
    }

    res.json({
      success: true,
      data: activeCodes
    });
  } catch (error) {
    console.error('Get user discount codes error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const createDiscountCode = async (req: Request, res: Response) => {
  try {
    const { 
      code, 
      discount_type, 
      value, 
      max_discount_amount,
      starts_at, 
      expires_at, 
      max_total_uses, 
      max_unique_users, 
      max_uses_per_user,
      applies_to_design_id,
      target_design_ids,
      is_free_shipping,
      is_active 
    } = req.body;

    // Basic validation
    if (!code || !discount_type || (value === undefined && !is_free_shipping)) {
      return res.status(400).json({ success: false, message: 'Missing required fields: code, discount_type, value (or is_free_shipping)' });
    }

    const existingCode = await DiscountCode.findOne({ where: { code } });
    if (existingCode) {
      return res.status(400).json({ success: false, message: 'Discount code already exists' });
    }

    const newCode = await DiscountCode.create({
      code,
      discount_type,
      value,
      max_discount_amount,
      starts_at,
      expires_at,
      max_total_uses,
      max_unique_users,
      max_uses_per_user,
      applies_to_design_id,
      target_design_ids,
      is_free_shipping,
      is_active: is_active !== undefined ? is_active : true
    });

    res.status(201).json({
      success: true,
      data: newCode,
      message: 'Discount code created successfully'
    });
  } catch (error) {
    console.error('Create discount code error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const assignDiscountCodeToUser = async (req: Request, res: Response) => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      return res.status(400).json({ success: false, message: 'User ID and code are required' });
    }

    const discountCode = await DiscountCode.findOne({ where: { code } });
    if (!discountCode) {
      return res.status(404).json({ success: false, message: 'Discount code not found' });
    }

    if (!discountCode.is_active) {
      return res.status(400).json({ success: false, message: 'Discount code is inactive' });
    }

    // Check max uses per user
    if (discountCode.max_uses_per_user !== null && discountCode.max_uses_per_user !== undefined) {
      const userRedemptionCount = await UserDiscountCodeRedemption.count({
        where: {
          discount_code_id: discountCode.id,
          user_id: userId
        }
      });

      if (userRedemptionCount >= discountCode.max_uses_per_user) {
        return res.status(400).json({ success: false, message: `You have already used this discount code the maximum number of times (${discountCode.max_uses_per_user})` });
      }
    }

    // Check if already assigned
    const existingAssignment = await UserHasDiscountCode.findOne({
      where: {
        user_id: userId,
        discount_code_id: discountCode.id
      }
    });

    if (existingAssignment) {
      return res.status(400).json({ success: false, message: 'Discount code already assigned to this user' });
    }

    // Assign code
    await UserHasDiscountCode.create({
      user_id: userId,
      discount_code_id: discountCode.id
    });

    res.json({
      success: true,
      message: 'Discount code assigned successfully',
      data: discountCode
    });
  } catch (error) {
    console.error('Assign discount code error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
