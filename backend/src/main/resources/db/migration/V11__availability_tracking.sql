-- T2: distingue variantes con cantidad controlada de las que solo se marcan como agotadas.
-- Las variantes existentes conservan el control de cantidad; un plato nuevo empieza sin control
-- hasta el primer ajuste de disponibilidad.
ALTER TABLE availability ADD COLUMN tracked BOOLEAN NOT NULL DEFAULT TRUE;
