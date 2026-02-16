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
            'shoulderToShoulder', 'waistToHips', 'hips', 'shoulderToWrist', 'wrist', 'head' // Head might be optional but good for neck opening
        ]
    },
    {
        key: 'hugo',
        name: 'Hugo Hoodie',
        description: 'A simple, classic hoodie pattern.',
        price: 25000,
        image: '/assets/model-images/hugo.jpg',
        measurements: [
            'biceps', 'chest', 'head', 'hips', 'hpsToWaistBack', 
            'neck', 'shoulderSlope', 'shoulderToShoulder', 'waistToHips', 'wrist', 'shoulderToWrist'
        ]
    },
    {
        key: 'aaron',
        name: 'Aaron A-Shirt',
        description: 'A simple A-shirt or tank top.',
        price: 20000,
        image: '/assets/model-images/aaron.jpg',
        measurements: [
            'biceps', 'chest', 'hpsToWaistBack', 'neck', 'shoulderSlope', 
            'shoulderToShoulder', 'waistToArmpit', 'waistToHips', 'hips', 'hpsToBust'
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
    },
    {
        key: 'penelope',
        name: 'Penelope Pencil Skirt',
        description: 'A fitted pencil skirt.',
        price: 23000,
        image: '/assets/model-images/penelope.jpg',
        measurements: [
            'waist', 'hips', 'waistToHips', 'waistToKnee', 'waistToSeat', 'seat'
            // Note: 'seat' often maps to hips in some contexts, but Penelope explicitly asks for seat.
            // We need to ensure 'seat' and 'waistToSeat' exist as measurement types.
        ]
    },
    {
        key: 'lumira',
        name: 'Lumira Leggings',
        description: 'Leggings adapted for cycling.',
        price: 26000,
        image: '/assets/model-images/lumira.jpg',
        measurements: [
             'waist', 'hips', 'waistToHips', 'inseam', 'knee', 'ankle', 
             'waistToKnee', 'waistToFloor' // Common leg measurements
             // Lumira specifically asks for:
             // waist, waistBack, hips, seat, seatBack, upperLeg, knee, ankle, heel, inseam, crossSeam, crossSeamFront...
             // For simplicity, we'll stick to a core set if possible, but let's add the specific ones.
             , 'seat', 'upperLeg', 'heel', 'crossSeam', 'crossSeamFront'
        ]
    }
];

// Helper to get friendly names for new keys
const MEASUREMENT_DETAILS: Record<string, {name: string, description: string}> = {
    'head': { name: 'Head Circumference', description: 'Circumference of the head' },
    'shoulderToWrist': { name: 'Shoulder to Wrist', description: 'Length from shoulder to wrist' },
    'wrist': { name: 'Wrist Circumference', description: 'Circumference of the wrist' },
    'waistToFloor': { name: 'Waist to Floor', description: 'Distance from waist to floor' },
    'waist': { name: 'Waist Circumference', description: 'Natural waist circumference' },
    'waistToKnee': { name: 'Waist to Knee', description: 'Distance from waist to knee' },
    'waistToSeat': { name: 'Waist to Seat', description: 'Distance from waist to seat' },
    'seat': { name: 'Seat Circumference', description: 'Circumference of the seat (fullest part of hips/buttocks)' },
    'ankle': { name: 'Ankle Circumference', description: 'Circumference of the ankle' },
    'knee': { name: 'Knee Circumference', description: 'Circumference of the knee' },
    'upperLeg': { name: 'Upper Leg Circumference', description: 'Circumference of the upper leg (thigh)' },
    'heel': { name: 'Heel Circumference', description: 'Circumference of the heel' },
    'crossSeam': { name: 'Cross Seam', description: 'Total crotch length (front waist to back waist)' },
    'crossSeamFront': { name: 'Cross Seam Front', description: 'Front crotch length' }
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
