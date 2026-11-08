CREATE TABLE order_status_history (
  id UUID PRIMARY KEY,
  restaurante_id UUID NOT NULL REFERENCES restaurant(id),
  order_id UUID NOT NULL REFERENCES customer_order(id),
  previous_status VARCHAR(40) NOT NULL,
  new_status VARCHAR(40) NOT NULL,
  reason VARCHAR(300) NOT NULL DEFAULT '',
  actor_user_id UUID NOT NULL REFERENCES app_user(id),
  correlation_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX order_status_history_order_idx ON order_status_history(restaurante_id, order_id, created_at DESC);
