
import dotenv from 'dotenv';
dotenv.config();

import { Design, MeasurementType, DesignMeasurement, sequelize } from '../../models';

async function addPenelopeDesign() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // 1. Create or Find the Penelope Design
    const [penelope, created] = await Design.findOrCreate({
      where: { freesewing_pattern: 'penelope' },
      defaults: {
        name: 'Penelope Pencil Skirt',
        description: 'A classic pencil skirt pattern.',
        freesewing_pattern: 'penelope',
        base_price: 20000,
        image_url: '/assets/model-images/penelope.jpg', // Placeholder
        default_settings: {
          sa: 10,
          complete: true,
          paperless: false
        },
        is_active: true
      }
    });

    if (created) {
      console.log('Penelope design created.');
    } else {
      console.log('Penelope design already exists.');
    }

    // 2. Define Required Measurements keys for Penelope
    // Based on standard FreeSewing Penelope requirements mentioned in the image
    const requiredMeasurements = [
      'waist',
      'seat',
      'waistToHips',
      'waistToSeat',
      'waistToKnee'
    ];

    // Optional ones: waistBack, seatBack - we can handle them if desired, but let's stick to required for now to ensure generation works.

    // 3. Find MeasurementType IDs
    const measurementTypes = await MeasurementType.findAll({
      where: {
        freesewing_key: requiredMeasurements
      }
    });

    if (measurementTypes.length === 0) {
      console.error('No matching measurement types found.');
      return;
    }

    // 4. Link Measurements to Design
    for (const mt of measurementTypes) {
      await DesignMeasurement.findOrCreate({
        where: {
          design_id: penelope.id,
          measurement_type_id: mt.id
        },
        defaults: {
          design_id: penelope.id,
          measurement_type_id: mt.id,
          is_required: true
        }
      });
      console.log(`Linked ${mt.name} (${mt.freesewing_key}) to Penelope.`);
    }

    console.log('Penelope setup complete.');

  } catch (error) {
    console.error('Error adding Penelope design:', error);
  } finally {
    await sequelize.close();
  }
}

addPenelopeDesign();
