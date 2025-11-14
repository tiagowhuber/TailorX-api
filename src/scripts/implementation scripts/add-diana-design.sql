-- Add Diana Draped Top design to the database
-- Required measurements from FreeSewing documentation:
-- biceps, chest, hpsToBust, hpsToWaistBack, neck, shoulderSlope, shoulderToShoulder,
-- waistToArmpit, waistToHips, waist, shoulderToWrist, wrist

-- Insert Diana design
INSERT INTO designs (name, description, freesewing_pattern, base_price, default_settings) VALUES
    (
        'Diana Draped Top',
        'A FreeSewing pattern for a top with a draped neck',
        'diana',
        17000,
        '{"sa": 10, "complete": true, "paperless": false}'::jsonb
    );

-- Link Diana design to its required measurements
INSERT INTO design_measurements (design_id, measurement_type_id, is_required)
SELECT 
    (SELECT id FROM designs WHERE freesewing_pattern = 'diana'), 
    id, 
    true
FROM measurement_types
WHERE freesewing_key IN (
    'biceps',
    'chest',
    'hpsToBust',
    'hpsToWaistBack',
    'neck',
    'shoulderSlope',
    'shoulderToShoulder',
    'waistToArmpit',
    'waistToHips',
    'waist',
    'shoulderToWrist',
    'wrist'
);

-- Optional measurement (high bust)
INSERT INTO design_measurements (design_id, measurement_type_id, is_required)
SELECT 
    (SELECT id FROM designs WHERE freesewing_pattern = 'diana'), 
    id, 
    false
FROM measurement_types
WHERE freesewing_key = 'highBust';
