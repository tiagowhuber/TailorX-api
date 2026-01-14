import { Request, Response } from 'express';
import { Pattern, User, Design, UserMeasurement, MeasurementType, DesignMeasurement, OrderedPattern, Order } from '../models';
import {
  transformMeasurementsForFreeSewing,
  validateRequiredMeasurements,
  generateFreeSewingPattern,
  generatePatternName,
  extractRequiredMeasurementKeys,
  cleanMirroredSvg,
} from '../utils/freesewing';
import { TailorFitService } from '../services/TailorFitService';

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
          attributes: ['id', 'name', 'description', 'freesewing_pattern', 'image_url'],
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
          attributes: ['id', 'name', 'description', 'freesewing_pattern', 'image_url'],
        },
      ],
    });

    if (!pattern) {
      return res.status(404).json({
        success: false,
        message: 'Pattern not found',
      });
    }

    // Authorization check: ensure user can only access their own patterns
    if (req.user && req.user.id !== pattern.user_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
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
    const { user_id, design_id } = req.body;

    // Validate required fields
    if (!user_id || !design_id) {
      return res.status(400).json({
        success: false,
        message: 'User ID and design ID are required',
      });
    }

    // Authorization check: ensure user can only generate patterns for themselves
    if (req.user && req.user.id !== user_id) {
      return res.status(403).json({
        success: false,
        message: 'You can only generate patterns for yourself',
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

    // Check if design exists and is active
    const design = await Design.findByPk(design_id);
    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found',
      });
    }

    if (!design.is_active) {
      return res.status(400).json({
        success: false,
        message: 'This design is not currently available',
      });
    }

    if (!design.freesewing_pattern) {
      return res.status(400).json({
        success: false,
        message: 'This design does not support pattern generation',
      });
    }

    // Fetch user's measurements with measurement types
    const userMeasurements = await UserMeasurement.findAll({
      where: { user_id },
      include: [
        {
          model: MeasurementType,
          as: 'measurementType',
          attributes: ['id', 'name', 'freesewing_key'],
        },
      ],
    });

    // Fetch design's required measurements
    const designMeasurements = await DesignMeasurement.findAll({
      where: { design_id },
      include: [
        {
          model: MeasurementType,
          as: 'measurementType',
          attributes: ['id', 'name', 'freesewing_key'],
        },
      ],
    });

    // Extract required measurement keys
    const requiredKeys = extractRequiredMeasurementKeys(designMeasurements);

    // Transform user measurements to FreeSewing format
    const freesewingMeasurements = transformMeasurementsForFreeSewing(userMeasurements);

    // Validate that user has all required measurements
    const validation = validateRequiredMeasurements(freesewingMeasurements, requiredKeys);
    
    if (!validation.isValid) {
      // Get the missing measurement details
      const missingMeasurements = designMeasurements
        .filter(dm => 
          dm.measurementType?.freesewing_key && 
          validation.missing.includes(dm.measurementType.freesewing_key)
        )
        .map(dm => ({
          id: dm.measurementType!.id,
          name: dm.measurementType!.name,
          freesewing_key: dm.measurementType!.freesewing_key,
        }));

      return res.status(400).json({
        success: false,
        message: 'Missing required measurements',
        missing_measurements: missingMeasurements,
      });
    }

    // Get design settings (use defaults, no user override)
    const baseSettings = design.default_settings || { sa: 10, complete: true };
    
    // Always enable paperless mode for dimension markers and measurements
    const settings = {
      ...baseSettings,
      paperless: true,
    };

    // Generate the pattern using FreeSewing
    const { svg, sizeKb } = await generateFreeSewingPattern({
      patternType: design.freesewing_pattern,
      measurements: freesewingMeasurements,
      settings,
    });

    // Auto-generate pattern name
    const userName = user.first_name ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}` : undefined;
    const patternName = generatePatternName(design.name, userName);

    // Create the pattern in database
    const pattern = await Pattern.create({
      user_id,
      design_id,
      name: patternName,
      measurements_used: freesewingMeasurements,
      settings_used: settings,
      svg_data: svg,
      svg_size_kb: sizeKb,
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
    });
  } catch (error: any) {
    console.error('Generate pattern error:', error);
    
    // Check if it's a FreeSewing-specific error
    if (error.message && error.message.includes('pattern')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while generating pattern',
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

export const unarchivePattern = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const pattern = await Pattern.findByPk(id);
    if (!pattern) {
      return res.status(404).json({
        success: false,
        message: 'Pattern not found',
      });
    }

    if (pattern.status !== 'archived') {
      return res.status(400).json({
        success: false,
        message: 'Pattern is not archived',
      });
    }

    await pattern.update({ status: 'draft' });

    res.json({
      success: true,
      message: 'Pattern unarchived successfully',
      data: pattern,
    });
  } catch (error) {
    console.error('Unarchive pattern error:', error);
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

export const generateMirroredPattern = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Fetch original pattern
    const originalPattern = await Pattern.findByPk(id, {
        include: [
            {
                model: Design,
                as: 'design',
                attributes: ['id', 'name', 'freesewing_pattern', 'default_settings']
            }
        ]
    });

    if (!originalPattern) {
      return res.status(404).json({
        success: false,
        message: 'Original pattern not found',
      });
    }

    // Authorization check - allow owner or admin
    if (!req.user || (req.user.id !== originalPattern.user_id && req.user.role !== 'admin')) {
        return res.status(403).json({
            success: false,
            message: 'Access denied',
        });
    }

    // Get the base pattern type from the design
    const design = (originalPattern as any).design;
    
    if (!design || !design.freesewing_pattern) {
        return res.status(400).json({
            success: false,
            message: 'Associated design does not support pattern generation',
        });
    }

    const basePatternType = design.freesewing_pattern;
    const mirroredPatternType = `${basePatternType} mirrored`;

    console.log(`Generating mirrored pattern for Pattern ID ${id}. Type: ${mirroredPatternType}`);

    let { svg, sizeKb } = await generateFreeSewingPattern({
      patternType: mirroredPatternType,
      measurements: originalPattern.measurements_used as any,
      settings: originalPattern.settings_used as any,
    });

    // Clean mirrored SVG
    svg = cleanMirroredSvg(svg);
    // Recalculate size
    sizeKb = Buffer.byteLength(svg, 'utf8') / 1024;

    // Create new pattern record
    const newPatternName = `Mirrored - ${originalPattern.name || design.name}`;

    const newPattern = await Pattern.create({
      user_id: originalPattern.user_id,
      design_id: originalPattern.design_id,
      name: newPatternName,
      measurements_used: originalPattern.measurements_used,
      settings_used: originalPattern.settings_used,
      svg_data: svg,
      svg_size_kb: sizeKb,
      status: 'draft',
    });

    // Fetch created pattern for response
    const createdPattern = await Pattern.findByPk(newPattern.id, {
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
      message: 'Mirrored pattern generated successfully',
      data: createdPattern,
    });

  } catch (error: any) {
    console.error('Generate mirrored pattern error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while generating mirrored pattern',
      error: error.message
    });
  }
};

export const exportPatternToPLT = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const pattern = await Pattern.findByPk(id);
    if (!pattern) {
      return res.status(404).json({
        success: false,
        message: 'Pattern not found',
      });
    }

    if (!pattern.svg_data) {
      return res.status(400).json({
        success: false,
        message: 'Pattern has no SVG data',
      });
    }

    const service = new TailorFitService();
    const result = await service.process(pattern.svg_data);

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);

  } catch (error) {
    console.error('Export PLT error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during PLT export',
    });
  }
};

export const getOrderedPatterns = async (req: Request, res: Response) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const orderedPatterns = await OrderedPattern.findAll({
            include: [
                {
                    model: Order,
                    as: 'order',
                    attributes: ['id', 'order_number', 'status']
                },
                {
                    model: Pattern,
                    as: 'pattern',
                    include: [
                        {
                            model: Design,
                            as: 'design',
                            attributes: ['id', 'name', 'image_url']
                        }
                    ]
                }
            ],
            order: [['created_at', 'DESC']]
        });

        res.json({
            success: true,
            data: orderedPatterns,
            count: orderedPatterns.length
        });
    } catch (error) {
        console.error('Get ordered patterns error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
