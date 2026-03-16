import dotenv from 'dotenv';
dotenv.config();

import { Design, MeasurementType, DesignMeasurement, sequelize } from '../../models';

// Map of FreeSewing pattern keys to their required measurements (FreeSewing keys)
const DESIGN_CONFIGS = [
    {
        key: 'brian',
        name: 'Brian Body Block',
        description: 'A basic body block for menswear.',
        price: 10000,
        image: '/assets/model-images/brian.jpg',
        measurements: [
            'biceps', 'chest', 'hpsToWaistBack', 'neck', 'shoulderSlope', 
            'shoulderToShoulder', 'waistToHips', 'hips', 'shoulderToWrist', 'wrist'
        ]
    },
    {
        key: 'sven',
        name: 'Sven Sweatshirt',
        description: 'A classic sweatshirt pattern.',
        price: 22000,
        image: '/assets/model-images/sven.jpg',
        measurements: [
            'biceps', 'chest', 'hpsToWaistBack', 'neck', 'shoulderSlope', 
            'shoulderToShoulder', 'waistToHips', 'hips', 'shoulderToWrist', 'wrist', 'head'
        ]
    },
    {
        key: 'sandy',
        name: 'Sandy Circle Skirt',
        description: 'A simple circle skirt with waistband.',
        price: 22000,
        image: '/assets/model-images/sandy.jpg',
        measurements: [
            'waist', 'waistToFloor', 'waistToHips', 'hips'
        ]
    },
    {
        key: 'diana',
        name: 'Diana Draped Top',
        description: 'A top with a draped neck.',
        price: 24000,
        image: '/assets/model-images/diana.jpg',
        measurements: [
            'biceps', 'chest', 'hpsToWaistBack', 'neck', 'shoulderSlope',
            'shoulderToShoulder', 'waistToArmpit', 'waistToHips', 'hips', 'hpsToBust'
        ]
    }
];

// Helper to get friendly names for new keys
const MEASUREMENT_DETAILS: Record<string, {name: string, description: string}> = {
    'head': { name: 'Head Circumference', description: 'Circumference of the head' },
    'shoulderToWrist': { name: 'Shoulder to Wrist', description: 'Length from shoulder to wrist' },
    'wrist': { name: 'Wrist Circumference', description: 'Circumference of the wrist' },
    'waistToFloor': { name: 'Waist to Floor', description: 'Distance from waist to floor' },
    'waist': { name: 'Waist Circumference', description: 'Natural waist circumference' }
};

async function ensureDesignMeasurements() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // 1. Ensure all measurement types exist
    for (const design of DESIGN_CONFIGS) {
        for (const key of design.measurements) {
            // Check if key is already in DB or we need to add it
            const existing = await MeasurementType.findOne({ where: { freesewing_key: key } });
            
            if (!existing) {
                const details = MEASUREMENT_DETAILS[key] || { 
                    name: key.charAt(0).toUpperCase() + key.slice(1), 
                    description: `Measurement for ${key}` 
                };
                
                await MeasurementType.create({
                    name: details.name,
                    description: details.description,
                    freesewing_key: key
                });
                console.log(`Created missing measurement type: ${details.name} (${key})`);
            }
        }
    }

    // 2. Process Designs
    for (const d of DESIGN_CONFIGS) {
        // Find or Create Design
        const [design, created] = await Design.findOrCreate({
            where: { freesewing_pattern: d.key },
            defaults: {
                name: d.name,
                description: d.description,
                freesewing_pattern: d.key,
                base_price: d.price,
                image_url: d.image,
                default_settings: {
                    sa: 10,
                    complete: true,
                    paperless: false,
                    only: null
                },
                is_active: true
            }
        });

        if (created) console.log(`${d.name} created.`);
        else console.log(`Checking measurements for ${d.name}...`);

        // Find IDs for required measurements
        const measurementTypes = await MeasurementType.findAll({
            where: {
                freesewing_key: d.measurements
            }
        });

        // Link them
        let linkedCount = 0;
        for (const mt of measurementTypes) {
            const [dm, linked] = await DesignMeasurement.findOrCreate({
                where: {
                    design_id: design.id,
                    measurement_type_id: mt.id
                },
                defaults: {
                    design_id: design.id,
                    measurement_type_id: mt.id,
                    is_required: true
                }
            });
            if (linked) linkedCount++;
        }
        
        if (linkedCount > 0) {
            console.log(`Linked ${linkedCount} new measurements to ${d.name}.`);
        }
    }

    console.log('All designs verified and updated.');

  } catch (error) {
    console.error('Error updating designs:', error);
  } finally {
    await sequelize.close();
  }
}

ensureDesignMeasurements();
