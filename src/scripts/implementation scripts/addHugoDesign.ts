import dotenv from 'dotenv';
dotenv.config();

import { Design, MeasurementType, DesignMeasurement, sequelize } from '../../models';

async function addDesigns() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // --- Helper to ensure measurement types exist ---
    const ensureMeasurementType = async (key: string, name: string, description: string) => {
        const [mt, created] = await MeasurementType.findOrCreate({
            where: { freesewing_key: key },
            defaults: {
                name,
                description,
                freesewing_key: key
            }
        });
        if (created) console.log(`Created measurement type: ${name} (${key})`);
        return mt;
    };

    // Ensure required measurements for new designs exist
    await ensureMeasurementType('waistToFloor', 'Waist to Floor', 'Distance from waist to floor');
    await ensureMeasurementType('waist', 'Waist Circumference', 'Natural waist circumference');

    // --- Define Designs ---
    const designs = [
        {
            key: 'hugo',
            name: 'Hugo Hoodie',
            description: 'A simple, classic hoodie pattern.',
            price: 25000,
            image: '/assets/model-images/hugo.jpg',
            measurements: [
                'biceps', 'chest', 'head', 'hips', 'hpsToWaistBack', 
                'neck', 'shoulderSlope', 'shoulderToShoulder', 'waistToHips', 'wrist'
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
                'shoulderToShoulder', 'waistToArmpit', 'waistToHips', 'hips'
                // Note: hpsToBust sometimes listed but often optional/omitted for basic Aaron. 
                // We'll stick to the core ones found in initDb key list + what typical males use.
                // Actually, initDb included 'hpsToBust'. Let's include it if it exists.
                , 'hpsToBust'
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
        }
    ];

    for (const d of designs) {
        // 1. Create or Find the Design
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

        if (created) {
            console.log(`${d.name} created.`);
        } else {
            console.log(`${d.name} already exists.`);
        }

        // 2. Find MeasurementType IDs
        const measurementTypes = await MeasurementType.findAll({
            where: {
                freesewing_key: d.measurements
            }
        });

        if (measurementTypes.length === 0) {
            console.error(`No matching measurement types found for ${d.name}.`);
            continue;
        }

        // 3. Link Measurements to Design
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
        console.log(`Linked ${linkedCount} measurements to ${d.name}.`);
    }

    console.log('Design setup complete.');

  } catch (error) {
    console.error('Error adding designs:', error);
  } finally {
    await sequelize.close();
  }
}

addDesigns();
