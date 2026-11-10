import { useEffect, useMemo, useRef, useState } from 'react';
import { FilterGroup } from '../../design/FilterGroup';
import { Icon } from '../../design/Icon';
import { EmptyState, PageHeader, Skeleton } from '../../design/States';
import { api, User, useLoad } from '../../shared/api';
import { CatalogItem, Category, Dish, DishDialog, DishEditDialog, DishImage } from './DishForms';
import '../../design/forms.css';
import './menu.css';

type MenuFilters = { q: string; categoryId: string; availability: '' | 'AVAILABLE' | 'SOLD_OUT'; visibility: '' | 'ACTIVE' | 'INACTIVE' };
const emptyMenuFilters: MenuFilters = { q: '', categoryId: '', availability: '', visibility: '' };
const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const money = (value: number) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value);

/** Filtra en el cliente: el backend entrega el menú completo del restaurante y decide `available`. `skip` omite un grupo para contar sus opciones. */
function filterDishes(dishes: Dish[], filters: MenuFilters, skip?: keyof MenuFilters) {
  const terms = normalize(filters.q.trim()).split(/\s+/).filter(Boolean);
  return dishes.filter(dish => {
    if (skip !== 'categoryId' && filters.categoryId && dish.categoryId !== filters.categoryId) return false;
    if (skip !== 'availability' && filters.availability === 'AVAILABLE' && !dish.available) return false;
    if (skip !== 'availability' && filters.availability === 'SOLD_OUT' && dish.available) return false;
    if (skip !== 'visibility' && filters.visibility === 'ACTIVE' && !dish.active) return false;
    if (skip !== 'visibility' && filters.visibility === 'INACTIVE' && dish.active) return false;
    if (!terms.length) return true;
    const text = normalize([dish.name, dish.description, dish.ingredients, ...dish.extras.map(item => item.name), ...dish.removableIngredients.map(item => item.name)].join(' '));
    return terms.every(term => text.includes(term));
  });
}

function ConfirmDelete({ dish, busy, onCancel, onConfirm }: { dish?: Dish; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (dish) { if (!ref.current?.open) ref.current?.showModal(); } else ref.current?.close(); }, [dish]);
  return <dialog ref={ref} className="ds-modal" aria-labelledby="mn-delete-title" onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    {dish && <><div className="ds-modal__body"><h2 id="mn-delete-title" style={{ fontSize: 'var(--text-xl)' }}>¿Eliminar «{dish.name}»?</h2>
      <p className="ds-muted" style={{ margin: 0 }}>Se eliminan el plato, su imagen y sus opciones. No se puede deshacer, y el backend lo impide si ya tiene movimientos de disponibilidad. Los pedidos anteriores conservan su copia.</p></div>
      <div className="ds-modal__actions"><button type="button" className="ds-btn ds-btn--secondary" disabled={busy} onClick={onCancel}>Volver</button><button type="button" className="ds-btn ds-btn--danger" disabled={busy} onClick={onConfirm}>{busy ? 'Eliminando…' : 'Eliminar plato'}</button></div></>}
  </dialog>;
}

export function MenuPage({ auth, user }: { auth: string; user: User }) {
  const menu = useLoad<Dish[]>('/menu/dishes', auth); const categories = useLoad<Category[]>('/menu/categories', auth);
  const presentations = useLoad<CatalogItem[]>('/menu/catalog/presentations', auth); const ingredients = useLoad<CatalogItem[]>('/menu/catalog/ingredients', auth);
  const admin = user.roles.includes('ROLE_ADMIN'); const canToggle = admin || user.roles.includes('ROLE_CAJA');
  const [filters, setFilters] = useState<MenuFilters>(emptyMenuFilters); const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string }>(); const [deleting, setDeleting] = useState<Dish>();
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(undefined), 6000); return () => clearTimeout(timer); }, [notice]);

  const dishes = useMemo(() => menu.data ?? [], [menu.data]);
  const visible = useMemo(() => filterDishes(dishes, filters), [dishes, filters]);
  const countBy = (skip: keyof MenuFilters, test: (dish: Dish) => boolean) => filterDishes(dishes, filters, skip).filter(test).length;
  const filtering = Object.values(filters).some(Boolean);
  const set = <K extends keyof MenuFilters>(key: K, value: MenuFilters[K]) => setFilters(current => ({ ...current, [key]: value }));
  const reloadAll = () => menu.reload();

  /** Interruptor de disponibilidad: marca o quita «agotado» en todas las variantes (ADMIN y CAJA); el backend recalcula `available`. */
  async function toggleSoldOut(dish: Dish) {
    const soldOut = dish.available;
    setBusy(dish.id);
    try {
      await api(`/availability/dishes/${dish.id}/sold-out`, auth, { method: 'PUT', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ soldOut }) });
      const fresh = await api<Dish[]>('/menu/dishes', auth); const now = fresh.find(item => item.id === dish.id);
      await menu.reload();
      setNotice(soldOut ? { tone: 'ok', text: `«${dish.name}» quedó agotado.` }
        : now?.available ? { tone: 'ok', text: `«${dish.name}» vuelve a estar disponible.` }
          : { tone: 'error', text: `«${dish.name}» ya no está marcado como agotado, pero sigue sin unidades libres. Ajusta la cantidad en Operación.` });
    } catch (caught) { setNotice({ tone: 'error', text: caught instanceof Error ? caught.message : 'No se pudo cambiar la disponibilidad.' }); }
    finally { setBusy(undefined); }
  }
  async function toggleVisible(dish: Dish) {
    setBusy(dish.id);
    try { await api(`/admin/dishes/${dish.id}/active`, auth, { method: 'PATCH', body: JSON.stringify({ active: !dish.active }) }); await menu.reload(); setNotice({ tone: 'ok', text: `«${dish.name}» ${dish.active ? 'ya no se muestra en el menú' : 'vuelve a mostrarse en el menú'}.` }); }
    catch (caught) { setNotice({ tone: 'error', text: caught instanceof Error ? caught.message : 'No se pudo cambiar la visibilidad.' }); }
    finally { setBusy(undefined); }
  }
  async function remove() {
    if (!deleting) return; const dish = deleting; setBusy(dish.id);
    try { await api<void>(`/admin/dishes/${dish.id}`, auth, { method: 'DELETE' }); setDeleting(undefined); await menu.reload(); setNotice({ tone: 'ok', text: `«${dish.name}» se eliminó.` }); }
    catch (caught) { setDeleting(undefined); setNotice({ tone: 'error', text: caught instanceof Error ? caught.message : 'No se pudo eliminar el plato.' }); }
    finally { setBusy(undefined); }
  }

  const forms = { auth, categories: categories.data || [], presentations: presentations.data || [], ingredients: ingredients.data || [] };
  return <section className="mn">
    <PageHeader title="Menú" subtitle="Platos con las opciones del Catálogo. El backend decide si cada plato está disponible."
      aside={admin && <DishDialog {...forms} onCreated={reloadAll} />} />

    <label className="ds-search mn-search"><span className="ds-sr-only">Buscar platos</span><Icon name="search" />
      <input className="ds-input" type="search" value={filters.q} onChange={event => set('q', event.target.value)} placeholder="Nombre, descripción o ingrediente" maxLength={80} /></label>

    <div className="ds-card mn-filters">
      <FilterGroup legend="Categoría" value={filters.categoryId} onChange={value => set('categoryId', value)}
        options={[{ value: '', label: 'Todas', count: countBy('categoryId', () => true) }, ...(categories.data ?? []).map(category => ({ value: category.id, label: category.name, count: countBy('categoryId', dish => dish.categoryId === category.id) }))]} />
      <div className="mn-filters__row">
        <FilterGroup legend="Disponibilidad" value={filters.availability} onChange={value => set('availability', value as MenuFilters['availability'])}
          options={[{ value: '', label: 'Todas', count: countBy('availability', () => true) }, { value: 'AVAILABLE', label: 'Disponible', count: countBy('availability', dish => dish.available) }, { value: 'SOLD_OUT', label: 'Agotado', count: countBy('availability', dish => !dish.available) }]} />
        <FilterGroup legend="Visibilidad" value={filters.visibility} onChange={value => set('visibility', value as MenuFilters['visibility'])}
          options={[{ value: '', label: 'Todos', count: countBy('visibility', () => true) }, { value: 'ACTIVE', label: 'Visibles', count: countBy('visibility', dish => dish.active) }, { value: 'INACTIVE', label: 'Ocultos', count: countBy('visibility', dish => !dish.active) }]} />
      </div>
    </div>

    <div className="mn-summary">
      <p aria-live="polite">{menu.data ? <><b className="ds-num">{visible.length}</b> {filtering ? `de ${dishes.length} platos` : visible.length === 1 ? 'plato' : 'platos'}</> : 'Cargando menú…'}</p>
      {filtering && <button type="button" className="ds-btn ds-btn--ghost" onClick={() => setFilters(emptyMenuFilters)}><Icon name="close" size={16} />Limpiar filtros</button>}
    </div>
    {notice && <p className="orders-notice" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}><Icon name={notice.tone === 'ok' ? 'checkCircle' : 'alert'} size={18} />{notice.text}</p>}

    {menu.error ? <div className="ds-card"><EmptyState illustration="error" title="No pudimos cargar el menú" description={menu.error} action={<button type="button" className="ds-btn ds-btn--primary" onClick={reloadAll}><Icon name="refresh" />Reintentar</button>} /></div>
      : !menu.data ? <div className="ds-card mn-loading">{[0, 1, 2, 3].map(index => <Skeleton key={index} height={56} radius="var(--radius-md)" />)}</div>
        : dishes.length === 0 ? <div className="ds-card"><EmptyState title="Aún no hay platos" description="Configura el Catálogo y crea el primer plato para empezar." action={admin ? <DishDialog {...forms} onCreated={reloadAll} /> : undefined} /></div>
          : visible.length === 0 ? <div className="ds-card"><EmptyState title="Ningún plato coincide" description="Prueba con otra búsqueda o limpia los filtros." action={<button type="button" className="ds-btn ds-btn--primary" onClick={() => setFilters(emptyMenuFilters)}>Limpiar filtros</button>} /></div>
            : <div className="ds-table-wrap mn-table-wrap"><table className="ds-table mn-table">
              <thead><tr><th scope="col">Plato</th><th scope="col">Categoría</th><th scope="col" className="is-num">Precio</th><th scope="col">Opciones</th><th scope="col">Disponible</th><th scope="col">Visible</th>{admin && <th scope="col"><span className="ds-sr-only">Acciones</span></th>}</tr></thead>
              <tbody>{visible.map(dish => {
                const prices = dish.variants.map(variant => variant.price); const min = prices.length ? Math.min(...prices) : null;
                return <tr key={dish.id} aria-busy={busy === dish.id} data-inactive={!dish.active}>
                  <td data-label="Plato"><div className="mn-dish"><span className="mn-thumb"><DishImage dish={dish} auth={auth} /></span><span className="mn-dish__text"><b>{dish.name}</b><span>{dish.description}</span></span></div></td>
                  <td data-label="Categoría">{dish.category}</td>
                  <td data-label="Precio" className="is-num">{min === null ? '—' : <>{prices.length > 1 && <span className="mn-from">desde </span>}{money(min)}</>}{prices.length > 1 && <span className="mn-sub">{prices.length} presentaciones</span>}</td>
                  <td data-label="Opciones"><span className="mn-opts">{dish.extras.length ? `${dish.extras.length} ${dish.extras.length === 1 ? 'extra' : 'extras'}` : 'Sin extras'}{dish.removableIngredients.length > 0 && ` · ${dish.removableIngredients.length} retirable${dish.removableIngredients.length === 1 ? '' : 's'}`}</span></td>
                  <td data-label="Disponible">
                    {canToggle ? <label className="ds-switch mn-switch"><input type="checkbox" role="switch" checked={dish.available} disabled={busy === dish.id} onChange={() => void toggleSoldOut(dish)} aria-label={`${dish.name}: ${dish.available ? 'disponible; marcar como agotado' : 'agotado; marcar como disponible'}`} />
                      <span className="mn-state" data-available={dish.available}>{dish.available ? 'Disponible' : 'Agotado'}</span></label>
                      : <span className="mn-state" data-available={dish.available}><Icon name={dish.available ? 'checkCircle' : 'utensilsOff'} size={16} />{dish.available ? 'Disponible' : 'Agotado'}</span>}
                  </td>
                  <td data-label="Visible"><span className="mn-visible" data-active={dish.active}><Icon name={dish.active ? 'eye' : 'eyeOff'} size={16} />{dish.active ? 'Visible' : 'Oculto'}</span></td>
                  {admin && <td className="mn-actions" data-label="Acciones">
                    <DishEditDialog dish={dish} {...forms} onUpdated={reloadAll} />
                    <button type="button" className="mn-icon-btn" disabled={busy === dish.id} onClick={() => void toggleVisible(dish)} aria-label={`${dish.active ? 'Ocultar' : 'Mostrar'} ${dish.name} en el menú`} title={dish.active ? 'Ocultar del menú' : 'Mostrar en el menú'}><Icon name={dish.active ? 'eyeOff' : 'eye'} size={18} /></button>
                    <button type="button" className="mn-icon-btn mn-icon-btn--danger" disabled={busy === dish.id} onClick={() => setDeleting(dish)} aria-label={`Eliminar ${dish.name}`} title="Eliminar plato"><Icon name="trash" size={18} /></button>
                  </td>}
                </tr>;
              })}</tbody>
            </table></div>}
    <ConfirmDelete dish={deleting} busy={Boolean(busy)} onCancel={() => setDeleting(undefined)} onConfirm={() => void remove()} />
  </section>;
}
