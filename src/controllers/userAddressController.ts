import { Request, Response } from 'express';
import { UserAddress } from '../models';

// Get all addresses for the authenticated user
export const getUserAddresses = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const addresses = await UserAddress.findAll({
      where: { user_id: userId },
      order: [['is_default', 'DESC'], ['created_at', 'DESC']],
    });

    res.json({
      success: true,
      data: addresses,
      count: addresses.length,
    });
  } catch (error) {
    console.error('Get user addresses error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Create a new address
export const createAddress = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const {
      recipient_name,
      street_address,
      apartment_unit,
      comuna,
      region,
      is_default
    } = req.body;

    // Validate required fields
    if (!street_address || !comuna || !region) {
      return res.status(400).json({
        success: false,
        message: 'Street address, comuna, and region are required',
      });
    }

    // If this is the first address, make it default automatically
    const count = await UserAddress.count({ where: { user_id: userId } });
    const shouldBeDefault = is_default || count === 0;

    // If setting as default, unset other defaults
    if (shouldBeDefault) {
      await UserAddress.update(
        { is_default: false },
        { where: { user_id: userId, is_default: true } }
      );
    }

    const address = await UserAddress.create({
      user_id: userId,
      recipient_name,
      street_address,
      apartment_unit,
      comuna,
      region,
      is_default: shouldBeDefault,
    });

    res.status(201).json({
      success: true,
      message: 'Address created successfully',
      data: address,
    });
  } catch (error) {
    console.error('Create address error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Update an address
export const updateAddress = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const address = await UserAddress.findOne({
      where: { id, user_id: userId }
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found',
      });
    }

    const {
      recipient_name,
      street_address,
      apartment_unit,
      comuna,
      region,
      is_default
    } = req.body;

    // If setting as default, unset other defaults
    if (is_default && !address.is_default) {
      await UserAddress.update(
        { is_default: false },
        { where: { user_id: userId, is_default: true } }
      );
    }

    await address.update({
      recipient_name,
      street_address,
      apartment_unit,
      comuna,
      region,
      is_default: is_default !== undefined ? is_default : address.is_default,
    });

    res.json({
      success: true,
      message: 'Address updated successfully',
      data: address,
    });
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Delete an address
export const deleteAddress = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const address = await UserAddress.findOne({
      where: { id, user_id: userId }
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found',
      });
    }

    await address.destroy();

    // If we deleted the default address, make another one default if exists
    if (address.is_default) {
      const anotherAddress = await UserAddress.findOne({
        where: { user_id: userId },
        order: [['created_at', 'DESC']]
      });
      
      if (anotherAddress) {
        await anotherAddress.update({ is_default: true });
      }
    }

    res.json({
      success: true,
      message: 'Address deleted successfully',
    });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
