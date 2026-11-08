CREATE TABLE dashboard_task (id UUID PRIMARY KEY, restaurante_id UUID NOT NULL REFERENCES restaurant(id), title VARCHAR(180) NOT NULL, scheduled_for TIMESTAMPTZ NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'SCHEDULED' CHECK(status IN ('SCHEDULED','COMPLETED','CANCELLED')), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX dashboard_task_restaurant_schedule_idx ON dashboard_task(restaurante_id,status,scheduled_for);
INSERT INTO dashboard_task(id,restaurante_id,title,scheduled_for,status) VALUES
 ('11111111-1111-1111-1111-111111112801','11111111-1111-1111-1111-111111111111','Revisar los pedidos pendientes antes de abrir',date_trunc('day',now()) + interval '9 hours','SCHEDULED'),
 ('22222222-2222-2222-2222-222222222801','22222222-2222-2222-2222-222222222222','Revisar la recepción de pedidos del día',date_trunc('day',now()) + interval '10 hours','SCHEDULED');
