-- T5: marca del restaurante (colores y logo) guardada en PostgreSQL y leída por R2DBC.
CREATE TABLE restaurant_branding (
  restaurante_id UUID PRIMARY KEY REFERENCES restaurant(id),
  primary_color CHAR(7) NOT NULL CHECK (primary_color ~ '^#[0-9A-F]{6}$'),
  secondary_color CHAR(7) NOT NULL CHECK (secondary_color ~ '^#[0-9A-F]{6}$'),
  logo_content_type VARCHAR(20) CHECK (logo_content_type IN ('image/png','image/jpeg','image/webp')),
  logo_data BYTEA CHECK (logo_data IS NULL OR octet_length(logo_data) BETWEEN 1 AND 2097152),
  updated_by UUID REFERENCES app_user(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((logo_content_type IS NULL) = (logo_data IS NULL))
);
-- Mar Azul conserva el tema por defecto del panel; Sierra Verde usa una marca ficticia distinta para probar el aislamiento.
INSERT INTO restaurant_branding(restaurante_id, primary_color, secondary_color) VALUES
  ('11111111-1111-1111-1111-111111111111', '#0A3165', '#0A5EAE'),
  ('22222222-2222-2222-2222-222222222222', '#1F5E3B', '#2E7D4F');
