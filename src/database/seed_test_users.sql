-- =============================================================================
-- TailorX — Test Users Seed
-- 5 users, each with ALL 38 measurement types (values in mm; shoulderSlope in °)
-- Password for ALL test users: "password"
-- Hash below is a valid bcrypt (cost 10) hash of the string "password"
-- =============================================================================

-- ─── USERS ───────────────────────────────────────────────────────────────────

INSERT INTO users (email, password_hash, first_name, last_name, phone, role)
VALUES
  ('ana.garcia@tailorx.test',         '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPVyWIfHu2S', 'Ana',    'García',    '+56912340001', 'user'),
  ('carlos.rodriguez@tailorx.test',   '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPVyWIfHu2S', 'Carlos', 'Rodríguez', '+56912340002', 'user'),
  ('maria.lopez@tailorx.test',        '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPVyWIfHu2S', 'María',  'López',     '+56912340003', 'user'),
  ('diego.martinez@tailorx.test',     '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPVyWIfHu2S', 'Diego',  'Martínez',  '+56912340004', 'user'),
  ('sofia.torres@tailorx.test',       '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPVyWIfHu2S', 'Sofía',  'Torres',    '+56912340005', 'user');


-- =============================================================================
-- MEASUREMENTS
-- One INSERT … SELECT covering all 5 users × 38 measurements = 190 rows.
-- IDs are resolved by email / freesewing_key — nothing is hardcoded.
-- =============================================================================

INSERT INTO user_measurements (user_id, measurement_type_id, value)
SELECT u.id, mt.id, v.value
FROM (VALUES

  -- ─────────────────────────────────────────────────────────────────────────
  -- 1. ANA GARCÍA  |  average woman  |  ~165 cm  |  EU 40 / US M
  -- ─────────────────────────────────────────────────────────────────────────
  ('ana.garcia@tailorx.test', 'ankle',               215),
  ('ana.garcia@tailorx.test', 'biceps',              290),
  ('ana.garcia@tailorx.test', 'bustFront',           470),
  ('ana.garcia@tailorx.test', 'bustPointToUnderbust',110),
  ('ana.garcia@tailorx.test', 'bustSpan',            190),
  ('ana.garcia@tailorx.test', 'chest',               880),
  ('ana.garcia@tailorx.test', 'crossSeam',           720),
  ('ana.garcia@tailorx.test', 'crossSeamFront',      280),
  ('ana.garcia@tailorx.test', 'crotchDepth',         265),
  ('ana.garcia@tailorx.test', 'heel',                320),
  ('ana.garcia@tailorx.test', 'head',                560),
  ('ana.garcia@tailorx.test', 'highBust',            820),
  ('ana.garcia@tailorx.test', 'highBustFront',       410),
  ('ana.garcia@tailorx.test', 'hips',                960),
  ('ana.garcia@tailorx.test', 'hpsToBust',           280),
  ('ana.garcia@tailorx.test', 'hpsToWaistBack',      410),
  ('ana.garcia@tailorx.test', 'hpsToWaistFront',     390),
  ('ana.garcia@tailorx.test', 'inseam',              780),
  ('ana.garcia@tailorx.test', 'knee',                365),
  ('ana.garcia@tailorx.test', 'neck',                360),
  ('ana.garcia@tailorx.test', 'seat',                950),
  ('ana.garcia@tailorx.test', 'seatBack',            480),
  ('ana.garcia@tailorx.test', 'shoulderSlope',        13),
  ('ana.garcia@tailorx.test', 'shoulderToElbow',     360),
  ('ana.garcia@tailorx.test', 'shoulderToShoulder',  385),
  ('ana.garcia@tailorx.test', 'shoulderToWrist',     590),
  ('ana.garcia@tailorx.test', 'underbust',           740),
  ('ana.garcia@tailorx.test', 'upperLeg',            570),
  ('ana.garcia@tailorx.test', 'waist',               700),
  ('ana.garcia@tailorx.test', 'waistBack',           350),
  ('ana.garcia@tailorx.test', 'waistToArmpit',       220),
  ('ana.garcia@tailorx.test', 'waistToFloor',       1020),
  ('ana.garcia@tailorx.test', 'waistToHips',         200),
  ('ana.garcia@tailorx.test', 'waistToKnee',         580),
  ('ana.garcia@tailorx.test', 'waistToSeat',         250),
  ('ana.garcia@tailorx.test', 'waistToUnderbust',    100),
  ('ana.garcia@tailorx.test', 'waistToUpperLeg',     300),
  ('ana.garcia@tailorx.test', 'wrist',               155),

  -- ─────────────────────────────────────────────────────────────────────────
  -- 2. CARLOS RODRÍGUEZ  |  average man  |  ~178 cm  |  EU 50 / US M-L
  -- ─────────────────────────────────────────────────────────────────────────
  ('carlos.rodriguez@tailorx.test', 'ankle',               230),
  ('carlos.rodriguez@tailorx.test', 'biceps',              350),
  ('carlos.rodriguez@tailorx.test', 'bustFront',           510),
  ('carlos.rodriguez@tailorx.test', 'bustPointToUnderbust', 80),
  ('carlos.rodriguez@tailorx.test', 'bustSpan',            210),
  ('carlos.rodriguez@tailorx.test', 'chest',              1000),
  ('carlos.rodriguez@tailorx.test', 'crossSeam',           780),
  ('carlos.rodriguez@tailorx.test', 'crossSeamFront',      320),
  ('carlos.rodriguez@tailorx.test', 'crotchDepth',         280),
  ('carlos.rodriguez@tailorx.test', 'heel',                350),
  ('carlos.rodriguez@tailorx.test', 'head',                580),
  ('carlos.rodriguez@tailorx.test', 'highBust',            950),
  ('carlos.rodriguez@tailorx.test', 'highBustFront',       480),
  ('carlos.rodriguez@tailorx.test', 'hips',               1000),
  ('carlos.rodriguez@tailorx.test', 'hpsToBust',           230),
  ('carlos.rodriguez@tailorx.test', 'hpsToWaistBack',      450),
  ('carlos.rodriguez@tailorx.test', 'hpsToWaistFront',     430),
  ('carlos.rodriguez@tailorx.test', 'inseam',              830),
  ('carlos.rodriguez@tailorx.test', 'knee',                380),
  ('carlos.rodriguez@tailorx.test', 'neck',                400),
  ('carlos.rodriguez@tailorx.test', 'seat',               1000),
  ('carlos.rodriguez@tailorx.test', 'seatBack',            510),
  ('carlos.rodriguez@tailorx.test', 'shoulderSlope',        13),
  ('carlos.rodriguez@tailorx.test', 'shoulderToElbow',     380),
  ('carlos.rodriguez@tailorx.test', 'shoulderToShoulder',  455),
  ('carlos.rodriguez@tailorx.test', 'shoulderToWrist',     630),
  ('carlos.rodriguez@tailorx.test', 'underbust',           920),
  ('carlos.rodriguez@tailorx.test', 'upperLeg',            580),
  ('carlos.rodriguez@tailorx.test', 'waist',               860),
  ('carlos.rodriguez@tailorx.test', 'waistBack',           430),
  ('carlos.rodriguez@tailorx.test', 'waistToArmpit',       240),
  ('carlos.rodriguez@tailorx.test', 'waistToFloor',       1090),
  ('carlos.rodriguez@tailorx.test', 'waistToHips',         210),
  ('carlos.rodriguez@tailorx.test', 'waistToKnee',         620),
  ('carlos.rodriguez@tailorx.test', 'waistToSeat',         260),
  ('carlos.rodriguez@tailorx.test', 'waistToUnderbust',     80),
  ('carlos.rodriguez@tailorx.test', 'waistToUpperLeg',     320),
  ('carlos.rodriguez@tailorx.test', 'wrist',               175),

  -- ─────────────────────────────────────────────────────────────────────────
  -- 3. MARÍA LÓPEZ  |  plus-size woman  |  ~162 cm  |  EU 48 / US 1X
  -- ─────────────────────────────────────────────────────────────────────────
  ('maria.lopez@tailorx.test', 'ankle',               250),
  ('maria.lopez@tailorx.test', 'biceps',              370),
  ('maria.lopez@tailorx.test', 'bustFront',           590),
  ('maria.lopez@tailorx.test', 'bustPointToUnderbust',130),
  ('maria.lopez@tailorx.test', 'bustSpan',            220),
  ('maria.lopez@tailorx.test', 'chest',              1120),
  ('maria.lopez@tailorx.test', 'crossSeam',           820),
  ('maria.lopez@tailorx.test', 'crossSeamFront',      320),
  ('maria.lopez@tailorx.test', 'crotchDepth',         275),
  ('maria.lopez@tailorx.test', 'heel',                340),
  ('maria.lopez@tailorx.test', 'head',                570),
  ('maria.lopez@tailorx.test', 'highBust',           1020),
  ('maria.lopez@tailorx.test', 'highBustFront',       510),
  ('maria.lopez@tailorx.test', 'hips',               1200),
  ('maria.lopez@tailorx.test', 'hpsToBust',           290),
  ('maria.lopez@tailorx.test', 'hpsToWaistBack',      420),
  ('maria.lopez@tailorx.test', 'hpsToWaistFront',     400),
  ('maria.lopez@tailorx.test', 'inseam',              760),
  ('maria.lopez@tailorx.test', 'knee',                420),
  ('maria.lopez@tailorx.test', 'neck',                390),
  ('maria.lopez@tailorx.test', 'seat',               1200),
  ('maria.lopez@tailorx.test', 'seatBack',            610),
  ('maria.lopez@tailorx.test', 'shoulderSlope',        15),
  ('maria.lopez@tailorx.test', 'shoulderToElbow',     355),
  ('maria.lopez@tailorx.test', 'shoulderToShoulder',  415),
  ('maria.lopez@tailorx.test', 'shoulderToWrist',     580),
  ('maria.lopez@tailorx.test', 'underbust',           920),
  ('maria.lopez@tailorx.test', 'upperLeg',            680),
  ('maria.lopez@tailorx.test', 'waist',               980),
  ('maria.lopez@tailorx.test', 'waistBack',           490),
  ('maria.lopez@tailorx.test', 'waistToArmpit',       215),
  ('maria.lopez@tailorx.test', 'waistToFloor',       1000),
  ('maria.lopez@tailorx.test', 'waistToHips',         195),
  ('maria.lopez@tailorx.test', 'waistToKnee',         565),
  ('maria.lopez@tailorx.test', 'waistToSeat',         245),
  ('maria.lopez@tailorx.test', 'waistToUnderbust',    110),
  ('maria.lopez@tailorx.test', 'waistToUpperLeg',     290),
  ('maria.lopez@tailorx.test', 'wrist',               165),

  -- ─────────────────────────────────────────────────────────────────────────
  -- 4. DIEGO MARTÍNEZ  |  athletic man, broad shoulders  |  ~183 cm
  -- ─────────────────────────────────────────────────────────────────────────
  ('diego.martinez@tailorx.test', 'ankle',               245),
  ('diego.martinez@tailorx.test', 'biceps',              400),
  ('diego.martinez@tailorx.test', 'bustFront',           540),
  ('diego.martinez@tailorx.test', 'bustPointToUnderbust', 85),
  ('diego.martinez@tailorx.test', 'bustSpan',            220),
  ('diego.martinez@tailorx.test', 'chest',              1060),
  ('diego.martinez@tailorx.test', 'crossSeam',           810),
  ('diego.martinez@tailorx.test', 'crossSeamFront',      330),
  ('diego.martinez@tailorx.test', 'crotchDepth',         290),
  ('diego.martinez@tailorx.test', 'heel',                365),
  ('diego.martinez@tailorx.test', 'head',                590),
  ('diego.martinez@tailorx.test', 'highBust',           1000),
  ('diego.martinez@tailorx.test', 'highBustFront',       510),
  ('diego.martinez@tailorx.test', 'hips',               1020),
  ('diego.martinez@tailorx.test', 'hpsToBust',           240),
  ('diego.martinez@tailorx.test', 'hpsToWaistBack',      470),
  ('diego.martinez@tailorx.test', 'hpsToWaistFront',     450),
  ('diego.martinez@tailorx.test', 'inseam',              850),
  ('diego.martinez@tailorx.test', 'knee',                400),
  ('diego.martinez@tailorx.test', 'neck',                420),
  ('diego.martinez@tailorx.test', 'seat',               1020),
  ('diego.martinez@tailorx.test', 'seatBack',            520),
  ('diego.martinez@tailorx.test', 'shoulderSlope',        12),
  ('diego.martinez@tailorx.test', 'shoulderToElbow',     395),
  ('diego.martinez@tailorx.test', 'shoulderToShoulder',  500),
  ('diego.martinez@tailorx.test', 'shoulderToWrist',     655),
  ('diego.martinez@tailorx.test', 'underbust',           980),
  ('diego.martinez@tailorx.test', 'upperLeg',            620),
  ('diego.martinez@tailorx.test', 'waist',               820),
  ('diego.martinez@tailorx.test', 'waistBack',           410),
  ('diego.martinez@tailorx.test', 'waistToArmpit',       255),
  ('diego.martinez@tailorx.test', 'waistToFloor',       1120),
  ('diego.martinez@tailorx.test', 'waistToHips',         220),
  ('diego.martinez@tailorx.test', 'waistToKnee',         640),
  ('diego.martinez@tailorx.test', 'waistToSeat',         270),
  ('diego.martinez@tailorx.test', 'waistToUnderbust',     80),
  ('diego.martinez@tailorx.test', 'waistToUpperLeg',     330),
  ('diego.martinez@tailorx.test', 'wrist',               185),

  -- ─────────────────────────────────────────────────────────────────────────
  -- 5. SOFÍA TORRES  |  petite woman  |  ~155 cm  |  EU 34 / US XS
  -- ─────────────────────────────────────────────────────────────────────────
  ('sofia.torres@tailorx.test', 'ankle',               200),
  ('sofia.torres@tailorx.test', 'biceps',              260),
  ('sofia.torres@tailorx.test', 'bustFront',           420),
  ('sofia.torres@tailorx.test', 'bustPointToUnderbust',100),
  ('sofia.torres@tailorx.test', 'bustSpan',            170),
  ('sofia.torres@tailorx.test', 'chest',               820),
  ('sofia.torres@tailorx.test', 'crossSeam',           680),
  ('sofia.torres@tailorx.test', 'crossSeamFront',      260),
  ('sofia.torres@tailorx.test', 'crotchDepth',         255),
  ('sofia.torres@tailorx.test', 'heel',                305),
  ('sofia.torres@tailorx.test', 'head',                545),
  ('sofia.torres@tailorx.test', 'highBust',            770),
  ('sofia.torres@tailorx.test', 'highBustFront',       385),
  ('sofia.torres@tailorx.test', 'hips',                890),
  ('sofia.torres@tailorx.test', 'hpsToBust',           255),
  ('sofia.torres@tailorx.test', 'hpsToWaistBack',      380),
  ('sofia.torres@tailorx.test', 'hpsToWaistFront',     360),
  ('sofia.torres@tailorx.test', 'inseam',              720),
  ('sofia.torres@tailorx.test', 'knee',                335),
  ('sofia.torres@tailorx.test', 'neck',                330),
  ('sofia.torres@tailorx.test', 'seat',                890),
  ('sofia.torres@tailorx.test', 'seatBack',            450),
  ('sofia.torres@tailorx.test', 'shoulderSlope',        14),
  ('sofia.torres@tailorx.test', 'shoulderToElbow',     340),
  ('sofia.torres@tailorx.test', 'shoulderToShoulder',  355),
  ('sofia.torres@tailorx.test', 'shoulderToWrist',     560),
  ('sofia.torres@tailorx.test', 'underbust',           700),
  ('sofia.torres@tailorx.test', 'upperLeg',            510),
  ('sofia.torres@tailorx.test', 'waist',               630),
  ('sofia.torres@tailorx.test', 'waistBack',           315),
  ('sofia.torres@tailorx.test', 'waistToArmpit',       200),
  ('sofia.torres@tailorx.test', 'waistToFloor',        960),
  ('sofia.torres@tailorx.test', 'waistToHips',         185),
  ('sofia.torres@tailorx.test', 'waistToKnee',         540),
  ('sofia.torres@tailorx.test', 'waistToSeat',         235),
  ('sofia.torres@tailorx.test', 'waistToUnderbust',     95),
  ('sofia.torres@tailorx.test', 'waistToUpperLeg',     280),
  ('sofia.torres@tailorx.test', 'wrist',               145)

) AS v(email, freesewing_key, value)
JOIN users             u  ON u.email              = v.email
JOIN measurement_types mt ON mt.freesewing_key    = v.freesewing_key;
