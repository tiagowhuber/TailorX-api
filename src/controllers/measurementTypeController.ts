import { Request, Response } from 'express';
import { MeasurementType } from '../models';
import { Op } from 'sequelize';

export const getAllMeasurementTypes = async (req: Request, res: Response) => {
  try {
    const measurementTypes = await MeasurementType.findAll({
      order: [['name', 'ASC']],
    });

    res.json({
      success: true,
      data: measurementTypes,
      count: measurementTypes.length,
    });
  } catch (error) {
    console.error('Get all measurement types error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getMeasurementTypeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const measurementType = await MeasurementType.findByPk(id);

    if (!measurementType) {
      return res.status(404).json({
        success: false,
        message: 'Measurement type not found',
      });
    }

    res.json({
      success: true,
      data: measurementType,
    });
  } catch (error) {
    console.error('Get measurement type by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const createMeasurementType = async (req: Request, res: Response) => {
  try {
    const { name, description, freesewing_key } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required',
      });
    }

    // Check if measurement type with same name already exists
    const existingType = await MeasurementType.findOne({ where: { name } });
    if (existingType) {
      return res.status(400).json({
        success: false,
        message: 'Measurement type with this name already exists',
      });
    }

    // Check if freesewing_key is unique (if provided)
    if (freesewing_key) {
      const existingKeyType = await MeasurementType.findOne({ 
        where: { freesewing_key } 
      });
      if (existingKeyType) {
        return res.status(400).json({
          success: false,
          message: 'Measurement type with this FreeSewing key already exists',
        });
      }
    }

    const measurementType = await MeasurementType.create({
      name,
      description,
      freesewing_key,
    });

    res.status(201).json({
      success: true,
      message: 'Measurement type created successfully',
      data: measurementType,
    });
  } catch (error) {
    console.error('Create measurement type error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const updateMeasurementType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, freesewing_key } = req.body;

    const measurementType = await MeasurementType.findByPk(id);
    if (!measurementType) {
      return res.status(404).json({
        success: false,
        message: 'Measurement type not found',
      });
    }

    // Check if name is being changed and if it already exists
    if (name && name !== measurementType.name) {
      const existingType = await MeasurementType.findOne({ 
        where: { 
          name,
          id: { [Op.ne]: id }
        } 
      });
      if (existingType) {
        return res.status(400).json({
          success: false,
          message: 'Measurement type with this name already exists',
        });
      }
    }

    // Check if freesewing_key is being changed and if it already exists
    if (freesewing_key && freesewing_key !== measurementType.freesewing_key) {
      const existingKeyType = await MeasurementType.findOne({ 
        where: { 
          freesewing_key,
          id: { [Op.ne]: id }
        } 
      });
      if (existingKeyType) {
        return res.status(400).json({
          success: false,
          message: 'Measurement type with this FreeSewing key already exists',
        });
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (freesewing_key !== undefined) updateData.freesewing_key = freesewing_key;

    await measurementType.update(updateData);

    res.json({
      success: true,
      message: 'Measurement type updated successfully',
      data: measurementType,
    });
  } catch (error) {
    console.error('Update measurement type error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const deleteMeasurementType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const measurementType = await MeasurementType.findByPk(id);
    if (!measurementType) {
      return res.status(404).json({
        success: false,
        message: 'Measurement type not found',
      });
    }

    await measurementType.destroy();

    res.json({
      success: true,
      message: 'Measurement type deleted successfully',
    });
  } catch (error) {
    console.error('Delete measurement type error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getMeasurementTypeByFreeSewingKey = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    
    const measurementType = await MeasurementType.findOne({
      where: { freesewing_key: key }
    });

    if (!measurementType) {
      return res.status(404).json({
        success: false,
        message: 'Measurement type not found with this FreeSewing key',
      });
    }

    res.json({
      success: true,
      data: measurementType,
    });
  } catch (error) {
    console.error('Get measurement type by FreeSewing key error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};