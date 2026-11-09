-- T4: clientes, mensajes de conversación y restricciones de estado para el CRM.
CREATE TABLE customer (
  id UUID PRIMARY KEY,
  restaurante_id UUID NOT NULL REFERENCES restaurant(id),
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurante_id, id),
  UNIQUE (restaurante_id, phone)
);

ALTER TABLE conversation ADD COLUMN customer_id UUID;
ALTER TABLE conversation ADD CONSTRAINT conversation_customer_fk FOREIGN KEY (restaurante_id, customer_id) REFERENCES customer(restaurante_id, id);
ALTER TABLE conversation ADD CONSTRAINT conversation_control_chk CHECK (control_mode IN ('AGENT','HUMAN'));
ALTER TABLE customer_order ADD COLUMN customer_id UUID;
ALTER TABLE customer_order ADD CONSTRAINT customer_order_customer_fk FOREIGN KEY (restaurante_id, customer_id) REFERENCES customer(restaurante_id, id);
CREATE INDEX customer_order_customer_idx ON customer_order(restaurante_id, customer_id, created_at DESC);
ALTER TABLE human_handoff ADD CONSTRAINT human_handoff_status_chk CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED'));

CREATE TABLE conversation_message (
  id UUID PRIMARY KEY,
  restaurante_id UUID NOT NULL REFERENCES restaurant(id),
  conversation_id UUID NOT NULL,
  author_type VARCHAR(10) NOT NULL CHECK (author_type IN ('CUSTOMER','AGENT','STAFF')),
  author_user_id UUID REFERENCES app_user(id),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  external_message_id VARCHAR(120),
  correlation_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (restaurante_id, conversation_id) REFERENCES conversation(restaurante_id, id),
  UNIQUE (restaurante_id, external_message_id),
  CHECK (author_type <> 'STAFF' OR author_user_id IS NOT NULL)
);
CREATE INDEX conversation_message_thread_idx ON conversation_message(restaurante_id, conversation_id, created_at);

-- Clientes a partir de los pedidos existentes (nombre más reciente por teléfono).
INSERT INTO customer(id, restaurante_id, name, phone, created_at)
SELECT md5('customer-' || o.restaurante_id || o.customer_phone)::uuid, o.restaurante_id,
       (array_agg(o.customer_name ORDER BY o.created_at DESC))[1], o.customer_phone, min(o.created_at)
FROM customer_order o WHERE COALESCE(o.customer_phone, '') <> '' GROUP BY o.restaurante_id, o.customer_phone;
UPDATE customer_order o SET customer_id = c.id FROM customer c WHERE c.restaurante_id = o.restaurante_id AND c.phone = o.customer_phone;
UPDATE conversation v SET customer_id = c.id FROM customer c
  WHERE v.id = '11111111-1111-1111-1111-111111112501' AND c.restaurante_id = v.restaurante_id AND c.phone = '0990000000';

-- Conversaciones y mensajes ficticios. Ninguno se envió por WhatsApp.
DO $$
DECLARE
  mar CONSTANT UUID := '11111111-1111-1111-1111-111111111111';
  sierra CONSTANT UUID := '22222222-2222-2222-2222-222222222222';
  caja_mar CONSTANT UUID := '11111111-1111-1111-1111-111111111102';
  -- n, restaurante, teléfono, control, estado de derivación ('' = sin derivación), motivo, mensajes "autor|texto" separados por ¦
  seeds CONSTANT TEXT[][] := ARRAY[
    ['1','mar','+593 000 000 001','AGENT','OPEN','Mención de alergia','CUSTOMER|Hola, quiero un encebollado¦AGENT|Claro, ¿grande o pequeño?¦CUSTOMER|Grande, pero soy alérgica al maní, ¿tiene maní?'],
    ['2','mar','+593 000 000 002','AGENT','OPEN','Opción no configurada','CUSTOMER|¿Pueden poner el encebollado con arroz y chifles extra?¦AGENT|Te comunico con una persona del restaurante para confirmar.¦CUSTOMER|Ok, espero'],
    ['3','mar','+593 000 000 003','HUMAN','IN_PROGRESS','Pedido ambiguo','CUSTOMER|Quiero lo mismo de la otra vez¦AGENT|Te paso con el personal para revisar tu pedido anterior.¦STAFF|Hola, ¿fue el encebollado con camarón extra?¦CUSTOMER|Sí, ese mismo y una limonada'],
    ['4','mar','+593 000 000 004','AGENT','','','CUSTOMER|¿A qué hora abren mañana?¦AGENT|Abrimos a las 08:30. ¿Deseas hacer un pedido?'],
    ['5','mar','+593 000 000 005','AGENT','RESOLVED','Consulta de pago','CUSTOMER|Ya hice la transferencia¦AGENT|Gracias, el personal verificará tu pago.¦STAFF|Pago recibido, gracias.'],
    ['6','mar','+593 000 000 006','AGENT','','','CUSTOMER|¿Tienen sopa del día?'],
    ['7','sierra','+593 000 000 001','AGENT','OPEN','Mención de alergia','CUSTOMER|¿La sopa serrana lleva lácteos? Tengo alergia.']];
  i INT; m INT; rest UUID; conv UUID; cust UUID; parts TEXT[]; author TEXT; started TIMESTAMPTZ;
BEGIN
  FOR i IN 1..array_length(seeds, 1) LOOP
    rest := CASE WHEN seeds[i][2] = 'mar' THEN mar ELSE sierra END;
    conv := md5('t4-conv-' || seeds[i][1])::uuid;
    cust := md5('customer-' || rest || seeds[i][3])::uuid;
    INSERT INTO customer(id, restaurante_id, name, phone) VALUES (cust, rest, 'Cliente ficticio ' || seeds[i][1], seeds[i][3]) ON CONFLICT (restaurante_id, phone) DO NOTHING;
    SELECT id INTO cust FROM customer WHERE restaurante_id = rest AND phone = seeds[i][3];
    started := now() - make_interval(mins => 15 * i + 5);
    INSERT INTO conversation(id, restaurante_id, customer_name, control_mode, correlation_id, created_at, customer_id)
    SELECT conv, rest, c.name, seeds[i][4], md5('t4-corr-' || seeds[i][1])::uuid, started, cust FROM customer c WHERE c.id = cust;
    parts := string_to_array(seeds[i][7], '¦');
    FOR m IN 1..array_length(parts, 1) LOOP
      author := split_part(parts[m], '|', 1);
      INSERT INTO conversation_message(id, restaurante_id, conversation_id, author_type, author_user_id, body, external_message_id, correlation_id, created_at)
      VALUES (md5('t4-msg-' || seeds[i][1] || '-' || m)::uuid, rest, conv, author, CASE WHEN author = 'STAFF' THEN caja_mar END, split_part(parts[m], '|', 2),
              CASE WHEN author = 'CUSTOMER' THEN 'wamid.FICTICIO.' || seeds[i][1] || '.' || m END, md5('t4-mcorr-' || seeds[i][1] || '-' || m)::uuid, started + make_interval(mins => 2 * m));
    END LOOP;
    IF seeds[i][5] <> '' THEN
      INSERT INTO human_handoff(id, restaurante_id, conversation_id, reason, context_summary, status, assigned_user_id, created_at)
      VALUES (md5('t4-handoff-' || seeds[i][1])::uuid, rest, conv, seeds[i][6], 'Contexto ficticio generado para pruebas del CRM.', seeds[i][5],
              CASE WHEN seeds[i][5] IN ('IN_PROGRESS','RESOLVED') THEN caja_mar END, started + interval '3 minutes');
    END IF;
  END LOOP;
  -- Mensajes de la conversación original (derivación por alergia).
  INSERT INTO conversation_message(id, restaurante_id, conversation_id, author_type, body, external_message_id, correlation_id, created_at) VALUES
    (md5('t4-msg-0-1')::uuid, mar, '11111111-1111-1111-1111-111111112501', 'CUSTOMER', 'Quisiera dos encebollados, uno sin cebolla.', 'wamid.FICTICIO.0.1', md5('t4-mcorr-0-1')::uuid, now() - interval '3 hours'),
    (md5('t4-msg-0-2')::uuid, mar, '11111111-1111-1111-1111-111111112501', 'CUSTOMER', '¿El caldo tiene mariscos? Tengo alergia.', 'wamid.FICTICIO.0.2', md5('t4-mcorr-0-2')::uuid, now() - interval '170 minutes');
END $$;
