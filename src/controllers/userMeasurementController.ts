import { Request, Response } from 'express';
import { UserMeasurement, User, MeasurementType } from '../models';

export const getAllUserMeasurements = async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    
    const whereClause: any = {};
    if (userId) {
      whereClause.user_id = userId;
    }

    const userMeasurements = await UserMeasurement.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name'],
        },
        {
          model: MeasurementType,
          as: 'measurementType',
          attributes: ['id', 'name', 'description', 'freesewing_key'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    res.json({
      success: true,
      data: userMeasurements,
      count: userMeasurements.length,
    });
  } catch (error) {
    console.error('Get all user measurements error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getUserMeasurementsByUserId = async (req: Request, res: Response) => {
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

    const userMeasurements = await UserMeasurement.findAll({
      where: { user_id: userId },
      include: [
        {
          model: MeasurementType,
          as: 'measurementType',
          attributes: ['id', 'name', 'description', 'freesewing_key'],
        },
      ],
      order: [['measurement_type_id', 'ASC']],
    });

    res.json({
      success: true,
      data: userMeasurements,
      count: userMeasurements.length,
    });
  } catch (error) {
    console.error('Get user measurements by user ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getUserMeasurementById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const userMeasurement = await UserMeasurement.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name'],
        },
        {
          model: MeasurementType,
          as: 'measurementType',
          attributes: ['id', 'name', 'description', 'freesewing_key'],
        },
      ],
    });

    if (!userMeasurement) {
      return res.status(404).json({
        success: false,
        message: 'User measurement not found',
      });
    }

    res.json({
      success: true,
      data: userMeasurement,
    });
  } catch (error) {
    console.error('Get user measurement by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const createUserMeasurement = async (req: Request, res: Response) => {
  try {
    const { user_id, measurement_type_id, value } = req.body;

    // Validate required fields
    if (!user_id || !measurement_type_id || value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'User ID, measurement type ID, and value are required',
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

    // Check if measurement type exists
    const measurementType = await MeasurementType.findByPk(measurement_type_id);
    if (!measurementType) {
      return res.status(404).json({
        success: false,
        message: 'Measurement type not found',
      });
    }

    // Check if user measurement already exists for this user and type
    const existingMeasurement = await UserMeasurement.findOne({
      where: { user_id, measurement_type_id }
    });
    if (existingMeasurement) {
      return res.status(400).json({
        success: false,
        message: 'Measurement already exists for this user and type. Use PUT to update.',
      });
    }

    const userMeasurement = await UserMeasurement.create({
      user_id,
      measurement_type_id,
      value,
    });

    // Fetch the created measurement with includes
    const createdMeasurement = await UserMeasurement.findByPk(userMeasurement.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name'],
        },
        {
          model: MeasurementType,
          as: 'measurementType',
          attributes: ['id', 'name', 'description', 'freesewing_key'],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: 'User measurement created successfully',
      data: createdMeasurement,
    });
  } catch (error) {
    console.error('Create user measurement error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const updateUserMeasurement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { value } = req.body;

    const userMeasurement = await UserMeasurement.findByPk(id);
    if (!userMeasurement) {
      return res.status(404).json({
        success: false,
        message: 'User measurement not found',
      });
    }

    // Prepare update data
    const updateData: any = {};
    if (value !== undefined) updateData.value = value;

    await userMeasurement.update(updateData);

    // Fetch the updated measurement with includes
    const updatedMeasurement = await UserMeasurement.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name'],
        },
        {
          model: MeasurementType,
          as: 'measurementType',
          attributes: ['id', 'name', 'description', 'freesewing_key'],
        },
      ],
    });

    res.json({
      success: true,
      message: 'User measurement updated successfully',
      data: updatedMeasurement,
    });
  } catch (error) {
    console.error('Update user measurement error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const deleteUserMeasurement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const userMeasurement = await UserMeasurement.findByPk(id);
    if (!userMeasurement) {
      return res.status(404).json({
        success: false,
        message: 'User measurement not found',
      });
    }

    await userMeasurement.destroy();

    res.json({
      success: true,
      message: 'User measurement deleted successfully',
    });
  } catch (error) {
    console.error('Delete user measurement error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const batchCreateUpdateUserMeasurements = async (req: Request, res: Response) => {
  try {
    const { user_id, measurements } = req.body;

    // Validate required fields
    if (!user_id || !measurements || !Array.isArray(measurements)) {
      return res.status(400).json({
        success: false,
        message: 'User ID and measurements array are required',
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

    const results = [];
    const errors = [];

    for (const measurement of measurements) {
      try {
        const { measurement_type_id, value } = measurement;

        if (!measurement_type_id || value === undefined) {
          errors.push({
            measurement_type_id,
            error: 'Measurement type ID and value are required',
          });
          continue;
        }

        // Check if measurement type exists
        const measurementType = await MeasurementType.findByPk(measurement_type_id);
        if (!measurementType) {
          errors.push({
            measurement_type_id,
            error: 'Measurement type not found',
          });
          continue;
        }

        // Try to find existing measurement
        const existingMeasurement = await UserMeasurement.findOne({
          where: { user_id, measurement_type_id }
        });

        let userMeasurement;
        if (existingMeasurement) {
          // Update existing
          await existingMeasurement.update({
            value,
          });
          userMeasurement = existingMeasurement;
        } else {
          // Create new
          userMeasurement = await UserMeasurement.create({
            user_id,
            measurement_type_id,
            value,
          });
        }

        results.push(userMeasurement);
      } catch {
        errors.push({
          measurement_type_id: measurement.measurement_type_id,
          error: 'Failed to process measurement',
        });
      }
    }

    res.json({
      success: true,
      message: 'Batch operation completed',
      data: {
        processed: results.length,
        errorCount: errors.length,
        results,
        errors,
      },
    });
  } catch (error) {
    console.error('Batch create/update user measurements error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getUserMeasurementByUserAndType = async (req: Request, res: Response) => {
  try {
    const { userId, typeId } = req.params;

    const userMeasurement = await UserMeasurement.findOne({
      where: { 
        user_id: userId,
        measurement_type_id: typeId 
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name'],
        },
        {
          model: MeasurementType,
          as: 'measurementType',
          attributes: ['id', 'name', 'description', 'freesewing_key'],
        },
      ],
    });

    if (!userMeasurement) {
      return res.status(404).json({
        success: false,
        message: 'User measurement not found for this user and measurement type',
      });
    }

    res.json({
      success: true,
      data: userMeasurement,
    });
  } catch (error) {
    console.error('Get user measurement by user and type error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};