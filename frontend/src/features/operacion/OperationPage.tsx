import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { Icon } from '../../design/Icon';
import { EmptyState, PageHeader, Skeleton } from '../../design/States';
import { api, User, useLoad } from '../../shared/api';
import '../../design/forms.css';
import './operation.css';

/** Contratos de operación (docs/contratos-api.md). El panel no calcula saldos, reservas ni tarifas: muestra lo que devuelve el backend. */
type Settings = { receptionPaused: boolean; pauseReason: string };
type Availability = { variantId: string; dish: string; variant: string; onHand: number; reserved: number; soldOut: boolean };
type Zone = { id: string; name: string; fee: string; active: boolean };
type Schedule = { id: string; dayOfWeek: number; opensAt: string; closesAt: string; closed: boolean };
type Tab = 'reception' | 'availability' | 'schedules' | 'zones';
type Notice = { tone: 'ok' | 'error'; text: string };

const TABS: Array<{ id: Tab; label: string; icon: 'pause' | 'utensilsOff' | 'calendar' | 'moto' }> = [
  { id: 'reception', label: 'Recepción', icon: 'pause' }, { id: 'availability', label: 'Disponibilidad', icon: 'utensilsOff' },
  { id: 'schedules', label: 'Horarios', icon: 'calendar' }, { id: 'zones', label: 'Zonas de entrega', icon: 'moto' },
];
/** `day_of_week`: 0 = domingo … 6 = sábado (confirmado; igual que EXTRACT(DOW) y Date.getDay()). Se listan de lunes a domingo. */
const DAYS = [1, 2, 3, 4, 5, 6, 0].map(day => ({ day, label: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][day] }));
const PAUSE_REASONS = ['Cocina saturada', 'Cierre anticipado', 'Falta de producto'];
const ADJUST_REASONS = ['Venta presencial', 'Reposición de porciones', 'Corrección de conteo', 'Otro'];
const money = (value: string) => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(Number(value));
const hhmm = (value: string) => value?.slice(0, 5) ?? '';
const errorText = (caught: unknown, fallback: string) => caught instanceof Error ? caught.message : fallback;

function Dialog({ open, title, onClose, children, busy }: { open: boolean; title: string; onClose: () => void; children: ReactNode; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open) { if (!ref.current?.open) ref.current?.showModal(); } else ref.current?.close(); }, [open]);
  return <dialog ref={ref} className="ds-modal ds-form-dialog op-dialog" aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    {open && <><div className="dialog-header"><h2>{title}</h2><button type="button" className="ds-btn ds-btn--ghost" disabled={busy} onClick={onClose}>Cancelar</button></div>{children}</>}
  </dialog>;
}

function Reception({ auth, admin, say }: { auth: string; admin: boolean; say: (notice: Notice) => void }) {
  const settings = useLoad<Settings>('/operation/settings', auth);
  const [open, setOpen] = useState(false); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  if (settings.error) return <EmptyState illustration="error" title="No pudimos cargar la recepción" description={settings.error} />;
  if (!settings.data) return <Skeleton height={140} radius="var(--radius-lg)" />;
  const paused = settings.data.receptionPaused;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!paused && !reason.trim()) { setError('Indica el motivo de la pausa.'); return; }
    setBusy(true); setError('');
    try {
      await api('/admin/operation/settings', auth, { method: 'PUT', body: JSON.stringify({ receptionPaused: !paused, pauseReason: paused ? '' : reason.trim() }) });
      await settings.reload(); setOpen(false); say({ tone: 'ok', text: paused ? 'La recepción de pedidos se reanudó.' : 'La recepción quedó pausada: no se crearán solicitudes nuevas.' });
    } catch (caught) { setError(errorText(caught, 'No se pudo cambiar la recepción.')); }
    finally { setBusy(false); }
  }
  return <>
    <div className="op-reception" data-paused={paused}>
      <span className="op-reception__icon"><Icon name={paused ? 'pause' : 'play'} size={32} /></span>
      <div className="op-reception__text">
        <h2>{paused ? 'Recepción pausada' : 'Recibiendo pedidos'}</h2>
        <p>{paused ? (settings.data.pauseReason || 'Sin motivo registrado.') : 'El agente puede crear solicitudes nuevas para el restaurante.'}</p>
        {paused && <p className="op-hint">Mientras esté pausada se informa indisponibilidad y no se crean solicitudes nuevas.</p>}
      </div>
      {admin ? <button type="button" className={`ds-btn ds-btn--lg ${paused ? 'ds-btn--primary' : 'ds-btn--secondary'}`} onClick={() => { setReason(''); setError(''); setOpen(true); }}>
        <Icon name={paused ? 'play' : 'pause'} />{paused ? 'Reanudar recepción' : 'Pausar recepción'}</button>
        : <p className="op-hint">Solo administración pausa o reanuda la recepción.</p>}
    </div>
    <Dialog open={open} title={paused ? 'Reanudar recepción' : 'Pausar recepción'} busy={busy} onClose={() => setOpen(false)}>
      <form className="menu-form" onSubmit={submit}>
        {paused ? <p className="op-hint">El restaurante volverá a recibir solicitudes nuevas.</p> : <>
          <fieldset className="ds-filter-group"><legend className="ds-eyebrow">Motivo rápido</legend>
            {PAUSE_REASONS.map(item => <button key={item} type="button" className="ds-chip" aria-pressed={reason === item} onClick={() => setReason(item)}><Icon name="check" size={16} className="ds-chip__check" />{item}</button>)}</fieldset>
          <label>Motivo<textarea maxLength={300} rows={2} value={reason} onChange={event => setReason(event.target.value)} placeholder="Explica por qué se pausa" aria-invalid={Boolean(error)} /></label>
        </>}
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className={`ds-btn ${paused ? 'ds-btn--primary' : 'ds-btn--danger'}`} disabled={busy}>{busy ? 'Guardando…' : paused ? 'Reanudar recepción' : 'Pausar recepción'}</button>
      </form>
    </Dialog>
  </>;
}

function AvailabilityTab({ auth, canAdjust, say }: { auth: string; canAdjust: boolean; say: (notice: Notice) => void }) {
  const rows = useLoad<Availability[]>('/availability', auth);
  const [editing, setEditing] = useState<Availability>(); const [delta, setDelta] = useState(0); const [reason, setReason] = useState(ADJUST_REASONS[0]); const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  function open(row: Availability) { setEditing(row); setDelta(-1); setReason(ADJUST_REASONS[0]); setDetail(''); setError(''); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!editing) return;
    if (!Number.isInteger(delta) || delta === 0) { setError('El ajuste debe ser un número entero distinto de cero.'); return; }
    if (reason === 'Otro' && !detail.trim()) { setError('Describe el motivo cuando eliges «Otro».'); return; }
    setBusy(true); setError('');
    try {
      const fullReason = reason === 'Otro' ? detail.trim() : detail.trim() ? `${reason}: ${detail.trim()}` : reason;
      await api('/availability/adjustments', auth, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ variantId: editing.variantId, delta, reason: fullReason }) });
      await rows.reload(); setEditing(undefined); say({ tone: 'ok', text: `Ajuste de ${delta > 0 ? '+' : ''}${delta} registrado en «${editing.dish} · ${editing.variant}».` });
    } catch (caught) { setError(errorText(caught, 'No se pudo registrar el ajuste.')); }
    finally { setBusy(false); }
  }
  if (rows.error) return <EmptyState illustration="error" title="No pudimos cargar la disponibilidad" description={rows.error} />;
  if (!rows.data) return <div className="op-loading">{[0, 1, 2].map(index => <Skeleton key={index} height={52} radius="var(--radius-md)" />)}</div>;
  if (!rows.data.length) return <EmptyState title="Sin disponibilidad registrada" description="Los platos sin control de cantidad no aparecen aquí." />;
  return <>
    <p className="op-hint">Porciones por variante. Ajusta por ventas presenciales o reposición; cada ajuste guarda motivo, autor y fecha. Para marcar un plato agotado usa el interruptor del Menú.</p>
    <div className="ds-table-wrap"><table className="ds-table op-table">
      <thead><tr><th scope="col">Plato y variante</th><th scope="col" className="is-num">En existencia</th><th scope="col" className="is-num">Reservadas</th><th scope="col">Estado</th>{canAdjust && <th scope="col"><span className="ds-sr-only">Acciones</span></th>}</tr></thead>
      <tbody>{rows.data.map(row => <tr key={row.variantId}>
        <td data-label="Plato"><b>{row.dish}</b> <span className="op-muted">· {row.variant}</span></td>
        <td data-label="En existencia" className="is-num"><b>{row.onHand}</b></td>
        <td data-label="Reservadas" className="is-num">{row.reserved}</td>
        <td data-label="Estado">{row.soldOut ? <span className="ds-badge" data-status="REJECTED"><Icon name="utensilsOff" size={14} />Agotado</span> : <span className="ds-badge" data-status="READY"><Icon name="checkCircle" size={14} />Disponible</span>}</td>
        {canAdjust && <td className="op-actions"><button type="button" className="ds-btn ds-btn--secondary" onClick={() => open(row)}>Ajustar</button></td>}
      </tr>)}</tbody>
    </table></div>
    <Dialog open={Boolean(editing)} title={editing ? `Ajustar ${editing.dish} · ${editing.variant}` : 'Ajustar'} busy={busy} onClose={() => setEditing(undefined)}>
      {editing && <form className="menu-form" onSubmit={submit}>
        <p className="op-hint">En existencia: <b>{editing.onHand}</b> · Reservadas: <b>{editing.reserved}</b>. El backend rechaza ajustes que dejen menos unidades que las reservadas.</p>
        <div className="op-stepper" role="group" aria-label="Cantidad del ajuste">
          {[-5, -1].map(step => <button key={step} type="button" className="ds-btn ds-btn--secondary" aria-label={`Restar ${Math.abs(step)}`} onClick={() => setDelta(value => value + step)}>−{Math.abs(step)}</button>)}
          <label className="op-stepper__value"><span className="ds-sr-only">Ajuste</span><input type="number" step={1} value={delta} onChange={event => setDelta(Math.trunc(Number(event.target.value)))} /></label>
          {[1, 5].map(step => <button key={step} type="button" className="ds-btn ds-btn--secondary" aria-label={`Sumar ${step}`} onClick={() => setDelta(value => value + step)}>+{step}</button>)}
        </div>
        <p className="op-hint">{delta === 0 ? 'Elige una cantidad distinta de cero.' : `Se ${delta < 0 ? (Math.abs(delta) === 1 ? 'descontará' : 'descontarán') : (delta === 1 ? 'sumará' : 'sumarán')} ${Math.abs(delta)} ${Math.abs(delta) === 1 ? 'porción' : 'porciones'}.`}</p>
        <fieldset className="ds-filter-group"><legend className="ds-eyebrow">Motivo</legend>
          {ADJUST_REASONS.map(item => <button key={item} type="button" className="ds-chip" aria-pressed={reason === item} onClick={() => setReason(item)}><Icon name="check" size={16} className="ds-chip__check" />{item}</button>)}</fieldset>
        <label>Detalle {reason === 'Otro' ? '(obligatorio)' : '(opcional)'}<input maxLength={200} value={detail} onChange={event => setDetail(event.target.value)} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="ds-btn ds-btn--primary" disabled={busy || delta === 0}>{busy ? 'Guardando…' : 'Registrar ajuste'}</button>
      </form>}
    </Dialog>
  </>;
}

function Schedules({ auth, admin, say }: { auth: string; admin: boolean; say: (notice: Notice) => void }) {
  const rows = useLoad<Schedule[]>('/operation/schedules', auth);
  const [day, setDay] = useState<number>(); const [opens, setOpens] = useState('09:00'); const [closes, setCloses] = useState('17:00'); const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); if (day === undefined) return;
    if (!closed && closes <= opens) { setError('La hora de cierre debe ser posterior a la de apertura.'); return; }
    setBusy(true); setError('');
    try { await api('/admin/schedules', auth, { method: 'POST', body: JSON.stringify({ dayOfWeek: day, opensAt: closed ? '00:00' : opens, closesAt: closed ? '00:00' : closes, closed }) }); await rows.reload(); setDay(undefined); say({ tone: 'ok', text: 'Horario guardado.' }); }
    catch (caught) { setError(errorText(caught, 'No se pudo guardar el horario.')); }
    finally { setBusy(false); }
  }
  if (rows.error) return <EmptyState illustration="error" title="No pudimos cargar los horarios" description={rows.error} />;
  if (!rows.data) return <div className="op-loading">{[0, 1, 2].map(index => <Skeleton key={index} height={52} radius="var(--radius-md)" />)}</div>;
  return <>
    <ul className="op-days">{DAYS.map(({ day: number, label }) => {
      const items = rows.data!.filter(item => item.dayOfWeek === number);
      return <li key={number} className="op-day">
        <b>{label}</b>
        <span className="op-day__hours">{items.length ? items.map(item => item.closed ? <span key={item.id} className="ds-badge" data-status="EXPIRED"><Icon name="ban" size={14} />Cerrado</span>
          : <span key={item.id} className="ds-num op-day__range">{hhmm(item.opensAt)} – {hhmm(item.closesAt)}</span>) : <span className="op-muted">Sin horario</span>}</span>
        {admin && !items.length && <button type="button" className="ds-btn ds-btn--ghost" onClick={() => { setDay(number); setClosed(false); setError(''); }}><Icon name="plus" size={16} />Agregar</button>}
      </li>;
    })}</ul>
    <p className="op-hint">Editar o borrar un horario todavía no está disponible en el backend.</p>
    <Dialog open={day !== undefined} title={`Horario del ${DAYS.find(item => item.day === day)?.label.toLowerCase() ?? ''}`} busy={busy} onClose={() => setDay(undefined)}>
      <form className="menu-form" onSubmit={submit}>
        <label className="ds-switch"><input type="checkbox" role="switch" checked={closed} onChange={event => setClosed(event.target.checked)} />Cerrado todo el día</label>
        {!closed && <div className="form-grid"><label>Abre<input type="time" value={opens} onChange={event => setOpens(event.target.value)} required /></label><label>Cierra<input type="time" value={closes} onChange={event => setCloses(event.target.value)} required /></label></div>}
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="ds-btn ds-btn--primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar horario'}</button>
      </form>
    </Dialog>
  </>;
}

function Zones({ auth, admin, say }: { auth: string; admin: boolean; say: (notice: Notice) => void }) {
  const rows = useLoad<Zone[]>('/operation/zones', auth);
  const [open, setOpen] = useState(false); const [name, setName] = useState(''); const [fee, setFee] = useState('1.00'); const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) { setError('Escribe el nombre de la zona.'); return; }
    if (!/^\d+(\.\d{1,2})?$/.test(fee.trim())) { setError('La tarifa debe ser un número con hasta dos decimales, por ejemplo 1.50.'); return; }
    if (rows.data?.some(zone => zone.name.toLocaleLowerCase('es') === name.trim().toLocaleLowerCase('es'))) { setError('Ya existe una zona con ese nombre.'); return; }
    setBusy(true); setError('');
    try { await api('/admin/zones', auth, { method: 'POST', body: JSON.stringify({ name: name.trim(), fee: fee.trim(), active }) }); await rows.reload(); setOpen(false); say({ tone: 'ok', text: `Zona «${name.trim()}» creada.` }); }
    catch (caught) { setError(errorText(caught, 'No se pudo crear la zona.')); }
    finally { setBusy(false); }
  }
  if (rows.error) return <EmptyState illustration="error" title="No pudimos cargar las zonas" description={rows.error} />;
  if (!rows.data) return <div className="op-loading">{[0, 1].map(index => <Skeleton key={index} height={52} radius="var(--radius-md)" />)}</div>;
  return <>
    <div className="op-toolbar"><p className="op-hint">El personal asigna la zona según la dirección del cliente; no se usa geolocalización.</p>
      {admin && <button type="button" className="ds-btn ds-btn--primary" onClick={() => { setName(''); setFee('1.00'); setActive(true); setError(''); setOpen(true); }}><Icon name="plus" size={18} />Agregar zona</button>}</div>
    {rows.data.length === 0 ? <EmptyState title="Sin zonas de entrega" description="Crea una zona para poder aceptar pedidos a domicilio." />
      : <div className="ds-table-wrap"><table className="ds-table op-table">
        <thead><tr><th scope="col">Zona</th><th scope="col" className="is-num">Tarifa</th><th scope="col">Estado</th></tr></thead>
        <tbody>{rows.data.map(zone => <tr key={zone.id}><td data-label="Zona"><b>{zone.name}</b></td><td data-label="Tarifa" className="is-num">{money(zone.fee)}</td>
          <td data-label="Estado">{zone.active ? <span className="ds-badge" data-status="READY"><Icon name="checkCircle" size={14} />Activa</span> : <span className="ds-badge" data-status="EXPIRED"><Icon name="minusCircle" size={14} />Inactiva</span>}</td></tr>)}</tbody>
      </table></div>}
    <p className="op-hint">Editar o desactivar una zona todavía no está disponible en el backend.</p>
    <Dialog open={open} title="Nueva zona de entrega" busy={busy} onClose={() => setOpen(false)}>
      <form className="menu-form" onSubmit={submit}>
        <div className="form-grid"><label>Nombre<input maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="Ej.: Zona norte" /></label>
          <label>Tarifa (USD)<input inputMode="decimal" value={fee} onChange={event => setFee(event.target.value)} /></label></div>
        <label className="ds-switch"><input type="checkbox" role="switch" checked={active} onChange={event => setActive(event.target.checked)} />Activa</label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="ds-btn ds-btn--primary" disabled={busy}>{busy ? 'Guardando…' : 'Crear zona'}</button>
      </form>
    </Dialog>
  </>;
}

export function OperationPage({ auth, user }: { auth: string; user: User }) {
  const admin = user.roles.includes('ROLE_ADMIN'); const canAdjust = admin || user.roles.includes('ROLE_CAJA');
  const [tab, setTab] = useState<Tab>('reception'); const [notice, setNotice] = useState<Notice>();
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(undefined), 6000); return () => clearTimeout(timer); }, [notice]);
  return <section className="op">
    <PageHeader title="Operación diaria" subtitle="Recepción de pedidos, porciones disponibles, horarios y zonas de entrega." />
    <div className="ds-tabs op-tabs" role="tablist" aria-label="Secciones de operación">
      {TABS.map(item => <button key={item.id} type="button" role="tab" id={`op-tab-${item.id}`} aria-controls={`op-panel-${item.id}`} className="ds-tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}><Icon name={item.icon} size={18} />{item.label}</button>)}
    </div>
    {notice && <p className="orders-notice op-notice" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}><Icon name={notice.tone === 'ok' ? 'checkCircle' : 'alert'} size={18} />{notice.text}</p>}
    <div className="ds-card op-panel" role="tabpanel" id={`op-panel-${tab}`} aria-labelledby={`op-tab-${tab}`}>
      {tab === 'reception' && <Reception auth={auth} admin={admin} say={setNotice} />}
      {tab === 'availability' && <AvailabilityTab auth={auth} canAdjust={canAdjust} say={setNotice} />}
      {tab === 'schedules' && <Schedules auth={auth} admin={admin} say={setNotice} />}
      {tab === 'zones' && <Zones auth={auth} admin={admin} say={setNotice} />}
    </div>
  </section>;
}
