-- Segunda ronda, bloque D: en el catálogo existe un solo elemento («Camarón»); la palabra «extra» la calcula el panel según
-- cómo se usó la opción en el pedido. Se renombran los elementos «X extra» a «X» cuando no choca con otro nombre del mismo
-- restaurante (y plato, en extras); los snapshots de pedidos (order_unit_option.name_snapshot) no se tocan para no alterar
-- el historial. Si hubiera «X» y «X extra» a la vez, se deja tal cual y queda como TBD documentado.
UPDATE catalog_ingredient c SET name = regexp_replace(c.name, '\s+extra$', '', 'i')
WHERE c.name ~* '\s+extra$'
  AND NOT EXISTS (SELECT 1 FROM catalog_ingredient x WHERE x.restaurante_id = c.restaurante_id AND lower(x.name) = lower(regexp_replace(c.name, '\s+extra$', '', 'i')));
UPDATE extra_option e SET name = regexp_replace(e.name, '\s+extra$', '', 'i')
WHERE e.name ~* '\s+extra$'
  AND NOT EXISTS (SELECT 1 FROM extra_option x WHERE x.restaurante_id = e.restaurante_id AND x.dish_id = e.dish_id AND lower(x.name) = lower(regexp_replace(e.name, '\s+extra$', '', 'i')));
