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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_number ON orders(order_number);

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

CREATE TRIGGER update_user_measurements_updated_at BEFORE UPDATE ON user_measurements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_designs_updated_at BEFORE UPDATE ON designs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patterns_updated_at BEFORE UPDATE ON patterns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample data for FreeSewing measurement types
INSERT INTO measurement_types (name, description, freesewing_key) VALUES
    ('Biceps Circumference', 'Circumference of the biceps at the widest part', 'biceps'),
    ('Chest Circumference', 'Chest circumference at the fullest part', 'chest'),
    ('Hips Circumference', 'Hip circumference at the fullest part', 'hips'),
    ('High Point Shoulder to Bust', 'Distance from shoulder point to bust point', 'hpsToBust'),
    ('High Point Shoulder to Waist Back', 'Distance from shoulder point to waist at back', 'hpsToWaistBack'),
    ('Neck Circumference', 'Neck circumference', 'neck'),
    ('Shoulder Slope', 'Shoulder slope angle in degrees', 'shoulderSlope'),
    ('Shoulder to Shoulder', 'Distance between shoulder points', 'shoulderToShoulder'),
    ('Waist to Armpit', 'Distance from waist to armpit', 'waistToArmpit'),
    ('Waist to Hips', 'Distance from waist to hips', 'waistToHips'),
    ('Inseam', 'Inseam length for pants', 'inseam'),
    ('Waist Circumference', 'Natural waist circumference', 'waist'),
    ('Arm Length', 'Shoulder to wrist length', 'armLength');

-- Sample design (Aaron pattern)
INSERT INTO designs (name, description, freesewing_pattern, base_price, default_settings) VALUES
    (
        'Aaron A-Shirt',
        'A classic athletic tank top / A-shirt pattern',
        'aaron',
        15.00,
        '{"sa": 10, "complete": true, "paperless": false}'::jsonb
    );

-- Link Aaron design to its required measurements
INSERT INTO design_measurements (design_id, measurement_type_id, is_required)
SELECT 1, id, true
FROM measurement_types
WHERE freesewing_key IN ('biceps', 'chest', 'hips', 'hpsToBust', 'hpsToWaistBack', 'neck', 'shoulderSlope', 'shoulderToShoulder', 'waistToArmpit', 'waistToHips');