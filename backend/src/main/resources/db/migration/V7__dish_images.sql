CREATE TABLE dish_image (
  restaurante_id UUID NOT NULL,
  dish_id UUID NOT NULL,
  content_type VARCHAR(80) NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp')),
  image_data BYTEA NOT NULL CHECK(octet_length(image_data) > 0 AND octet_length(image_data) <= 2097152),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(restaurante_id,dish_id),
  FOREIGN KEY(restaurante_id,dish_id) REFERENCES dish(restaurante_id,id)
);
