import { Request, Response } from 'express';
import { Pattern, User, Design } from '../models';

export const getAllPatterns = async (req: Request, res: Response) => {
  try {
    const { userId, status } = req.query;
    
    const whereClause: any = {};
    if (userId) whereClause.user_id = userId;
    if (status) whereClause.status = status;

    const patterns = await Pattern.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name'],
        },
        {
          model: Design,
          as: 'design',
          attributes: ['id', 'name', 'description', 'freesewing_pattern'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    res.json({
      success: true,
      data: patterns,
      count: patterns.length,
    });
  } catch (error) {
    console.error('Get all patterns error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getPatternsByUserId = async (req: Request, res: Response) => {
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

    const patterns = await Pattern.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Design,
          as: 'design',
          attributes: ['id', 'name', 'description', 'freesewing_pattern'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    res.json({
      success: true,
      data: patterns,
      count: patterns.length,
    });
  } catch (error) {
    console.error('Get patterns by user ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getPatternById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const pattern = await Pattern.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name'],
        },
        {
          model: Design,
          as: 'design',
          attributes: ['id', 'name', 'description', 'freesewing_pattern'],
        },
      ],
    });

    if (!pattern) {
      return res.status(404).json({
        success: false,
        message: 'Pattern not found',
      });
    }

    res.json({
      success: true,
      data: pattern,
    });
  } catch (error) {
    console.error('Get pattern by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const createPattern = async (req: Request, res: Response) => {
  try {
    const { user_id, design_id, name, measurements_used, settings_used, svg_data } = req.body;

    // Validate required fields
    if (!user_id || !design_id || !measurements_used || !settings_used || !svg_data) {
      return res.status(400).json({
        success: false,
        message: 'User ID, design ID, measurements used, settings used, and SVG data are required',
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

    // Check if design exists
    const design = await Design.findByPk(design_id);
    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found',
      });
    }

    const pattern = await Pattern.create({
      user_id,
      design_id,
      name,
      measurements_used,
      settings_used,
      svg_data,
      status: 'draft',
    });

    // Fetch the created pattern with includes
    const createdPattern = await Pattern.findByPk(pattern.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name'],
        },
        {
          model: Design,
          as: 'design',
          attributes: ['id', 'name', 'description', 'freesewing_pattern'],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: 'Pattern created successfully',
      data: createdPattern,
    });
  } catch (error) {
    console.error('Create pattern error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const updatePattern = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, status, measurements_used, settings_used, svg_data } = req.body;

    const pattern = await Pattern.findByPk(id);
    if (!pattern) {
      return res.status(404).json({
        success: false,
        message: 'Pattern not found',
      });
    }

    // Prepare update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (status !== undefined) updateData.status = status;
    if (measurements_used !== undefined) updateData.measurements_used = measurements_used;
    if (settings_used !== undefined) updateData.settings_used = settings_used;
    if (svg_data !== undefined) updateData.svg_data = svg_data;

    await pattern.update(updateData);

    // Fetch the updated pattern with includes
    const updatedPattern = await Pattern.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name'],
        },
        {
          model: Design,
          as: 'design',
          attributes: ['id', 'name', 'description', 'freesewing_pattern'],
        },
      ],
    });

    res.json({
      success: true,
      message: 'Pattern updated successfully',
      data: updatedPattern,
    });
  } catch (error) {
    console.error('Update pattern error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const deletePattern = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const pattern = await Pattern.findByPk(id);
    if (!pattern) {
      return res.status(404).json({
        success: false,
        message: 'Pattern not found',
      });
    }

    await pattern.destroy();

    res.json({
      success: true,
      message: 'Pattern deleted successfully',
    });
  } catch (error) {
    console.error('Delete pattern error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getPatternSvg = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const pattern = await Pattern.findByPk(id, {
      attributes: ['id', 'name', 'svg_data'],
    });

    if (!pattern) {
      return res.status(404).json({
        success: false,
        message: 'Pattern not found',
      });
    }

    if (!pattern.svg_data) {
      return res.status(404).json({
        success: false,
        message: 'SVG data not available for this pattern',
      });
    }

    // Set content type for SVG
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(pattern.svg_data);
  } catch (error) {
    console.error('Get pattern SVG error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const generatePattern = async (req: Request, res: Response) => {
  try {
    const { user_id, design_id, name, measurements, settings } = req.body;

    // Validate required fields
    if (!user_id || !design_id || !name || !measurements) {
      return res.status(400).json({
        success: false,
        message: 'User ID, design ID, name, and measurements are required',
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

    // Check if design exists
    const design = await Design.findByPk(design_id);
    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found',
      });
    }

    // TODO: Integrate with FreeSewing pattern generation
    // For now, we'll create a pattern without actual generation
    const pattern = await Pattern.create({
      user_id,
      design_id,
      name,
      measurements_used: measurements,
      settings_used: settings || {},
      svg_data: '<svg></svg>', // Placeholder SVG data
      status: 'draft',
    });

    // Fetch the created pattern with includes
    const createdPattern = await Pattern.findByPk(pattern.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name'],
        },
        {
          model: Design,
          as: 'design',
          attributes: ['id', 'name', 'description', 'freesewing_pattern'],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: 'Pattern generated successfully',
      data: createdPattern,
      note: 'Pattern generation integration with FreeSewing is pending',
    });
  } catch (error) {
    console.error('Generate pattern error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const finalizePattern = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const pattern = await Pattern.findByPk(id);
    if (!pattern) {
      return res.status(404).json({
        success: false,
        message: 'Pattern not found',
      });
    }

    if (pattern.status === 'finalized') {
      return res.status(400).json({
        success: false,
        message: 'Pattern is already finalized',
      });
    }

    await pattern.update({ status: 'finalized' });

    res.json({
      success: true,
      message: 'Pattern finalized successfully',
      data: pattern,
    });
  } catch (error) {
    console.error('Finalize pattern error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const archivePattern = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const pattern = await Pattern.findByPk(id);
    if (!pattern) {
      return res.status(404).json({
        success: false,
        message: 'Pattern not found',
      });
    }

    if (pattern.status === 'archived') {
      return res.status(400).json({
        success: false,
        message: 'Pattern is already archived',
      });
    }

    await pattern.update({ status: 'archived' });

    res.json({
      success: true,
      message: 'Pattern archived successfully',
      data: pattern,
    });
  } catch (error) {
    console.error('Archive pattern error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getPatternsByDesignId = async (req: Request, res: Response) => {
  try {
    const { designId } = req.params;

    // Check if design exists
    const design = await Design.findByPk(designId);
    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found',
      });
    }

    const patterns = await Pattern.findAll({
      where: { design_id: designId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    res.json({
      success: true,
      data: patterns,
      count: patterns.length,
    });
  } catch (error) {
    console.error('Get patterns by design ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getPatternsByStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.params;

    const patterns = await Pattern.findAll({
      where: { status },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name'],
        },
        {
          model: Design,
          as: 'design',
          attributes: ['id', 'name', 'description', 'freesewing_pattern'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    res.json({
      success: true,
      data: patterns,
      count: patterns.length,
    });
  } catch (error) {
    console.error('Get patterns by status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};