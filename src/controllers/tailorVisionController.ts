import { Request, Response } from 'express';
import { UserMeasurement, MeasurementType } from '../models';
import multer from 'multer';

// Configure multer for memory storage
const storage = multer.memoryStorage();
export const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Mapping from TailorVision keys to FreeSewing keys (or database measurement names)
// Since TailorVision now returns FreeSewing keys directly, this mapping is mostly for legacy or specific overrides.
const MEASUREMENT_MAPPING: Record<string, string> = {
  'neck_circumference': 'neck',
  'chest_circumference': 'chest',
  'waist_circumference': 'waist',
  'hips_circumference': 'hips',
  'knee_circumference': 'knee',
  'wrist_circumference': 'wrist',
  'biceps_circumference': 'biceps',
  'shoulder_to_shoulder': 'shoulderToShoulder',
  'shoulder_to_wrist': 'shoulderToWrist',
  'shoulder_to_elbow': 'shoulderToElbow',
  'waist_to_floor': 'waistToFloor',
  'waist_to_knee': 'waistToKnee',
  'inseam': 'inseam',
  'height_calculated': 'height',
  // New keys are already in camelCase from Python, but adding here for completeness if Python reverts
  'hps_to_bust': 'hpsToBust',
  'hps_to_waist_back': 'hpsToWaistBack',
  'waist_to_hips': 'waistToHips',
  'waist_to_seat': 'waistToSeat',
  'waist_to_armpit': 'waistToArmpit',
  'waist_to_upper_leg': 'waistToUpperLeg',
  'shoulder_slope': 'shoulderSlope'
};

export const generateMeasurements = async (req: Request, res: Response) => {
  try {
    const { height_cm } = req.body;
    const userId = (req as any).user?.id; // Assuming auth middleware populates user

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const frontImage = files['front_image']?.[0];
    const sideImage = files['side_image']?.[0];

    if (!frontImage || !sideImage || !height_cm) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: front_image, side_image, height_cm' 
      });
    }

    // Prepare FormData for TailorVision
    const formData = new FormData();
    formData.append('front_image', new Blob([frontImage.buffer as any], { type: frontImage.mimetype }), 'front.jpg');
    formData.append('side_image', new Blob([sideImage.buffer as any], { type: sideImage.mimetype }), 'side.jpg');
    formData.append('height_cm', height_cm.toString());

    // Call TailorVision API
    const tailorVisionUrl = process.env.TAILORVISION_URL || 'http://localhost:8000';
    console.log(`Calling TailorVision at ${tailorVisionUrl}/measure`);
    
    const response = await fetch(`${tailorVisionUrl}/measure`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TailorVision API error:', errorText);
      return res.status(response.status).json({ 
        success: false, 
        message: `TailorVision API error: ${response.statusText}`,
        details: errorText
      });
    }

    const result = await response.json();
    const { measurements, warnings } = result;

    // Save measurements to database
    const savedIds = [];
    const errors = [];

    // Get all measurement types to map IDs
    const measurementTypes = await MeasurementType.findAll();
    const typeMap = new Map(measurementTypes.map(t => [t.freesewing_key, t.id]));
    
    // Also map by name just in case
    const nameMap = new Map(measurementTypes.map(t => [t.name.toLowerCase(), t.id]));

    for (const [key, value] of Object.entries(measurements)) {
      const mappedKey = MEASUREMENT_MAPPING[key] || key;
      let typeId = typeMap.get(mappedKey);

      if (!typeId) {
        // Try finding by name (e.g. "Neck Circumference" -> "neck_circumference" -> "neck")
        // Or direct name match
        typeId = nameMap.get(key.replace(/_/g, ' ').toLowerCase());
      }

      if (typeId) {
        try {
          // Check if exists
          const existing = await UserMeasurement.findOne({
            where: { user_id: userId, measurement_type_id: typeId }
          });

          if (existing) {
            await existing.update({ value: Number(value) });
            savedIds.push(existing.id);
          } else {
            const created = await UserMeasurement.create({
              user_id: userId,
              measurement_type_id: typeId,
              value: Number(value)
            });
            savedIds.push(created.id);
          }
        } catch (err) {
          console.error(`Error saving measurement ${key}:`, err);
          errors.push({ key, error: 'Database error' });
        }
      } else {
        // console.warn(`No measurement type found for key: ${key} (mapped: ${mappedKey})`);
        // Optionally create it? For now, just skip.
      }
    }

    // Fetch the saved measurements with their types to return to frontend
    const savedMeasurements = await UserMeasurement.findAll({
      where: { id: savedIds },
      include: [{ model: MeasurementType, as: 'measurementType' }]
    });

    res.json({
      success: true,
      message: 'Measurements generated and saved successfully',
      data: {
        measurements: savedMeasurements,
        raw_measurements: measurements,
        warnings,
        debug_images: result.debug_images // Pass these through if frontend wants to show them
      }
    });

  } catch (error) {
    console.error('Generate measurements error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
