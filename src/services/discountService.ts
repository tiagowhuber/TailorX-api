import { DiscountCode, UserDiscountCodeRedemption } from '../models';

export const validateDiscountCodeLogic = async (code: string, userId: number | undefined, cartItems: any[]) => {
    const discountCode = await DiscountCode.findOne({ where: { code } });

    if (!discountCode) {
      return { isValid: false, message: 'Invalid discount code' };
    }

    // 1. Check if active
    if (!discountCode.is_active) {
      return { isValid: false, message: 'Discount code is inactive' };
    }

    // 2. Check date range
    const now = new Date();
    if (discountCode.starts_at && now < discountCode.starts_at) {
      return { isValid: false, message: 'Discount code is not yet active' };
    }
    if (discountCode.expires_at && now > discountCode.expires_at) {
      return { isValid: false, message: 'Discount code has expired' };
    }

    // 3. Check max total uses
    if (discountCode.max_total_uses !== null && discountCode.max_total_uses !== undefined) {
      if (discountCode.current_total_uses >= discountCode.max_total_uses) {
        return { isValid: false, message: 'Discount code usage limit reached' };
      }
    }

    // 4. Check max unique users
    if (discountCode.max_unique_users !== null && discountCode.max_unique_users !== undefined && userId) {
      // Check if this user has already used it
      const userRedemption = await UserDiscountCodeRedemption.findOne({
        where: {
          discount_code_id: discountCode.id,
          user_id: userId
        }
      });

      if (!userRedemption) {
        // User hasn't used it yet. Check if we have room for a new unique user.
        const distinctUsersCount = await UserDiscountCodeRedemption.count({
          where: { discount_code_id: discountCode.id },
          distinct: true,
          col: 'user_id'
        });

        if (distinctUsersCount >= discountCode.max_unique_users) {
          return { isValid: false, message: 'Discount code unique user limit reached' };
        }
      }
    }

    // 5. Check max uses per user
    if (discountCode.max_uses_per_user !== null && discountCode.max_uses_per_user !== undefined && userId) {
      const userRedemptionCount = await UserDiscountCodeRedemption.count({
        where: {
          discount_code_id: discountCode.id,
          user_id: userId
        }
      });

      if (userRedemptionCount >= discountCode.max_uses_per_user) {
        return { isValid: false, message: `You have already used this discount code the maximum number of times (${discountCode.max_uses_per_user})` };
      }
    }

    // 6. Calculate discount
    let discountAmount = 0;
    let applicableItems = [];

    // Collect all target design IDs
    const targetDesignIds: number[] = [];
    if (discountCode.target_design_ids && Array.isArray(discountCode.target_design_ids)) {
      targetDesignIds.push(...discountCode.target_design_ids);
    }
    if (discountCode.applies_to_design_id) {
      targetDesignIds.push(discountCode.applies_to_design_id);
    }

    if (targetDesignIds.length > 0) {
      // Applies to specific products/designs
      if (cartItems && cartItems.length > 0) {
        applicableItems = cartItems.filter((item: any) => {
            // item might be directly a Design ID or an object with design_id
            const dId = item.design_id || (item.pattern && item.pattern.design_id);
            return targetDesignIds.includes(dId);
        });
        
        if (applicableItems.length === 0) {
             return { isValid: false, message: 'Discount code does not apply to any items in cart' };
        }
      } else {
         return { isValid: false, message: 'Discount code does not apply to any items in cart' };
      }
    } else {
      // Applies to entire order
      applicableItems = cartItems || [];
    }

    // Calculate discount amount
    if (applicableItems.length > 0) {
        const applicableSubtotal = applicableItems.reduce((sum: number, item: any) => sum + (Number(item.price) * (item.quantity || 1)), 0);
        
        if (discountCode.discount_type === 'percentage') {
            discountAmount = (applicableSubtotal * discountCode.value) / 100;
            if (discountCode.max_discount_amount && discountAmount > discountCode.max_discount_amount) {
                discountAmount = Number(discountCode.max_discount_amount);
            }
        } else if (discountCode.discount_type === 'fixed_amount') {
            discountAmount = Number(discountCode.value);
            // Cap fixed discount at the subtotal of eligible items
            if (discountAmount > applicableSubtotal) {
                discountAmount = applicableSubtotal;
            }
        }
    }

    return {
      isValid: true,
      discountCode,
      discountAmount,
      isFreeShipping: !!discountCode.is_free_shipping
    };
};
