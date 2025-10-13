import { sequelize, MeasurementType, Design, DesignMeasurement } from '../models';

export const initializeDatabase = async () => {
  try {
    // Force sync in development (this will drop and recreate tables)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ force: true });
      console.log('Database tables created!');
      
      // Insert sample measurement types
      const measurementTypes = await MeasurementType.bulkCreate([
        { name: 'Biceps Circumference', description: 'Circumference of the biceps at the widest part', freesewing_key: 'biceps' },
        { name: 'Chest Circumference', description: 'Chest circumference at the fullest part', freesewing_key: 'chest' },
        { name: 'Hips Circumference', description: 'Hip circumference at the fullest part', freesewing_key: 'hips' },
        { name: 'High Point Shoulder to Bust', description: 'Distance from shoulder point to bust point', freesewing_key: 'hpsToBust' },
        { name: 'High Point Shoulder to Waist Back', description: 'Distance from shoulder point to waist at back', freesewing_key: 'hpsToWaistBack' },
        { name: 'Neck Circumference', description: 'Neck circumference', freesewing_key: 'neck' },
        { name: 'Shoulder Slope', description: 'Shoulder slope angle in degrees', freesewing_key: 'shoulderSlope' },
        { name: 'Shoulder to Shoulder', description: 'Distance between shoulder points', freesewing_key: 'shoulderToShoulder' },
        { name: 'Waist to Armpit', description: 'Distance from waist to armpit', freesewing_key: 'waistToArmpit' },
        { name: 'Waist to Hips', description: 'Distance from waist to hips', freesewing_key: 'waistToHips' },
        { name: 'Inseam', description: 'Inseam length for pants', freesewing_key: 'inseam' },
        { name: 'Waist Circumference', description: 'Natural waist circumference', freesewing_key: 'waist' },
        { name: 'Arm Length', description: 'Shoulder to wrist length', freesewing_key: 'armLength' },
      ]);
      
      console.log('Sample measurement types created!');
      
      // Insert sample design (Aaron pattern)
      const aaronDesign = await Design.create({
        name: 'Aaron A-Shirt',
        description: 'A classic athletic tank top / A-shirt pattern',
        freesewing_pattern: 'aaron',
        base_price: 15.00,
        default_settings: { sa: 10, complete: true, paperless: false },
      });
      
      console.log('Sample design created!');
      
      // Link Aaron design to its required measurements
      const requiredMeasurementKeys = ['biceps', 'chest', 'hips', 'hpsToBust', 'hpsToWaistBack', 'neck', 'shoulderSlope', 'shoulderToShoulder', 'waistToArmpit', 'waistToHips'];
      
      for (const key of requiredMeasurementKeys) {
        const measurementType = measurementTypes.find(mt => mt.freesewing_key === key);
        if (measurementType) {
          await DesignMeasurement.create({
            design_id: aaronDesign.id,
            measurement_type_id: measurementType.id,
            is_required: true,
          });
        }
      }
      
      console.log('Design measurements linked!');
    }
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};