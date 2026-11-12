-- T1: zona horaria del restaurante, tipo de cambio y rol en el historial, y pedidos ficticios para filtros.
ALTER TABLE restaurant ADD COLUMN timezone VARCHAR(64) NOT NULL DEFAULT 'America/Guayaquil';

ALTER TABLE customer_order ADD CONSTRAINT customer_order_status_chk
  CHECK (status IN ('PENDING_DECISION','ACCEPTED','REJECTED','PREPARING','READY','COMPLETED','CANCELLED','EXPIRED'));
ALTER TABLE customer_order ADD CONSTRAINT customer_order_restaurant_id_uk UNIQUE (restaurante_id, id);
CREATE INDEX customer_order_restaurant_created_idx ON customer_order(restaurante_id, created_at DESC);

ALTER TABLE order_status_history
  ADD COLUMN actor_role VARCHAR(16),
  ADD COLUMN change_type VARCHAR(12),
  ADD COLUMN reason_code VARCHAR(30);
UPDATE order_status_history h SET actor_role = u.role, change_type = 'AVANCE'
  FROM app_user u WHERE u.id = h.actor_user_id;
ALTER TABLE order_status_history
  ALTER COLUMN actor_role SET NOT NULL,
  ALTER COLUMN change_type SET NOT NULL,
  ADD CONSTRAINT order_status_history_role_chk CHECK (actor_role IN ('ADMIN','CAJA','COCINA')),
  ADD CONSTRAINT order_status_history_type_chk CHECK (change_type IN ('AVANCE','RETROCESO','DESHACER')),
  ADD CONSTRAINT order_status_history_reason_chk CHECK (reason_code IS NULL OR reason_code IN ('ERROR_AL_AVANZAR','CLIENTE_CAMBIO_PEDIDO','FALTA_PRODUCTO','OTRO')),
  ADD CONSTRAINT order_status_history_retroceso_chk CHECK (change_type <> 'RETROCESO' OR reason_code IS NOT NULL);

-- Pedidos ficticios: nombres inventados y teléfonos con prefijo 000, que no corresponden a personas reales.
DO $$
DECLARE
  mar CONSTANT UUID := '11111111-1111-1111-1111-111111111111';
  sierra CONSTANT UUID := '22222222-2222-2222-2222-222222222222';
  admin_mar CONSTANT UUID := '11111111-1111-1111-1111-111111111101';
  caja_mar CONSTANT UUID := '11111111-1111-1111-1111-111111111102';
  cocina_mar CONSTANT UUID := '11111111-1111-1111-1111-111111111103';
  admin_sierra CONSTANT UUID := '22222222-2222-2222-2222-222222222201';
  zone_mar CONSTANT UUID := '11111111-1111-1111-1111-111111111901';
  statuses CONSTANT TEXT[] := ARRAY['PENDING_DECISION','ACCEPTED','PREPARING','READY','COMPLETED','COMPLETED','REJECTED','COMPLETED','CANCELLED','COMPLETED','EXPIRED','COMPLETED'];
  names CONSTANT TEXT[] := ARRAY['Ana Ficticia','Bruno Demo','Carla Prueba','Diego Ensayo','Elena Sintética','Fabián Muestra','Gina Ejemplo','Hugo Ficticio'];
  path CONSTANT TEXT[] := ARRAY['ACCEPTED','PREPARING','READY','COMPLETED'];
  n INT; k INT; units INT; rest UUID; adm UUID; target TEXT; created TIMESTAMPTZ; order_id UUID; unit_id UUID;
  is_delivery BOOLEAN; fee NUMERIC(12,2); v_subtotal NUMERIC(12,2); line NUMERIC(12,2); encebollado BOOLEAN;
  pay_status TEXT; previous TEXT; step_at TIMESTAMPTZ; actor UUID; v_role TEXT; i INT;
BEGIN
  FOR n IN 1..28 LOOP
    rest := CASE WHEN n > 24 THEN sierra ELSE mar END;
    adm := CASE WHEN n > 24 THEN admin_sierra ELSE admin_mar END;
    target := statuses[1 + (n - 1) % array_length(statuses, 1)];
    created := CASE WHEN n <= 6 THEN now() - make_interval(mins => 20 * n) ELSE now() - make_interval(days => (n * 5) % 58 + 1, hours => n % 9) END;
    order_id := md5('t1-order-' || n)::uuid;
    is_delivery := rest = mar AND n % 3 = 0;
    fee := CASE WHEN is_delivery THEN 1.50 ELSE 0 END;
    units := 1 + n % 3;
    v_subtotal := 0;
    pay_status := CASE WHEN target = 'COMPLETED' THEN 'CONFIRMED'
                       WHEN target IN ('ACCEPTED','PREPARING','READY') THEN CASE WHEN n % 2 = 0 THEN 'PENDING_VERIFICATION' ELSE 'PENDING' END
                       WHEN target = 'PENDING_DECISION' THEN 'PENDING' ELSE 'NOT_REQUIRED' END;
    INSERT INTO customer_order(id,restaurante_id,customer_name,customer_phone,status,payment_status,fulfillment_mode,pickup_time,delivery_address,delivery_reference,delivery_zone_id,delivery_fee,subtotal,total,confirmed_by_customer_at,created_at,correlation_id)
    VALUES (order_id, rest, names[1 + (n - 1) % 8], '+593 000 000 ' || lpad(((n - 1) % 8 + 1)::text, 3, '0'), target, pay_status,
            CASE WHEN is_delivery THEN 'DELIVERY' ELSE 'PICKUP' END,
            CASE WHEN is_delivery THEN NULL ELSE created + interval '30 minutes' END,
            CASE WHEN is_delivery THEN 'Calle Ficticia ' || n ELSE NULL END,
            CASE WHEN is_delivery THEN 'Casa de prueba' ELSE NULL END,
            CASE WHEN is_delivery THEN zone_mar ELSE NULL END,
            fee, 0, 0, created, created, md5('t1-corr-' || n)::uuid);
    FOR k IN 1..units LOOP
      unit_id := md5('t1-unit-' || n || '-' || k)::uuid;
      encebollado := rest = sierra OR (n + k) % 2 = 0;
      line := CASE WHEN rest = sierra THEN 4.00 WHEN encebollado THEN 5.50 ELSE 1.50 END;
      IF rest = mar AND encebollado AND (n + k) % 4 = 0 THEN line := line + 1.75; END IF;
      INSERT INTO order_unit(id,restaurante_id,order_id,unit_number,variant_id,dish_name_snapshot,variant_name_snapshot,base_price_snapshot,subtotal)
      VALUES (unit_id, rest, order_id, k,
              CASE WHEN rest = sierra THEN '22222222-2222-2222-2222-222222222501'::uuid WHEN encebollado THEN '11111111-1111-1111-1111-111111111401'::uuid ELSE '11111111-1111-1111-1111-111111111402'::uuid END,
              CASE WHEN rest = sierra THEN 'Sopa serrana' WHEN encebollado THEN 'Encebollado clásico' ELSE 'Limonada' END,
              CASE WHEN rest = sierra THEN 'Porción' WHEN encebollado THEN 'Clásico grande' ELSE 'Vaso' END,
              CASE WHEN rest = sierra THEN 4.00 WHEN encebollado THEN 5.50 ELSE 1.50 END, line);
      IF rest = mar AND encebollado AND (n + k) % 4 = 0 THEN
        INSERT INTO order_unit_option(id,restaurante_id,order_unit_id,option_type,name_snapshot,surcharge_snapshot) VALUES (md5('t1-extra-' || n || '-' || k)::uuid, rest, unit_id, 'EXTRA', 'Camarón extra', 1.75);
      END IF;
      IF rest = mar AND encebollado AND n % 5 = 0 THEN
        INSERT INTO order_unit_option(id,restaurante_id,order_unit_id,option_type,name_snapshot,surcharge_snapshot) VALUES (md5('t1-removed-' || n || '-' || k)::uuid, rest, unit_id, 'REMOVED_INGREDIENT', 'Cebolla', 0);
      END IF;
      v_subtotal := v_subtotal + line;
    END LOOP;
    UPDATE customer_order SET subtotal = v_subtotal, total = v_subtotal + fee WHERE id = order_id;

    -- Historial coherente con el estado final. EXPIRED lo produce el sistema: queda sin historial manual.
    previous := 'PENDING_DECISION';
    step_at := created;
    IF target = 'REJECTED' THEN
      INSERT INTO order_status_history(id,restaurante_id,order_id,previous_status,new_status,reason,actor_user_id,actor_role,change_type,correlation_id,created_at)
      VALUES (md5('t1-hist-' || n || '-r')::uuid, rest, order_id, previous, 'REJECTED', 'Sin capacidad (ficticio)', adm, 'ADMIN', 'AVANCE', md5('t1-hcorr-' || n || '-r')::uuid, step_at + interval '4 minutes');
      UPDATE customer_order SET restaurant_decision_by = adm WHERE id = order_id;
    ELSIF target NOT IN ('PENDING_DECISION','EXPIRED') THEN
      FOR i IN 1..4 LOOP
        EXIT WHEN target = 'CANCELLED' AND i > 1;
        step_at := step_at + make_interval(mins => CASE i WHEN 1 THEN 3 + n % 5 WHEN 3 THEN 15 + n % 10 ELSE 5 END);
        actor := CASE WHEN rest = sierra THEN admin_sierra WHEN i IN (2,3) THEN cocina_mar ELSE caja_mar END;
        v_role := CASE WHEN rest = sierra THEN 'ADMIN' WHEN i IN (2,3) THEN 'COCINA' ELSE 'CAJA' END;
        INSERT INTO order_status_history(id,restaurante_id,order_id,previous_status,new_status,reason,actor_user_id,actor_role,change_type,correlation_id,created_at)
        VALUES (md5('t1-hist-' || n || '-' || i)::uuid, rest, order_id, previous, path[i], '', actor, v_role, 'AVANCE', md5('t1-hcorr-' || n || '-' || i)::uuid, step_at);
        previous := path[i];
        EXIT WHEN path[i] = target;
      END LOOP;
      IF target = 'CANCELLED' THEN
        INSERT INTO order_status_history(id,restaurante_id,order_id,previous_status,new_status,reason,actor_user_id,actor_role,change_type,correlation_id,created_at)
        VALUES (md5('t1-hist-' || n || '-c')::uuid, rest, order_id, 'ACCEPTED', 'CANCELLED', 'El cliente desistió (ficticio)', caja_mar, 'CAJA', 'AVANCE', md5('t1-hcorr-' || n || '-c')::uuid, step_at + interval '6 minutes');
      END IF;
      UPDATE customer_order SET restaurant_decision_by = CASE WHEN rest = sierra THEN admin_sierra ELSE caja_mar END WHERE id = order_id;
    END IF;

    IF pay_status <> 'NOT_REQUIRED' THEN
      INSERT INTO payment(id,restaurante_id,order_id,method,amount,status,reference_text,verified_by,verified_at)
      VALUES (md5('t1-pay-' || n)::uuid, rest, order_id, CASE WHEN n % 2 = 0 THEN 'TRANSFER' ELSE 'CASH' END, v_subtotal + fee, pay_status,
              CASE WHEN n % 2 = 0 THEN 'REF-FICTICIA-' || lpad(n::text, 3, '0') ELSE NULL END,
              CASE WHEN pay_status = 'CONFIRMED' THEN CASE WHEN rest = sierra THEN admin_sierra ELSE caja_mar END END,
              CASE WHEN pay_status = 'CONFIRMED' THEN step_at + interval '2 minutes' END);
    END IF;
  END LOOP;

  -- Un retroceso de ejemplo: el pedido 3 (PREPARING) había llegado a READY por error y caja lo devolvió.
  INSERT INTO order_status_history(id,restaurante_id,order_id,previous_status,new_status,reason,reason_code,actor_user_id,actor_role,change_type,correlation_id,created_at)
  VALUES (md5('t1-hist-3-ready')::uuid, mar, md5('t1-order-3')::uuid, 'PREPARING', 'READY', '', NULL, cocina_mar, 'COCINA', 'AVANCE', md5('t1-hcorr-3-ready')::uuid, now() - interval '30 minutes'),
         (md5('t1-hist-3-back')::uuid, mar, md5('t1-order-3')::uuid, 'READY', 'PREPARING', '', 'ERROR_AL_AVANZAR', caja_mar, 'CAJA', 'RETROCESO', md5('t1-hcorr-3-back')::uuid, now() - interval '28 minutes');
END $$;
