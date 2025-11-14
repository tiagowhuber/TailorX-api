-- Add Charlie Chinos design to the database
-- Required measurements from FreeSewing documentation:
-- crossSeam, crossSeamFront, knee, seat, seatBack, waist, waistBack, 
-- waistToFloor, waistToKnee, waistToHips, waistToSeat, waistToUpperLeg

-- Insert Charlie design
INSERT INTO designs (name, description, freesewing_pattern, base_price, default_settings) VALUES
    (
        'Charlie Chinos',
        'A FreeSewing pattern for chino trousers',
        'charlie',
        20000,
        '{"sa": 10, "complete": true, "paperless": false}'::jsonb
    );

-- Link Charlie design to its required measurements
INSERT INTO design_measurements (design_id, measurement_type_id, is_required)
SELECT 
    (SELECT id FROM designs WHERE freesewing_pattern = 'charlie'), 
    id, 
    true
FROM measurement_types
WHERE freesewing_key IN (
    'crossSeam',
    'crossSeamFront',
    'knee',
    'seat',
    'seatBack',
    'waist',
    'waistBack',
    'waistToFloor',
    'waistToKnee',
    'waistToHips',
    'waistToSeat',
    'waistToUpperLeg'
);
