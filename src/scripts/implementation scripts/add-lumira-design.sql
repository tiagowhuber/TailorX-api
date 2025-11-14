-- Add Lumira Leggings design to the database
-- Required measurements from FreeSewing documentation:
-- waist, waistBack, hips, seat, seatBack, upperLeg, knee, ankle, heel,
-- inseam, crossSeam, crossSeamFront, waistToFloor, waistToKnee, 
-- waistToUpperLeg, waistToSeat, waistToHips

-- Insert Lumira design
INSERT INTO designs (name, description, freesewing_pattern, base_price, default_settings) VALUES
    (
        'Lumira Leggings',
        'A FreeSewing pattern for leggings',
        'lumira',
        16000,
        '{"sa": 10, "complete": true, "paperless": false}'::jsonb
    );

-- Link Lumira design to its required measurements
INSERT INTO design_measurements (design_id, measurement_type_id, is_required)
SELECT 
    (SELECT id FROM designs WHERE freesewing_pattern = 'lumira'), 
    id, 
    true
FROM measurement_types
WHERE freesewing_key IN (
    'waist',
    'waistBack',
    'hips',
    'seat',
    'seatBack',
    'upperLeg',
    'knee',
    'ankle',
    'heel',
    'inseam',
    'crossSeam',
    'crossSeamFront',
    'waistToFloor',
    'waistToKnee',
    'waistToUpperLeg',
    'waistToSeat',
    'waistToHips'
);
