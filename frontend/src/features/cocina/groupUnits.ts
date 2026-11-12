import { OrderUnit } from '../pedidos/orderTypes';

/** Un extra con su cantidad (el mismo extra elegido dos veces son dos filas del backend; aquí se cuentan). */
export type GroupedOption = { name: string; quantity: number };
export type GroupedUnit = { key: string; dish: string; variant: string; quantity: number; extras: GroupedOption[]; removed: string[]; notes: string[] };

const normalize = (value: string) => value.trim().toLowerCase();

/** Cuenta repeticiones por nombre conservando el primer texto; el orden de salida es alfabético por nombre normalizado. */
export function countByName(names: string[]): GroupedOption[] {
  const counts = new Map<string, GroupedOption>();
  for (const name of names) {
    const key = normalize(name);
    const current = counts.get(key);
    if (current) current.quantity += 1; else counts.set(key, { name: name.trim(), quantity: 1 });
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value);
}

/** Clave de identidad de una unidad: plato, variante, extras con cantidad, retirados e instrucciones, sin importar el orden. */
export function unitKey(unit: OrderUnit): string {
  const extras = countByName(unit.options.filter(option => option.type === 'EXTRA').map(option => option.name)).map(item => `${normalize(item.name)}×${item.quantity}`);
  const removed = [...new Set(unit.options.filter(option => option.type === 'REMOVED_INGREDIENT').map(option => normalize(option.name)))].sort();
  const notes = [...new Set(unit.options.filter(option => option.type === 'INSTRUCTION').map(option => normalize(option.name)))].sort();
  return [normalize(unit.dish), normalize(unit.variant), extras.join(','), removed.join(','), notes.join(',')].join('|');
}

/**
 * Agrupa unidades idénticas de un pedido para la vista de preparación (segunda ronda, bloque C): dos unidades son
 * la misma línea solo si coinciden plato, variante, extras (con su cantidad) e ingredientes retirados, sin importar el
 * orden. Cualquier diferencia produce otra línea. El orden de salida respeta la primera aparición de cada línea.
 */
export function groupUnits(units: OrderUnit[]): GroupedUnit[] {
  const groups = new Map<string, GroupedUnit>();
  for (const unit of units) {
    const key = unitKey(unit);
    const current = groups.get(key);
    if (current) { current.quantity += unit.quantity || 1; continue; }
    groups.set(key, {
      key, dish: unit.dish, variant: unit.variant, quantity: unit.quantity || 1,
      extras: countByName(unit.options.filter(option => option.type === 'EXTRA').map(option => option.name)),
      removed: [...new Map(unit.options.filter(option => option.type === 'REMOVED_INGREDIENT').map(option => [normalize(option.name), option.name.trim()])).values()],
      notes: [...new Map(unit.options.filter(option => option.type === 'INSTRUCTION').map(option => [normalize(option.name), option.name.trim()])).values()],
    });
  }
  return [...groups.values()];
}
