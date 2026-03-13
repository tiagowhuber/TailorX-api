import dotenv from 'dotenv';
dotenv.config();

import { Design, MeasurementType, DesignMeasurement, sequelize } from '../../models';

const WARALEE_CONFIG = {
    key: 'waralee',
    name: 'Waralee wrap pants',
    description: 'A FreeSewing pattern for wrap pants.',
    price: 24000,
    image: '/assets/model-images/waralee.jpg',
    // Required measurements (is_required: true)
    requiredMeasurements: ['seat', 'inseam', 'crotchDepth', 'waistToHips'],
    // Optional measurements (is_required: false)
    optionalMeasurements: ['waist', 'waistBack']
};

const NEW_MEASUREMENT_DETAILS: Record<string, { name: string; description: string }> = {
    'crotchDepth': { name: 'Crotch Depth', description: 'Distance from waist to crotch level' },
    'waistBack': { name: 'Waist Back', description: 'Back waist measurement' }
};

async function addWaraleeAndRemoveLumira() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        // 1. Deactivate Lumira Leggings
        const lumira = await Design.findOne({ where: { freesewing_pattern: 'lumira' } });
        if (lumira) {
            await lumira.update({ is_active: false });
            console.log('Lumira Leggings deactivated.');
        } else {
            console.log('Lumira Leggings not found in DB (nothing to deactivate).');
        }

        // 2. Ensure all measurement types exist for Waralee
        const allMeasurements = [...WARALEE_CONFIG.requiredMeasurements, ...WARALEE_CONFIG.optionalMeasurements];
        for (const key of allMeasurements) {
            const existing = await MeasurementType.findOne({ where: { freesewing_key: key } });
            if (!existing) {
                const details = NEW_MEASUREMENT_DETAILS[key] || {
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

        // 3. Create Waralee design
        const [design, created] = await Design.findOrCreate({
            where: { freesewing_pattern: WARALEE_CONFIG.key },
            defaults: {
                name: WARALEE_CONFIG.name,
                description: WARALEE_CONFIG.description,
                freesewing_pattern: WARALEE_CONFIG.key,
                base_price: WARALEE_CONFIG.price,
                image_url: WARALEE_CONFIG.image,
                default_settings: {
                    sa: 10,
                    complete: true,
                    paperless: false,
                    only: null
                },
                is_active: true
            }
        });

        if (created) console.log('Waralee wrap pants created.');
        else console.log('Waralee wrap pants already exists, checking measurements...');

        // 4. Link required measurements
        const requiredTypes = await MeasurementType.findAll({
            where: { freesewing_key: WARALEE_CONFIG.requiredMeasurements }
        });
        let linkedCount = 0;
        for (const mt of requiredTypes) {
            const [, linked] = await DesignMeasurement.findOrCreate({
                where: { design_id: design.id, measurement_type_id: mt.id },
                defaults: { design_id: design.id, measurement_type_id: mt.id, is_required: true }
            });
            if (linked) linkedCount++;
        }

        // 5. Link optional measurements
        const optionalTypes = await MeasurementType.findAll({
            where: { freesewing_key: WARALEE_CONFIG.optionalMeasurements }
        });
        for (const mt of optionalTypes) {
            const [, linked] = await DesignMeasurement.findOrCreate({
                where: { design_id: design.id, measurement_type_id: mt.id },
                defaults: { design_id: design.id, measurement_type_id: mt.id, is_required: false }
            });
            if (linked) linkedCount++;
        }

        if (linkedCount > 0) {
            console.log(`Linked ${linkedCount} measurements to Waralee wrap pants.`);
        }

        console.log('Done.');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

addWaraleeAndRemoveLumira();
