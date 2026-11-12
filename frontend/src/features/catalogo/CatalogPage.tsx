import { FormEvent, useEffect, useRef, useState } from 'react';
import { Icon } from '../../design/Icon';
import { EmptyState, PageHeader, Skeleton } from '../../design/States';
import { api, User, useLoad } from '../../shared/api';
import '../../design/forms.css';
import './catalog.css';

type CatalogEntry = { id: string; name: string; active: boolean; description?: string; displayOrder?: number };
type CatalogKind = 'categories' | 'presentations' | 'ingredients';
type CatalogSource = ReturnType<typeof useLoad<CatalogEntry[]>>;
type Notice = { tone: 'ok' | 'error'; text: string };

const sections: Record<CatalogKind, { title: string; singular: string; article: 'la' | 'el'; description: string; deleteNote: string }> = {
  categories: { title: 'Categorías', singular: 'categoría', article: 'la', description: 'Organizan los platos del menú.', deleteNote: 'Solo se puede eliminar si no tiene platos.' },
  presentations: { title: 'Presentaciones', singular: 'presentación', article: 'la', description: 'Definen la variante vendible de cada plato (por ejemplo, grande o vaso).', deleteNote: 'Los platos y pedidos existentes conservan su copia.' },
  ingredients: { title: 'Ingredientes', singular: 'ingrediente', article: 'el', description: 'Se usan como ingredientes retirables o extras con recargo.', deleteNote: 'Los platos y pedidos existentes conservan su copia.' },
};
const KINDS: CatalogKind[] = ['categories', 'presentations', 'ingredients'];

function useDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open) { if (!ref.current?.open) ref.current?.showModal(); } else ref.current?.close(); }, [open]);
  return ref;
}

function CatalogSection({ kind, source, writable, auth, say }: { kind: CatalogKind; source: CatalogSource; writable: boolean; auth: string; say: (notice: Notice) => void }) {
  const section = sections[kind];
  const [query, setQuery] = useState(''); const [editing, setEditing] = useState<CatalogEntry | null>(); const [name, setName] = useState('');
  const [deleting, setDeleting] = useState<CatalogEntry>(); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const formRef = useDialog(editing !== undefined); const deleteRef = useDialog(Boolean(deleting));
  const endpoint = kind === 'categories' ? '/admin/categories' : `/admin/catalog/${kind}`;
  const filtered = (source.data ?? []).filter(entry => entry.name.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es')));

  function open(entry: CatalogEntry | null) { setEditing(entry); setName(entry?.name ?? ''); setError(''); }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) { setError('Escribe un nombre.'); return; }
    setSaving(true); setError('');
    try {
      const body = kind === 'categories'
        ? { name: name.trim(), description: editing?.description || '', displayOrder: editing?.displayOrder ?? (source.data?.length || 0) + 1, active: editing?.active ?? true }
        : { name: name.trim(), active: editing?.active ?? true };
      await api(editing ? `${endpoint}/${editing.id}` : endpoint, auth, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) });
      await source.reload(); setEditing(undefined); say({ tone: 'ok', text: editing ? `«${name.trim()}» se actualizó.` : `«${name.trim()}» se agregó.` });
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo guardar.'); }
    finally { setSaving(false); }
  }
  async function remove() {
    if (!deleting) return; const entry = deleting; setSaving(true);
    try { await api(`${endpoint}/${entry.id}`, auth, { method: 'DELETE' }); await source.reload(); setDeleting(undefined); say({ tone: 'ok', text: `«${entry.name}» se eliminó.` }); }
    catch (caught) { setDeleting(undefined); say({ tone: 'error', text: caught instanceof Error ? caught.message : 'No se pudo eliminar.' }); }
    finally { setSaving(false); }
  }

  return <section className="ds-card ct-panel" role="tabpanel" id={`ct-panel-${kind}`} aria-labelledby={`ct-tab-${kind}`}>
    <div className="ct-panel__head">
      <div><h2>{section.title}</h2><p>{section.description}</p></div>
      {writable && <button type="button" className="ds-btn ds-btn--primary" onClick={() => open(null)}><Icon name="plus" size={18} />Agregar {section.singular}</button>}
    </div>
    <label className="ds-search"><span className="ds-sr-only">Buscar en {section.title}</span><Icon name="search" />
      <input className="ds-input" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={`Buscar ${section.singular}`} maxLength={80} /></label>
    {source.error ? <EmptyState illustration="error" title="No pudimos cargar el catálogo" description={source.error} action={<button type="button" className="ds-btn ds-btn--primary" onClick={() => void source.reload()}><Icon name="refresh" />Reintentar</button>} />
      : !source.data ? <div className="ct-loading">{[0, 1, 2].map(index => <Skeleton key={index} height={48} radius="var(--radius-md)" />)}</div>
        : filtered.length === 0 ? <EmptyState compact title={query ? 'Sin resultados' : `Sin ${section.title.toLowerCase()}`} description={query ? 'Prueba con otro nombre.' : writable ? `Agrega ${section.article} primer${section.article === 'la' ? 'a' : ''} ${section.singular}.` : 'Aún no hay registros.'} />
          : <div className="ds-table-wrap"><table className="ds-table ct-table">
            <thead><tr><th scope="col">Nombre</th><th scope="col">Estado</th>{writable && <th scope="col"><span className="ds-sr-only">Acciones</span></th>}</tr></thead>
            <tbody>{filtered.map(entry => <tr key={entry.id}>
              <td><b>{entry.name}</b>{entry.description && <span className="ct-desc">{entry.description}</span>}</td>
              <td>{entry.active ? <span className="ds-badge" data-status="READY"><Icon name="checkCircle" size={14} />Activo</span> : <span className="ds-badge" data-status="EXPIRED"><Icon name="minusCircle" size={14} />Inactivo</span>}</td>
              {writable && <td className="ct-actions">
                <button type="button" className="ds-icon-btn" onClick={() => open(entry)} aria-label={`Editar ${entry.name}`} title="Editar"><Icon name="edit" size={18} /></button>
                <button type="button" className="ds-icon-btn ds-icon-btn--danger" onClick={() => setDeleting(entry)} aria-label={`Eliminar ${entry.name}`} title="Eliminar"><Icon name="trash" size={18} /></button>
              </td>}
            </tr>)}</tbody>
          </table></div>}
    {source.data && <p className="ct-count">{filtered.length} de {source.data.length} {source.data.length === 1 ? 'registro' : 'registros'}</p>}

    <dialog ref={formRef} className="ds-modal ds-form-dialog ct-dialog" aria-labelledby={`ct-form-${kind}`} onCancel={event => { event.preventDefault(); if (!saving) setEditing(undefined); }}>
      {editing !== undefined && <><div className="dialog-header"><h2 id={`ct-form-${kind}`}>{editing ? `Editar ${section.singular}` : `Nueva ${section.singular}`}</h2><button type="button" className="ds-btn ds-btn--ghost" disabled={saving} onClick={() => setEditing(undefined)}>Cancelar</button></div>
        <form className="menu-form" onSubmit={event => void save(event)}>
          <label>Nombre<input value={name} onChange={event => setName(event.target.value)} placeholder={`Nombre de ${section.article} ${section.singular}`} maxLength={120} autoFocus aria-invalid={Boolean(error)} /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="ds-btn ds-btn--primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </form></>}
    </dialog>
    <dialog ref={deleteRef} className="ds-modal" aria-labelledby={`ct-del-${kind}`} onCancel={event => { event.preventDefault(); if (!saving) setDeleting(undefined); }}>
      {deleting && <><div className="ds-modal__body"><h2 id={`ct-del-${kind}`} style={{ fontSize: 'var(--text-xl)' }}>¿Eliminar «{deleting.name}»?</h2><p className="ds-muted" style={{ margin: 0 }}>{section.deleteNote} No se puede deshacer.</p></div>
        <div className="ds-modal__actions"><button type="button" className="ds-btn ds-btn--secondary" disabled={saving} onClick={() => setDeleting(undefined)}>Volver</button><button type="button" className="ds-btn ds-btn--danger" disabled={saving} onClick={() => void remove()}>{saving ? 'Eliminando…' : 'Eliminar'}</button></div></>}
    </dialog>
  </section>;
}

export function CatalogPage({ auth, user }: { auth: string; user: User }) {
  const categories = useLoad<CatalogEntry[]>('/menu/categories', auth);
  const presentations = useLoad<CatalogEntry[]>('/menu/catalog/presentations', auth);
  const ingredients = useLoad<CatalogEntry[]>('/menu/catalog/ingredients', auth);
  const [kind, setKind] = useState<CatalogKind>('categories'); const [notice, setNotice] = useState<Notice>();
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(undefined), 6000); return () => clearTimeout(timer); }, [notice]);
  const writable = user.roles.includes('ROLE_ADMIN');
  const sources = { categories, presentations, ingredients };
  return <section className="ct">
    <PageHeader title="Catálogo" subtitle="Opciones reutilizables del restaurante: defínelas antes de crear o editar un plato." />
    <div className="ds-tabs ct-tabs" role="tablist" aria-label="Catálogos">
      {KINDS.map(item => <button key={item} type="button" role="tab" id={`ct-tab-${item}`} aria-controls={`ct-panel-${item}`} className="ds-tab" aria-selected={kind === item} onClick={() => setKind(item)}>
        {sections[item].title}{sources[item].data && <span className="ds-chip__count">{sources[item].data!.length}</span>}
      </button>)}
    </div>
    {notice && <p className="orders-notice ct-notice" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}><Icon name={notice.tone === 'ok' ? 'checkCircle' : 'alert'} size={18} />{notice.text}</p>}
    <CatalogSection key={kind} kind={kind} source={sources[kind]} writable={writable} auth={auth} say={setNotice} />
  </section>;
}
