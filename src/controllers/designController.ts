import { Request, Response } from 'express';
import { Design, DesignMeasurement, MeasurementType } from '../models';
import { Op } from 'sequelize';

export const getAllDesigns = async (req: Request, res: Response) => {
  try {
    const { active } = req.query;
    
    const whereClause: any = {};
    if (active !== undefined) {
      whereClause.is_active = active === 'true';
    }

    const designs = await Design.findAll({
      where: whereClause,
      include: [
        {
          model: DesignMeasurement,
          as: 'requiredMeasurements',
          include: [
            {
              model: MeasurementType,
              as: 'measurementType',
              attributes: ['id', 'name', 'description', 'freesewing_key'],
            },
          ],
        },
      ],
      order: [['name', 'ASC']],
    });

    res.json({
      success: true,
      data: designs,
      count: designs.length,
    });
  } catch (error) {
    console.error('Get all designs error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getDesignById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const design = await Design.findByPk(id, {
      include: [
        {
          model: DesignMeasurement,
          as: 'requiredMeasurements',
          include: [
            {
              model: MeasurementType,
              as: 'measurementType',
              attributes: ['id', 'name', 'description', 'freesewing_key'],
            },
          ],
        },
      ],
    });

    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found',
      });
    }

    res.json({
      success: true,
      data: design,
    });
  } catch (error) {
    console.error('Get design by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const createDesign = async (req: Request, res: Response) => {
  try {
    const { name, description, freesewing_pattern, base_price, is_active } = req.body;

    // Validate required fields
    if (!name || base_price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name and base price are required',
      });
    }

    // Check if design with same name already exists
    const existingDesign = await Design.findOne({ where: { name } });
    if (existingDesign) {
      return res.status(400).json({
        success: false,
        message: 'Design with this name already exists',
      });
    }

    // Check if freesewing_pattern is unique (if provided)
    if (freesewing_pattern) {
      const existingPatternDesign = await Design.findOne({ 
        where: { freesewing_pattern } 
      });
      if (existingPatternDesign) {
        return res.status(400).json({
          success: false,
          message: 'Design with this FreeSewing pattern already exists',
        });
      }
    }

    const design = await Design.create({
      name,
      description,
      freesewing_pattern,
      base_price,
      is_active: is_active !== undefined ? is_active : true,
    });

    res.status(201).json({
      success: true,
      message: 'Design created successfully',
      data: design,
    });
  } catch (error) {
    console.error('Create design error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const updateDesign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, freesewing_pattern, base_price, is_active } = req.body;

    const design = await Design.findByPk(id);
    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found',
      });
    }

    // Check if name is being changed and if it already exists
    if (name && name !== design.name) {
      const existingDesign = await Design.findOne({ 
        where: { 
          name,
          id: { [Op.ne]: id }
        } 
      });
      if (existingDesign) {
        return res.status(400).json({
          success: false,
          message: 'Design with this name already exists',
        });
      }
    }

    // Check if freesewing_pattern is being changed and if it already exists
    if (freesewing_pattern && freesewing_pattern !== design.freesewing_pattern) {
      const existingPatternDesign = await Design.findOne({ 
        where: { 
          freesewing_pattern,
          id: { [Op.ne]: id }
        } 
      });
      if (existingPatternDesign) {
        return res.status(400).json({
          success: false,
          message: 'Design with this FreeSewing pattern already exists',
        });
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (freesewing_pattern !== undefined) updateData.freesewing_pattern = freesewing_pattern;
    if (base_price !== undefined) updateData.base_price = base_price;
    if (is_active !== undefined) updateData.is_active = is_active;

    await design.update(updateData);

    res.json({
      success: true,
      message: 'Design updated successfully',
      data: design,
    });
  } catch (error) {
    console.error('Update design error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const deleteDesign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const design = await Design.findByPk(id);
    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found',
      });
    }

    // Soft delete by setting is_active to false
    await design.update({ is_active: false });

    res.json({
      success: true,
      message: 'Design deleted (deactivated) successfully',
    });
  } catch (error) {
    console.error('Delete design error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getDesignMeasurements = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if design exists
    const design = await Design.findByPk(id);
    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found',
      });
    }

    const designMeasurements = await DesignMeasurement.findAll({
      where: { design_id: id },
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
      data: designMeasurements,
      count: designMeasurements.length,
    });
  } catch (error) {
    console.error('Get design measurements error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const addDesignMeasurement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { measurement_type_id, is_required } = req.body;

    // Validate required fields
    if (!measurement_type_id) {
      return res.status(400).json({
        success: false,
        message: 'Measurement type ID is required',
      });
    }

    // Check if design exists
    const design = await Design.findByPk(id);
    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found',
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

    // Check if design measurement already exists
    const existingDesignMeasurement = await DesignMeasurement.findOne({
      where: { design_id: id, measurement_type_id }
    });
    if (existingDesignMeasurement) {
      return res.status(400).json({
        success: false,
        message: 'Measurement already required for this design',
      });
    }

    const designMeasurement = await DesignMeasurement.create({
      design_id: parseInt(id!),
      measurement_type_id,
      is_required: is_required !== undefined ? is_required : true,
    });

    // Fetch the created measurement with includes
    const createdMeasurement = await DesignMeasurement.findByPk(designMeasurement.id, {
      include: [
        {
          model: MeasurementType,
          as: 'measurementType',
          attributes: ['id', 'name', 'description', 'freesewing_key'],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: 'Design measurement added successfully',
      data: createdMeasurement,
    });
  } catch (error) {
    console.error('Add design measurement error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const removeDesignMeasurement = async (req: Request, res: Response) => {
  try {
    const { id, measurementTypeId } = req.params;

    const designMeasurement = await DesignMeasurement.findOne({
      where: { 
        design_id: id,
        measurement_type_id: measurementTypeId
      }
    });

    if (!designMeasurement) {
      return res.status(404).json({
        success: false,
        message: 'Design measurement not found',
      });
    }

    await designMeasurement.destroy();

    res.json({
      success: true,
      message: 'Design measurement removed successfully',
    });
  } catch (error) {
    console.error('Remove design measurement error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getDesignByFreeSewingPattern = async (req: Request, res: Response) => {
  try {
    const { pattern } = req.params;
    
    const design = await Design.findOne({
      where: { freesewing_pattern: pattern },
      include: [
        {
          model: DesignMeasurement,
          as: 'requiredMeasurements',
          include: [
            {
              model: MeasurementType,
              as: 'measurementType',
              attributes: ['id', 'name', 'description', 'freesewing_key'],
            },
          ],
        },
      ],
    });

    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found with this FreeSewing pattern',
      });
    }

    res.json({
      success: true,
      data: design,
    });
  } catch (error) {
    console.error('Get design by FreeSewing pattern error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getActiveDesigns = async (req: Request, res: Response) => {
  try {
    const designs = await Design.findAll({
      where: { is_active: true },
      include: [
        {
          model: DesignMeasurement,
          as: 'requiredMeasurements',
          include: [
            {
              model: MeasurementType,
              as: 'measurementType',
              attributes: ['id', 'name', 'description', 'freesewing_key'],
            },
          ],
        },
      ],
      order: [['name', 'ASC']],
    });

    res.json({
      success: true,
      data: designs,
      count: designs.length,
    });
  } catch (error) {
    console.error('Get active designs error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};