CREATE TABLE restaurant (
  id UUID PRIMARY KEY, name VARCHAR(120) NOT NULL, currency CHAR(3) NOT NULL DEFAULT 'USD', address VARCHAR(300), contact VARCHAR(120), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE app_user (
  id UUID PRIMARY KEY, restaurante_id UUID NOT NULL REFERENCES restaurant(id), name VARCHAR(120) NOT NULL, email VARCHAR(180) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL, role VARCHAR(16) NOT NULL CHECK (role IN ('ADMIN','CAJA','COCINA')), active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurante_id, id)
);
CREATE TABLE operation_settings (
  restaurante_id UUID PRIMARY KEY REFERENCES restaurant(id), reception_paused BOOLEAN NOT NULL DEFAULT FALSE, pause_reason VARCHAR(300), updated_by UUID REFERENCES app_user(id), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE category (
  id UUID PRIMARY KEY, restaurante_id UUID NOT NULL REFERENCES restaurant(id), name VARCHAR(100) NOT NULL, description VARCHAR(300), display_order INTEGER NOT NULL DEFAULT 0, active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (restaurante_id,id), UNIQUE(restaurante_id,name)
);
CREATE TABLE dish (
  id UUID PRIMARY KEY, restaurante_id UUID NOT NULL REFERENCES restaurant(id), category_id UUID NOT NULL, name VARCHAR(140) NOT NULL, description VARCHAR(700), informational_ingredients TEXT, active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(restaurante_id,id), UNIQUE(restaurante_id,name), FOREIGN KEY(restaurante_id,category_id) REFERENCES category(restaurante_id,id)
);
CREATE TABLE sellable_variant (
  id UUID PRIMARY KEY, restaurante_id UUID NOT NULL REFERENCES restaurant(id), dish_id UUID NOT NULL, name VARCHAR(140) NOT NULL, price NUMERIC(12,2) NOT NULL CHECK(price > 0), active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(restaurante_id,id), UNIQUE(restaurante_id,dish_id,name), FOREIGN KEY(restaurante_id,dish_id) REFERENCES dish(restaurante_id,id)
);
CREATE TABLE extra_option (
  id UUID PRIMARY KEY, restaurante_id UUID NOT NULL REFERENCES restaurant(id), dish_id UUID NOT NULL, name VARCHAR(140) NOT NULL, surcharge NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(surcharge >= 0), active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(restaurante_id,id), UNIQUE(restaurante_id,dish_id,name), FOREIGN KEY(restaurante_id,dish_id) REFERENCES dish(restaurante_id,id)
);
CREATE TABLE removable_ingredient (
  id UUID PRIMARY KEY, restaurante_id UUID NOT NULL REFERENCES restaurant(id), dish_id UUID NOT NULL, name VARCHAR(140) NOT NULL, removable BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(restaurante_id,id), UNIQUE(restaurante_id,dish_id,name), FOREIGN KEY(restaurante_id,dish_id) REFERENCES dish(restaurante_id,id)
);
CREATE TABLE preparation_instruction (
  id UUID PRIMARY KEY, restaurante_id UUID NOT NULL REFERENCES restaurant(id), dish_id UUID NOT NULL, instruction VARCHAR(200) NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(restaurante_id,id), UNIQUE(restaurante_id,dish_id,instruction), FOREIGN KEY(restaurante_id,dish_id) REFERENCES dish(restaurante_id,id)
);
CREATE TABLE availability (
  restaurante_id UUID NOT NULL, variant_id UUID NOT NULL, on_hand INTEGER NOT NULL CHECK(on_hand >= 0), reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved >= 0), sold_out BOOLEAN NOT NULL DEFAULT FALSE, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(restaurante_id,variant_id), FOREIGN KEY(restaurante_id,variant_id) REFERENCES sellable_variant(restaurante_id,id), CHECK(on_hand >= reserved)
);
CREATE TABLE availability_movement (
  id UUID PRIMARY KEY, restaurante_id UUID NOT NULL REFERENCES restaurant(id), variant_id UUID NOT NULL, delta INTEGER NOT NULL CHECK(delta <> 0), reason VARCHAR(250) NOT NULL, source VARCHAR(40) NOT NULL, actor_user_id UUID REFERENCES app_user(id), correlation_id UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(restaurante_id,variant_id) REFERENCES sellable_variant(restaurante_id,id)
);
CREATE TABLE opening_hours (
  id UUID PRIMARY KEY, restaurante_id UUID NOT NULL REFERENCES restaurant(id), day_of_week SMALLINT NOT NULL CHECK(day_of_week BETWEEN 0 AND 6), opens_at TIME, closes_at TIME, closed BOOLEAN NOT NULL DEFAULT FALSE, CHECK((closed = TRUE) OR (opens_at IS NOT NULL AND closes_at IS NOT NULL))
);
CREATE TABLE delivery_zone (
  id UUID PRIMARY KEY, restaurante_id UUID NOT NULL REFERENCES restaurant(id), name VARCHAR(120) NOT NULL, description VARCHAR(300), fee NUMERIC(12,2) NOT NULL CHECK(fee >= 0), active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(restaurante_id,id), UNIQUE(restaurante_id,name)
);
CREATE TABLE customer_order (
  id UUID PRIMARY KEY, restaurante_id UUID NOT NULL REFERENCES restaurant(id), customer_name VARCHAR(120) NOT NULL, customer_phone VARCHAR(40), status VARCHAR(40) NOT NULL, payment_status VARCHAR(40) NOT NULL, fulfillment_mode VARCHAR(20) NOT NULL CHECK(fulfillment_mode IN ('PICKUP','DELIVERY')), pickup_time TIMESTAMPTZ, delivery_address VARCHAR(400), delivery_reference VARCHAR(300), delivery_zone_id UUID, delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(delivery_fee >= 0), subtotal NUMERIC(12,2) NOT NULL CHECK(subtotal >= 0), total NUMERIC(12,2) NOT NULL CHECK(total >= 0), confirmed_by_customer_at TIMESTAMPTZ, restaurant_decision_by UUID REFERENCES app_user(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), correlation_id UUID NOT NULL,
  FOREIGN KEY(restaurante_id,delivery_zone_id) REFERENCES delivery_zone(restaurante_id,id)
);
CREATE INDEX customer_order_restaurant_status_idx ON customer_order(restaurante_id,status,created_at DESC);
CREATE TABLE order_unit (
  id UUID PRIMARY KEY, restaurante_id UUID NOT NULL REFERENCES restaurant(id), order_id UUID NOT NULL REFERENCES customer_order(id), unit_number INTEGER NOT NULL CHECK(unit_number > 0), variant_id UUID, dish_name_snapshot VARCHAR(140) NOT NULL, variant_name_snapshot VARCHAR(140) NOT NULL, base_price_snapshot NUMERIC(12,2) NOT NULL CHECK(base_price_snapshot >= 0), subtotal NUMERIC(12,2) NOT NULL CHECK(subtotal >= 0),
  UNIQUE(order_id,unit_number)
);
CREATE TABLE order_unit_option (
  id UUID PRIMARY KEY, restaurante_id UUID NOT NULL REFERENCES restaurant(id), order_unit_id UUID NOT NULL REFERENCES order_unit(id), option_type VARCHAR(30) NOT NULL CHECK(option_type IN ('EXTRA','REMOVED_INGREDIENT','INSTRUCTION')), name_snapshot VARCHAR(200) NOT NULL, surcharge_snapshot NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(surcharge_snapshot >= 0)
);
CREATE TABLE payment (
  id UUID PRIMARY KEY, restaurante_id UUID NOT NULL REFERENCES restaurant(id), order_id UUID NOT NULL REFERENCES customer_order(id), method VARCHAR(30) NOT NULL, amount NUMERIC(12,2) NOT NULL CHECK(amount >= 0), status VARCHAR(40) NOT NULL, reference_text VARCHAR(300), verified_by UUID REFERENCES app_user(id), verified_at TIMESTAMPTZ
);
CREATE TABLE conversation (
  id UUID PRIMARY KEY, restaurante_id UUID NOT NULL REFERENCES restaurant(id), customer_name VARCHAR(120), control_mode VARCHAR(16) NOT NULL DEFAULT 'AGENT', correlation_id UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(restaurante_id,id)
);
CREATE TABLE human_handoff (
  id UUID PRIMARY KEY, restaurante_id UUID NOT NULL REFERENCES restaurant(id), conversation_id UUID NOT NULL, reason VARCHAR(300) NOT NULL, context_summary TEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'OPEN', assigned_user_id UUID REFERENCES app_user(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY(restaurante_id,conversation_id) REFERENCES conversation(restaurante_id,id)
);
CREATE TABLE idempotency_operation (
  id UUID PRIMARY KEY, restaurante_id UUID NOT NULL REFERENCES restaurant(id), operation_type VARCHAR(80) NOT NULL, idempotency_key VARCHAR(120) NOT NULL, result_reference UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(restaurante_id,operation_type,idempotency_key)
);
CREATE TABLE audit_log (
  id UUID PRIMARY KEY, restaurante_id UUID NOT NULL REFERENCES restaurant(id), actor_user_id UUID REFERENCES app_user(id), action VARCHAR(100) NOT NULL, entity_type VARCHAR(80) NOT NULL, entity_id UUID, correlation_id UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
