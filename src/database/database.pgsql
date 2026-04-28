DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA IF NOT EXISTS public;
-- Users and Authentication
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    profile_picture_url VARCHAR(500),
    phone VARCHAR(20),
    rut VARCHAR(12),
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

-- User Addresses
CREATE TABLE user_addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_name VARCHAR(255),
    street_address VARCHAR(255) NOT NULL,
    apartment_unit VARCHAR(50),
    comuna VARCHAR(100) NOT NULL,
    region VARCHAR(100) NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_addresses_user ON user_addresses(user_id);

-- Measurement Types (e.g., chest, waist, hip, biceps, neck, etc.)
CREATE TABLE measurement_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    freesewing_key VARCHAR(100) NULL, -- optional: maps to FreeSewing measurement names
    guide_image_url VARCHAR(500) NULL, -- optional: link to a guide image for this measurement
    unit VARCHAR(8) NOT NULL DEFAULT 'cm', -- display unit: 'cm' for lengths, '°' for angles
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User's Body Measurements (all in mm)
CREATE TABLE user_measurements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    measurement_type_id INTEGER NOT NULL REFERENCES measurement_types(id) ON DELETE CASCADE,
    value NUMERIC(6, 2) NOT NULL, -- in mm
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, measurement_type_id)
);

CREATE INDEX idx_user_measurements_user ON user_measurements(user_id);

-- Design Types (can use FreeSewing patterns or custom patterns)
CREATE TABLE designs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    freesewing_pattern VARCHAR(100) NULL, -- optional: e.g., 'aaron', 'bella', 'brian'
    base_price NUMERIC(10, 2) NOT NULL,
    image_url VARCHAR(500),
    default_settings JSONB, -- default settings (sa, complete, paperless, etc.)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Required measurements for each design
CREATE TABLE design_measurements (
    id SERIAL PRIMARY KEY,
    design_id INTEGER NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
    measurement_type_id INTEGER NOT NULL REFERENCES measurement_types(id) ON DELETE CASCADE,
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(design_id, measurement_type_id)
);

CREATE INDEX idx_design_measurements_design ON design_measurements(design_id);

-- User Pattern Drafts (generated patterns)
CREATE TABLE patterns (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    design_id INTEGER NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
    name VARCHAR(255), -- user can name their draft
    
    -- Pattern generation data
    measurements_used JSONB NOT NULL, -- snapshot of measurements in mm
    settings_used JSONB NOT NULL, -- pattern generation settings
    
    -- Generated SVG pattern
    svg_data TEXT NOT NULL, -- the actual SVG output
    svg_size_kb NUMERIC(10, 2), -- for tracking file sizes
    
    status VARCHAR(50) DEFAULT 'draft', -- draft, finalized, archived
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_patterns_user ON patterns(user_id);
CREATE INDEX idx_patterns_design ON patterns(design_id);
CREATE INDEX idx_patterns_status ON patterns(status);

-- Discount Codes (must be defined before orders due to FK dependency)
CREATE TABLE discount_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_type VARCHAR(20) CHECK (discount_type IN ('percentage', 'fixed_amount')),
    value NUMERIC(10, 2) NOT NULL,
    max_discount_amount NUMERIC(10, 2),
    starts_at TIMESTAMP,
    expires_at TIMESTAMP,
    max_total_uses INTEGER,
    current_total_uses INTEGER DEFAULT 0,
    max_unique_users INTEGER,
    max_uses_per_user INTEGER,
    applies_to_design_id INTEGER REFERENCES designs(id),
    target_design_ids INTEGER[],
    is_free_shipping BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_discount_codes_code ON discount_codes(code);

-- Orders
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, shipped, delivered, cancelled
    total_amount NUMERIC(10, 2) NOT NULL,
    discount_code_id INTEGER REFERENCES discount_codes(id),
    discount_amount NUMERIC(10, 2) DEFAULT 0,
    final_amount NUMERIC(10, 2),
    shipping_address TEXT,
    shipping_address_id INTEGER REFERENCES user_addresses(id) ON DELETE SET NULL,
    contact_phone VARCHAR(20),
    rut VARCHAR(12),
    billing_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_status VARCHAR(50) DEFAULT 'pending',
    payment_method VARCHAR(50),
    payment_token VARCHAR(255),
    payment_url TEXT,
    transaction_id VARCHAR(255),
    session_id VARCHAR(255)
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_transaction_id ON orders(transaction_id);
CREATE INDEX idx_orders_session_id ON orders(session_id);

-- Order Items (individual patterns purchased)
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    pattern_id INTEGER NOT NULL REFERENCES patterns(id) ON DELETE RESTRICT,
    quantity INTEGER DEFAULT 1,
    price NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_pattern ON order_items(pattern_id);

-- Ordered Patterns Table
CREATE TABLE ordered_patterns (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    pattern_id INTEGER NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
    svg_normal TEXT,
    svg_mirrored TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ordered_patterns_order ON ordered_patterns(order_id);
CREATE INDEX idx_ordered_patterns_pattern ON ordered_patterns(pattern_id);

-- Order Status History (for tracking)
CREATE TABLE order_status_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_status_history_order ON order_status_history(order_id);

-- Trigger function (must be defined before triggers)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_addresses_updated_at BEFORE UPDATE ON user_addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_measurements_updated_at BEFORE UPDATE ON user_measurements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_designs_updated_at BEFORE UPDATE ON designs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patterns_updated_at BEFORE UPDATE ON patterns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ordered_patterns_updated_at BEFORE UPDATE ON ordered_patterns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_discount_codes_updated_at BEFORE UPDATE ON discount_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO measurement_types (name, description, freesewing_key, unit) VALUES
    -- A
    ('Circunferencia de tobillo', 'Circunferencia alrededor del tobillo.', 'ankle', 'cm'),

    -- B
    ('Circunferencia de bíceps', 'Circunferencia del bíceps en su punto más ancho.', 'biceps', 'cm'),
    ('Busto frontal', 'Medida horizontal del busto en la parte frontal.', 'bustFront', 'cm'),
    ('Punto de busto a bajo busto', 'Distancia vertical desde el punto de busto hasta el bajo busto.', 'bustPointToUnderbust', 'cm'),
    ('Extensión de busto', 'Medida horizontal entre puntos de busto.', 'bustSpan', 'cm'),

    -- C
    ('Circunferencia de pecho', 'Circunferencia en la parte más estrecha del torso.', 'chest', 'cm'),
    ('Costura cruzada', 'Medida de costura cruzada en la espalda.', 'crossSeam', 'cm'),
    ('Costura cruzada frontal', 'Medida de costura cruzada en el frente.', 'crossSeamFront', 'cm'),
    ('Profundidad de entrepierna', 'Distancia vertical desde la cintura hasta la entrepierna sentado.', 'crotchDepth', 'cm'),

    -- H
    ('Circunferencia de talón', 'Circunferencia alrededor del talón del pie.', 'heel', 'cm'),
    ('Circunferencia de cabeza', 'Circunferencia alrededor de la cabeza.', 'head', 'cm'),
    ('Busto alto', 'Circunferencia en la parte alta del busto (sobre el pecho).', 'highBust', 'cm'),
    ('Busto alto frontal', 'Medida frontal del busto alto.', 'highBustFront', 'cm'),
    ('Circunferencia de caderas', 'Circunferencia en la parte más ancha de las caderas.', 'hips', 'cm'),
    ('HPS a busto', 'Distancia desde punto alto del hombro hasta punto de busto.', 'hpsToBust', 'cm'),
    ('HPS a cintura trasera', 'Distancia desde punto alto del hombro hasta cintura en la espalda.', 'hpsToWaistBack', 'cm'),
    ('HPS a cintura frontal', 'Distancia desde punto alto del hombro hasta cintura en el frente.', 'hpsToWaistFront', 'cm'),

    -- I
    ('Entrepierna', 'Longitud desde la entrepierna hasta el tobillo por la parte interna de la pierna.', 'inseam', 'cm'),

    -- K
    ('Circunferencia de rodilla', 'Circunferencia alrededor de la rodilla.', 'knee', 'cm'),

    -- N
    ('Circunferencia de cuello', 'Circunferencia alrededor del cuello en la base.', 'neck', 'cm'),

    -- S
    ('Circunferencia de asiento', 'Circunferencia alrededor de la parte más ancha de los glúteos.', 'seat', 'cm'),
    ('Profundidad de asiento', 'Medida posterior desde cintura hasta línea de asiento.', 'seatBack', 'cm'),
    ('Inclinación de hombro', 'Ángulo de inclinación descendente del hombro.', 'shoulderSlope', '°'),
    ('Hombro a codo', 'Distancia desde el punto del hombro hasta el codo.', 'shoulderToElbow', 'cm'),
    ('Hombro a hombro', 'Distancia horizontal entre los puntos de los hombros por la espalda.', 'shoulderToShoulder', 'cm'),
    ('Hombro a muñeca', 'Distancia desde el punto del hombro hasta la muñeca.', 'shoulderToWrist', 'cm'),

    -- U
    ('Bajo busto', 'Circunferencia justo debajo del busto.', 'underbust', 'cm'),
    ('Circunferencia de muslo superior', 'Circunferencia en la parte más ancha del muslo superior.', 'upperLeg', 'cm'),

    -- W
    ('Circunferencia de cintura', 'Circunferencia en la parte más estrecha de la cintura.', 'waist', 'cm'),
    ('Cintura trasera', 'Medida de cintura en la parte posterior (mitad de la circunferencia).', 'waistBack', 'cm'),
    ('Cintura a axila', 'Distancia vertical desde cintura hasta axila.', 'waistToArmpit', 'cm'),
    ('Cintura a piso', 'Longitud vertical desde cintura hasta el piso.', 'waistToFloor', 'cm'),
    ('Cintura a caderas', 'Distancia vertical desde cintura hasta línea de caderas.', 'waistToHips', 'cm'),
    ('Cintura a rodilla', 'Distancia vertical desde cintura hasta centro de la rodilla.', 'waistToKnee', 'cm'),
    ('Cintura a asiento', 'Distancia vertical desde cintura hasta línea de asiento.', 'waistToSeat', 'cm'),
    ('Cintura a bajo busto', 'Distancia vertical desde cintura hasta bajo busto.', 'waistToUnderbust', 'cm'),
    ('Cintura a muslo superior', 'Distancia vertical desde cintura hasta parte más ancha del muslo.', 'waistToUpperLeg', 'cm'),
    ('Circunferencia de muñeca', 'Circunferencia alrededor de la muñeca.', 'wrist', 'cm');

-- Sample design (Aaron pattern)
INSERT INTO designs (name, description, freesewing_pattern, base_price, default_settings) VALUES
    (
        'Aaron A-Shirt',
        'A classic athletic tank top / A-shirt pattern',
        'aaron',
        15000,
        '{"sa": 10, "complete": true, "paperless": false}'::jsonb
    );

-- Link Aaron design to its required measurements
INSERT INTO design_measurements (design_id, measurement_type_id, is_required)
SELECT 1, id, true
FROM measurement_types
WHERE freesewing_key IN ('biceps', 'chest', 'hips', 'hpsToBust', 'hpsToWaistBack', 'neck', 'shoulderSlope', 'shoulderToShoulder', 'waistToArmpit', 'waistToHips');

-- User Discount Code Wallet
CREATE TABLE user_has_discount_codes (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    discount_code_id INTEGER REFERENCES discount_codes(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, discount_code_id)
);

-- User Discount Code Redemptions
CREATE TABLE user_discount_code_redemptions (
    id SERIAL PRIMARY KEY,
    discount_code_id INTEGER REFERENCES discount_codes(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_redemptions_user ON user_discount_code_redemptions(user_id);
CREATE INDEX idx_redemptions_code ON user_discount_code_redemptions(discount_code_id);

-- Migration: add unit column to existing databases (safe to re-run)
ALTER TABLE measurement_types ADD COLUMN IF NOT EXISTS unit VARCHAR(8) NOT NULL DEFAULT 'cm';
UPDATE measurement_types SET unit = '°' WHERE freesewing_key = 'shoulderSlope';

-- Data repair: fix shoulderSlope rows saved via the erroneous cm-to-mm conversion.
-- No legitimate shoulder slope exceeds 90°, so values >90 were multiplied by 10 incorrectly.
UPDATE user_measurements
   SET value = value / 10
 WHERE measurement_type_id = (SELECT id FROM measurement_types WHERE freesewing_key = 'shoulderSlope')
   AND value > 90;