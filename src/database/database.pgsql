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

-- Orders
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, shipped, delivered, cancelled
    total_amount NUMERIC(10, 2) NOT NULL,
    shipping_address TEXT,
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

-- Order Status History (for tracking)
CREATE TABLE order_status_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_status_history_order ON order_status_history(order_id);

-- Trigger to update updated_at timestamp
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

INSERT INTO measurement_types (name, description, freesewing_key) VALUES
    -- A
    ('Circunferencia de tobillo', 'Circunferencia alrededor del tobillo.', 'ankle'),

    -- B
    ('Circunferencia de bíceps', 'Circunferencia del bíceps en su punto más ancho.', 'biceps'),
    ('Busto frontal', 'Medida horizontal del busto en la parte frontal.', 'bustFront'),
    ('Punto de busto a bajo busto', 'Distancia vertical desde el punto de busto hasta el bajo busto.', 'bustPointToUnderbust'),
    ('Extensión de busto', 'Medida horizontal entre puntos de busto.', 'bustSpan'),

    -- C
    ('Circunferencia de pecho', 'Circunferencia en la parte más estrecha del torso.', 'chest'),
    ('Costura cruzada', 'Medida de costura cruzada en la espalda.', 'crossSeam'),
    ('Costura cruzada frontal', 'Medida de costura cruzada en el frente.', 'crossSeamFront'),
    ('Profundidad de entrepierna', 'Distancia vertical desde la cintura hasta la entrepierna sentado.', 'crotchDepth'),

    -- H
    ('Circunferencia de talón', 'Circunferencia alrededor del talón del pie.', 'heel'),
    ('Circunferencia de cabeza', 'Circunferencia alrededor de la cabeza.', 'head'),
    ('Busto alto', 'Circunferencia en la parte alta del busto (sobre el pecho).', 'highBust'),
    ('Busto alto frontal', 'Medida frontal del busto alto.', 'highBustFront'),
    ('Circunferencia de caderas', 'Circunferencia en la parte más ancha de las caderas.', 'hips'),
    ('HPS a busto', 'Distancia desde punto alto del hombro hasta punto de busto.', 'hpsToBust'),
    ('HPS a cintura trasera', 'Distancia desde punto alto del hombro hasta cintura en la espalda.', 'hpsToWaistBack'),
    ('HPS a cintura frontal', 'Distancia desde punto alto del hombro hasta cintura en el frente.', 'hpsToWaistFront'),

    -- I
    ('Entrepierna', 'Longitud desde la entrepierna hasta el tobillo por la parte interna de la pierna.', 'inseam'),

    -- K
    ('Circunferencia de rodilla', 'Circunferencia alrededor de la rodilla.', 'knee'),

    -- N
    ('Circunferencia de cuello', 'Circunferencia alrededor del cuello en la base.', 'neck'),

    -- S
    ('Circunferencia de asiento', 'Circunferencia alrededor de la parte más ancha de los glúteos.', 'seat'),
    ('Profundidad de asiento', 'Medida posterior desde cintura hasta línea de asiento.', 'seatBack'),
    ('Inclinación de hombro', 'Ángulo de inclinación descendente del hombro.', 'shoulderSlope'),
    ('Hombro a codo', 'Distancia desde el punto del hombro hasta el codo.', 'shoulderToElbow'),
    ('Hombro a hombro', 'Distancia horizontal entre los puntos de los hombros por la espalda.', 'shoulderToShoulder'),
    ('Hombro a muñeca', 'Distancia desde el punto del hombro hasta la muñeca.', 'shoulderToWrist'),

    -- U
    ('Bajo busto', 'Circunferencia justo debajo del busto.', 'underbust'),
    ('Circunferencia de muslo superior', 'Circunferencia en la parte más ancha del muslo superior.', 'upperLeg'),

    -- W
    ('Circunferencia de cintura', 'Circunferencia en la parte más estrecha de la cintura.', 'waist'),
    ('Cintura trasera', 'Medida de cintura en la parte posterior (mitad de la circunferencia).', 'waistBack'),
    ('Cintura a axila', 'Distancia vertical desde cintura hasta axila.', 'waistToArmpit'),
    ('Cintura a piso', 'Longitud vertical desde cintura hasta el piso.', 'waistToFloor'),
    ('Cintura a caderas', 'Distancia vertical desde cintura hasta línea de caderas.', 'waistToHips'),
    ('Cintura a rodilla', 'Distancia vertical desde cintura hasta centro de la rodilla.', 'waistToKnee'),
    ('Cintura a asiento', 'Distancia vertical desde cintura hasta línea de asiento.', 'waistToSeat'),
    ('Cintura a bajo busto', 'Distancia vertical desde cintura hasta bajo busto.', 'waistToUnderbust'),
    ('Cintura a muslo superior', 'Distancia vertical desde cintura hasta parte más ancha del muslo.', 'waistToUpperLeg'),
    ('Circunferencia de muñeca', 'Circunferencia alrededor de la muñeca.', 'wrist');

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