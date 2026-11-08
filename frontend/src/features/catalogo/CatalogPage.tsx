import { FormEvent, useRef, useState } from 'react';
import { api, User, useLoad } from '../../shared/api';

type CatalogEntry = { id: string; name: string; active: boolean; description?: string; displayOrder?: number };
type CatalogKind = 'categories' | 'presentations' | 'ingredients';
type CatalogSource = ReturnType<typeof useLoad<CatalogEntry[]>>;

const sections: Record<CatalogKind, { title: string; singular: string; description: string }> = {
  categories: { title: 'Categorías', singular: 'categoría', description: 'Organizan los platos del menú.' },
  presentations: { title: 'Presentaciones', singular: 'presentación', description: 'Definen la variante vendible del plato.' },
  ingredients: { title: 'Ingredientes', singular: 'ingrediente', description: 'Se usan como retirables o extras con recargo.' },
};

function ActionIcon({ kind }: { kind: 'edit' | 'delete' }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{kind === 'edit' ? <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4Z" /></> : <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 4v7m4-7v7" /></>}</svg>;
}

function CatalogSection({ kind, source, writable, auth }: { kind: CatalogKind; source: CatalogSource; writable: boolean; auth: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<CatalogEntry | null>(null);
  const [name, setName] = useState('');
  const [notice, setNotice] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [saving, setSaving] = useState(false);
  const section = sections[kind];
  const filtered = (source.data || []).filter(entry => entry.name.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es')));
  const endpoint = kind === 'categories' ? '/admin/categories' : `/admin/catalog/${kind}`;

  function open(entry: CatalogEntry | null) { setEditing(entry); setName(entry?.name || ''); setDialogError(''); dialog.current?.showModal(); }
  function close() { dialog.current?.close(); setDialogError(''); }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) { setDialogError('Escribe un nombre.'); return; }
    setSaving(true); setDialogError(''); setNotice('');
    try {
      const body = kind === 'categories'
        ? { name: name.trim(), description: editing?.description || '', displayOrder: editing?.displayOrder ?? (source.data?.length || 0) + 1, active: editing?.active ?? true }
        : { name: name.trim(), active: editing?.active ?? true };
      await api(editing ? `${endpoint}/${editing.id}` : endpoint, auth, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) });
      await source.reload(); close();
    } catch (caught) { setDialogError(caught instanceof Error ? caught.message : 'No se pudo guardar.'); }
    finally { setSaving(false); }
  }
  async function remove(entry: CatalogEntry) {
    if (!window.confirm(`¿Eliminar “${entry.name}”?`)) return;
    setSaving(true); setNotice('');
    try { await api(`${endpoint}/${entry.id}`, auth, { method: 'DELETE' }); await source.reload(); }
    catch (caught) { setNotice(caught instanceof Error ? caught.message : 'No se pudo eliminar.'); }
    finally { setSaving(false); }
  }

  return <section className="catalog-section" aria-labelledby="catalog-section-title">
    <header className="catalog-section-heading"><div><h2 id="catalog-section-title">{section.title}</h2><p>{section.description}</p></div>{writable && <button type="button" onClick={() => open(null)}>+ Agregar</button>}</header>
    <div className="catalog-panel"><div className="catalog-toolbar"><label className="sr-only" htmlFor="catalog-search">Buscar en {section.title}</label><input id="catalog-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={`Buscar ${section.singular}…`} /><span className="catalog-count">{filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}</span></div>
      {notice && <p className="error catalog-notice" role="alert">{notice}</p>}
      {source.error && <p className="error catalog-notice" role="alert">No se pudo cargar: {source.error}</p>}
      {!source.data && !source.error && <p className="catalog-state">Cargando opciones…</p>}
      {source.data && <div className={`catalog-table${writable ? '' : ' readonly'}`} role="table" aria-label={section.title}><div className="catalog-table-head" role="row"><span role="columnheader">Nombre</span>{writable && <span role="columnheader">Acciones</span>}</div>{filtered.length ? filtered.map(entry => <div className="catalog-table-row" role="row" key={entry.id}><span className="catalog-entry-name" role="cell">{entry.name}</span>{writable && <div className="catalog-actions" role="cell"><button type="button" className="catalog-icon-button" title={`Editar ${entry.name}`} aria-label={`Editar ${entry.name}`} onClick={() => open(entry)} disabled={saving}><ActionIcon kind="edit" /></button><button type="button" className="catalog-icon-button catalog-delete" title={`Eliminar ${entry.name}`} aria-label={`Eliminar ${entry.name}`} onClick={() => void remove(entry)} disabled={saving}><ActionIcon kind="delete" /></button></div>}</div>) : <p className="catalog-empty">{query ? 'No hay resultados para esta búsqueda.' : 'Aún no hay elementos configurados.'}</p>}</div>}
    </div>
    <dialog className="menu-dialog catalog-dialog" ref={dialog} aria-labelledby="catalog-dialog-title"><div className="dialog-header"><h2 id="catalog-dialog-title">{editing ? `Editar ${section.singular}` : `Nueva ${section.singular}`}</h2><button type="button" className="dialog-close" onClick={close}>Cancelar</button></div><form className="menu-form catalog-dialog-form" onSubmit={event => void save(event)}><label>Nombre<input value={name} onChange={event => setName(event.target.value)} placeholder={`Nombre de la ${section.singular}`} maxLength={120} autoFocus /></label>{dialogError && <p className="error" role="alert">{dialogError}</p>}<button disabled={saving}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Agregar'}</button></form></dialog>
  </section>;
}

export function CatalogPage({ auth, user }: { auth: string; user: User }) {
  const categories = useLoad<CatalogEntry[]>('/menu/categories', auth);
  const presentations = useLoad<CatalogEntry[]>('/menu/catalog/presentations', auth);
  const ingredients = useLoad<CatalogEntry[]>('/menu/catalog/ingredients', auth);
  const [kind, setKind] = useState<CatalogKind>('categories');
  const writable = user.roles.includes('ROLE_ADMIN');
  const source = { categories, presentations, ingredients }[kind];
  return <section className="page-content catalog-page"><header className="page-heading"><div><h1>Catálogos</h1><p>Define las opciones reutilizables del restaurante antes de crear un plato.</p></div></header><div className="catalog-selector-row"><label className="sr-only" htmlFor="catalog-kind">Seleccionar catálogo</label><select id="catalog-kind" className="catalog-kind-select" value={kind} onChange={event => setKind(event.target.value as CatalogKind)}><option value="categories">Categorías</option><option value="presentations">Presentaciones</option><option value="ingredients">Ingredientes</option></select><span className="catalog-current">Sección: {sections[kind].title}</span></div>{!writable && <p className="notice">Solo ADMIN puede cambiar el catálogo.</p>}<CatalogSection key={kind} kind={kind} source={source} writable={writable} auth={auth} /></section>;
}
