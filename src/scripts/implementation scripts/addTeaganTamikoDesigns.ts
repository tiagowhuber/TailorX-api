import dotenv from 'dotenv';
dotenv.config();

import { Design, MeasurementType, DesignMeasurement, sequelize } from '../../models';

const DESIGN_CONFIGS = [
    {
        key: 'teagan',
        name: 'Teagan T-shirt',
        description: 'A FreeSewing pattern for a T-shirt.',
        price: 22000,
        image: '/assets/model-images/teagan.jpg',
        measurements: [
            'biceps', 'chest', 'hpsToBust', 'hpsToWaistBack', 'neck',
            'shoulderSlope', 'shoulderToShoulder', 'waistToArmpit', 'waistToHips',
            'hips', 'waist', 'shoulderToWrist', 'wrist'
        ]
    },
    {
        key: 'tamiko',
        name: 'Tamiko top',
        description: 'A FreeSewing pattern for a zero-waste top.',
        price: 21000,
        image: '/assets/model-images/tamiko.jpg',
        measurements: [
            'shoulderToShoulder', 'chest', 'hpsToWaistBack', 'shoulderSlope', 'waistToHips'
        ]
    }
];

const MEASUREMENT_DETAILS: Record<string, { name: string; description: string }> = {
    'waist': { name: 'Waist Circumference', description: 'Natural waist circumference' },
    'shoulderToWrist': { name: 'Shoulder to Wrist', description: 'Length from shoulder to wrist' },
    'wrist': { name: 'Wrist Circumference', description: 'Circumference of the wrist' }
};

async function addTeaganTamikoDesigns() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        // 1. Ensure all measurement types exist
        for (const design of DESIGN_CONFIGS) {
            for (const key of design.measurements) {
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
            else console.log(`${d.name} already exists, checking measurements...`);

            const measurementTypes = await MeasurementType.findAll({
                where: { freesewing_key: d.measurements }
            });

            let linkedCount = 0;
            for (const mt of measurementTypes) {
                const [, linked] = await DesignMeasurement.findOrCreate({
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

        console.log('Teagan and Tamiko designs added successfully.');
    } catch (error) {
        console.error('Error adding designs:', error);
    } finally {
        await sequelize.close();
    }
}

addTeaganTamikoDesigns();
