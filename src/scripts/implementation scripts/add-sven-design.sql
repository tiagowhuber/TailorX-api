-- Add Sven Sweatshirt design to the database
-- Required measurements from FreeSewing documentation:
-- biceps, chest, hpsToWaistBack, neck, shoulderSlope, shoulderToShoulder, 
-- waistToArmpit, waistToHips, wrist, shoulderToWrist, hips, waist

-- Insert Sven design
INSERT INTO designs (name, description, freesewing_pattern, base_price, default_settings) VALUES
    (
        'Sven Sweatshirt',
        'A FreeSewing pattern for a straightforward sweater',
        'sven',
        18000,
        '{"sa": 10, "complete": true, "paperless": false}'::jsonb
    );

-- Link Sven design to its required measurements
-- Note: Adjust the design_id if you have other designs in your database
-- This assumes Sven will be design_id = 2 (after Aaron which is id = 1)
-- If you need to find the correct ID, run: SELECT id FROM designs WHERE freesewing_pattern = 'sven';

INSERT INTO design_measurements (design_id, measurement_type_id, is_required)
SELECT 
    (SELECT id FROM designs WHERE freesewing_pattern = 'sven'), 
    id, 
    true
FROM measurement_types
WHERE freesewing_key IN (
    'biceps',
    'chest', 
    'hpsToWaistBack',
    'neck',
    'shoulderSlope',
    'shoulderToShoulder',
    'waistToArmpit',
    'waistToHips',
    'wrist',
    'shoulderToWrist',
    'hips',
    'waist'
);

-- Optional measurement (high bust)
INSERT INTO design_measurements (design_id, measurement_type_id, is_required)
SELECT 
    (SELECT id FROM designs WHERE freesewing_pattern = 'sven'), 
    id, 
    false
FROM measurement_types
WHERE freesewing_key = 'highBust';
