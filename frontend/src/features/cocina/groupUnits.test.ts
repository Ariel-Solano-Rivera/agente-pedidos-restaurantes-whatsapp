import { describe, expect, it } from 'vitest';
import { OrderUnit } from '../pedidos/orderTypes';
import { countByName, groupUnits, unitKey } from './groupUnits';

const unit = (id: string, dish: string, options: Array<[OrderUnit['options'][number]['type'], string]> = [], variant = 'Normal'): OrderUnit => ({
  id, dish, variant, quantity: 1, unitPrice: null, extrasTotal: null, lineTotal: null, options: options.map(([type, name]) => ({ type, name, amount: null })),
});

describe('groupUnits', () => {
  it('agrupa unidades idénticas y muestra la cantidad', () => {
    const result = groupUnits([unit('a', 'Encebollado clásico'), unit('b', 'Limonada'), unit('c', 'Encebollado clásico')]);
    expect(result.map(line => [line.dish, line.quantity])).toEqual([['Encebollado clásico', 2], ['Limonada', 1]]);
  });

  it('separa el encebollado con extra y sin cebolla del clásico sin cambios', () => {
    const result = groupUnits([
      unit('a', 'Encebollado clásico', [['EXTRA', 'Camarón'], ['REMOVED_INGREDIENT', 'Cebolla']]),
      unit('b', 'Encebollado clásico'),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ quantity: 1, extras: [{ name: 'Camarón', quantity: 1 }], removed: ['Cebolla'] });
    expect(result[1]).toMatchObject({ quantity: 1, extras: [], removed: [] });
  });

  it('ignora el orden de las opciones y las mayúsculas', () => {
    const result = groupUnits([
      unit('a', 'Encebollado clásico', [['REMOVED_INGREDIENT', 'Cebolla'], ['EXTRA', 'Camarón']]),
      unit('b', 'encebollado clásico', [['EXTRA', 'camarón'], ['REMOVED_INGREDIENT', 'cebolla']]),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(2);
  });

  it('cuenta el mismo extra elegido dos veces y lo distingue de una sola vez', () => {
    const twice = unit('a', 'Encebollado clásico', [['EXTRA', 'Camarón'], ['EXTRA', 'Camarón']]);
    const once = unit('b', 'Encebollado clásico', [['EXTRA', 'Camarón']]);
    const result = groupUnits([twice, once, unit('c', 'Encebollado clásico', [['EXTRA', 'Camarón'], ['EXTRA', 'Camarón']])]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ quantity: 2, extras: [{ name: 'Camarón', quantity: 2 }] });
    expect(result[1]).toMatchObject({ quantity: 1, extras: [{ name: 'Camarón', quantity: 1 }] });
    expect(unitKey(twice)).not.toBe(unitKey(once));
  });

  it('distingue variantes e instrucciones', () => {
    const result = groupUnits([unit('a', 'Encebollado clásico', [], 'Grande'), unit('b', 'Encebollado clásico', [], 'Normal'), unit('c', 'Encebollado clásico', [['INSTRUCTION', 'Sin sal']], 'Normal')]);
    expect(result.map(line => line.quantity)).toEqual([1, 1, 1]);
  });

  it('countByName conserva el primer texto y ordena por nombre', () => {
    expect(countByName(['Queso', 'camarón', 'Camarón'])).toEqual([{ name: 'camarón', quantity: 2 }, { name: 'Queso', quantity: 1 }]);
  });
});
