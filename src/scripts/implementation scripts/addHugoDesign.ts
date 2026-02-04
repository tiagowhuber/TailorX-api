import dotenv from 'dotenv';
dotenv.config();

import { Design, MeasurementType, DesignMeasurement, sequelize } from '../../models';

async function addHugoDesign() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // 1. Create or Find the Hugo Design
    const [hugo, created] = await Design.findOrCreate({
      where: { freesewing_pattern: 'hugo' },
      defaults: {
        name: 'Hugo Hoodie',
        description: 'A simple, classic hoodie pattern.',
        freesewing_pattern: 'hugo',
        base_price: 25000,
        image_url: '/assets/model-images/hugo.jpg', // Placeholder
        default_settings: {
          sa: 10,
          complete: true,
          paperless: false,
          only: null // render everything
        },
        is_active: true
      }
    });

    if (created) {
      console.log('Hugo design created.');
    } else {
      console.log('Hugo design already exists.');
    }

    // 2. Define Required Measurements keys for Hugo
    // Based on standard FreeSewing Hugo requirements
    const requiredMeasurements = [
      'biceps',
      'chest',
      'head', 
      'hips',
      'hpsToWaistBack',
      'neck',
      'shoulderSlope',
      'shoulderToShoulder',
      'waistToHips',
      'wrist' // Ribbing
    ];

    // 3. Find MeasurementType IDs
    const measurementTypes = await MeasurementType.findAll({
      where: {
        freesewing_key: requiredMeasurements
      }
    });

    if (measurementTypes.length === 0) {
      console.error('No matching measurement types found. Run initDb first?');
      return;
    }

    // 4. Link Measurements to Design
    for (const mt of measurementTypes) {
      await DesignMeasurement.findOrCreate({
        where: {
          design_id: hugo.id,
          measurement_type_id: mt.id
        },
        defaults: {
          design_id: hugo.id,
          measurement_type_id: mt.id,
          is_required: true
        }
      });
      console.log(`Linked ${mt.name} (${mt.freesewing_key}) to Hugo.`);
    }

    console.log('Hugo setup complete.');

  } catch (error) {
    console.error('Error adding Hugo design:', error);
  } finally {
    await sequelize.close();
  }
}

addHugoDesign();
