import { FormEvent, KeyboardEvent, PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../design/Icon';
import { EmptyState, PageHeader, Skeleton } from '../../design/States';
import { orderStatuses, StatusBadge, statusLabel } from '../../design/StatusBadge';
import { api, User } from '../../shared/api';
import { clock, OrderUnit, reasonLabels, Transition } from '../pedidos/orderTypes';
import { groupUnits } from './groupUnits';
import './kitchen.css';

/** `GET /orders/board`: pedidos activos sin importes, con unidades y transiciones del rol. */
type Card = {
  id: string; publicCode: string; status: string; fulfillmentType: 'PICKUP' | 'DELIVERY'; customerName: string; pickupTime: string | null; deliveryZone: string | null;
  createdAt: string; statusSince: string; units: OrderUnit[]; allowedTransitions: Transition[];
};
type Board = { cards: Card[]; generatedAt: string };

/** Máximo cuatro columnas (regla de la etapa 4): son los estados entre los que se mueve cocina. */
const COLUMNS = [
  { status: 'ACCEPTED', title: 'Por preparar', empty: 'Nada por preparar' },
  { status: 'PREPARING', title: 'En preparación', empty: 'Nada en preparación' },
  { status: 'READY', title: 'Listo', empty: 'Aún no hay pedidos listos' },
] as const;
const REFRESH_MS = 15_000;
const DRAG_THRESHOLD = 8;
const columnIndex = (status: string) => COLUMNS.findIndex(column => column.status === status);

type Drag = { id: string; startX: number; startY: number; x: number; y: number; offsetX: number; offsetY: number; width: number; active: boolean; over?: string };
/** Pendiente de motivo: retroceso elegido por botón, arrastre o teclado; la tarjeta no se mueve hasta elegirlo. */
type PendingBack = { card: Card; transition: Transition };

/** Transición hacia una columna del tablero según `allowedTransitions`; retroceder exige motivo y se confirma aparte. */
const transitionTo = (card: Card, target: string) => card.allowedTransitions.find(item => item.targetStatus === target && !item.destructive && columnIndex(target) >= 0);
const minutesSince = (value: string, now: number) => Math.max(0, Math.floor((now - new Date(value).getTime()) / 60_000));

function Elapsed({ card, now }: { card: Card; now: number }) {
  const minutes = minutesSince(card.statusSince, now);
  const age = card.status === 'READY' ? 'ready' : minutes >= 20 ? 'late' : minutes >= 10 ? 'warn' : 'ok';
  const days = Math.floor(minutes / 1440);
  const text = minutes < 60 ? `${minutes} min` : minutes < 1440 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${days} ${days === 1 ? 'día' : 'días'}`;
  return <span className="kb-elapsed" data-age={age} title={`En «${statusLabel(card.status)}» desde ${clock(card.statusSince)}`}>
    <Icon name={card.status === 'READY' ? 'bell' : 'clock'} size={18} />{card.status === 'READY' ? `Listo hace ${text}` : text}
    {age === 'late' && <span className="ds-sr-only"> (demorado)</span>}
  </span>;
}

/** Unidades idénticas agrupadas («x2»); los extras llevan la palabra «extra» y los retirados «Sin …». */
function Units({ units }: { units: OrderUnit[] }) {
  return <ul className="kb-units">{groupUnits(units).map(line => <li key={line.key}>
    <p className="kb-unit">
      <span><b>{line.dish}</b> <span className="kb-unit__variant">{line.variant}</span></span>
      {line.quantity > 1 && <span className="kb-unit__qty ds-num" aria-label={`${line.quantity} unidades iguales`}>x{line.quantity}</span>}
    </p>
    {(line.extras.length + line.removed.length + line.notes.length) > 0 && <ul className="kb-mods">
      {line.extras.map(extra => <li key={`e${extra.name}`} className="kb-mod kb-mod--plus"><Icon name="plus" size={14} />{extra.name} (extra){extra.quantity > 1 && <span className="kb-mod__qty ds-num">x{extra.quantity}</span>}</li>)}
      {line.removed.map(name => <li key={`r${name}`} className="kb-mod kb-mod--minus"><Icon name="ban" size={14} />Sin {name.toLowerCase()}</li>)}
      {line.notes.map(note => <li key={`n${note}`} className="kb-mod kb-mod--note"><Icon name="chat" size={14} />{note}</li>)}
    </ul>}
  </li>)}</ul>;
}

/** Selector pequeño de motivo (un toque). Solo ADMIN y CAJA deben escribir con «Otro motivo»; cocina no. */
function ReasonPicker({ pending, kitchen, busy, error, onCancel, onChoose }: {
  pending?: PendingBack; kitchen: boolean; busy: boolean; error: string; onCancel: () => void; onChoose: (reasonCode: string, reason?: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [other, setOther] = useState(false); const [text, setText] = useState('');
  useEffect(() => { if (pending) { setOther(false); setText(''); if (!ref.current?.open) ref.current?.showModal(); } else ref.current?.close(); }, [pending]);
  function submitOther(event: FormEvent) { event.preventDefault(); if (text.trim()) onChoose('OTRO', text.trim()); }
  return <dialog ref={ref} className="ds-modal kb-reasons" aria-labelledby="kb-reason-title" onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    {pending && <div className="ds-modal__body">
      <h2 id="kb-reason-title">¿Por qué vuelve {pending.card.publicCode}?</h2>
      <p className="kb-reasons__path"><StatusBadge status={pending.card.status} /><Icon name="arrowLeft" size={18} /><StatusBadge status={pending.transition.targetStatus} /></p>
      {!other ? <div className="kb-reasons__list">
        {Object.entries(reasonLabels).map(([code, label]) => <button key={code} type="button" className="ds-btn ds-btn--secondary ds-btn--lg" disabled={busy}
          onClick={() => (code === 'OTRO' && !kitchen ? setOther(true) : onChoose(code))}>{label}</button>)}
      </div> : <form className="kb-reasons__other" onSubmit={submitOther}>
        <label className="ds-field"><span className="ds-field__label">Describe el motivo</span>
          <textarea className="ds-input" rows={3} maxLength={300} value={text} onChange={event => setText(event.target.value)} autoFocus /></label>
        <button type="submit" className="ds-btn ds-btn--primary ds-btn--lg" disabled={busy || !text.trim()}>Confirmar retroceso</button>
      </form>}
      {error && <p className="ds-field__error" role="alert"><Icon name="alert" size={16} />{error}</p>}
      <button type="button" className="ds-btn ds-btn--ghost ds-btn--lg" disabled={busy} onClick={onCancel}>Cancelar, se queda donde está</button>
    </div>}
  </dialog>;
}

export function KitchenBoard({ auth, user }: { auth: string; user: User }) {
  const kitchen = user.roles.includes('ROLE_COCINA') && !user.roles.includes('ROLE_ADMIN');
  const [cards, setCards] = useState<Card[]>(); const [error, setError] = useState(''); const [updatedAt, setUpdatedAt] = useState<Date>();
  const [busy, setBusy] = useState<Set<string>>(new Set()); const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string }>();
  const [drag, setDrag] = useState<Drag>(); const [picked, setPicked] = useState<{ id: string; target: number }>(); const [announce, setAnnounce] = useState('');
  const [pendingBack, setPendingBack] = useState<PendingBack>(); const [backError, setBackError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  // La referencia evita cierres obsoletos en los manejadores de puntero y en el temporizador.
  const dragRef = useRef<Drag | undefined>(undefined);
  const updateDrag = (next?: Drag) => { dragRef.current = next; setDrag(next); };

  const load = useCallback(async () => {
    try { const board = await api<Board>('/orders/board', auth); setCards(board.cards); setError(''); setUpdatedAt(new Date()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo cargar el tablero.'); }
  }, [auth]);
  useEffect(() => { void load(); }, [load]);
  // Recarga periódica mientras nadie arrastra, elige motivo ni espera una respuesta; el reloj avanza cada 15 s.
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === 'visible' && !dragRef.current && !picked && !pendingBack && busy.size === 0) void load();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load, picked, pendingBack, busy]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(undefined), 6000); return () => clearTimeout(timer); }, [notice]);

  const say = (text: string, tone: 'ok' | 'error' = 'ok', visible = true) => { setAnnounce(text); if (visible) setNotice({ tone, text }); };
  const setBusyFor = (id: string, on: boolean) => setBusy(current => { const next = new Set(current); if (on) next.add(id); else next.delete(id); return next; });

  /** Actualización optimista: mueve la tarjeta, llama al backend y revierte si falla. Devuelve si tuvo éxito. */
  async function run(card: Card, body: object, success: string): Promise<boolean> {
    const target = (body as { targetStatus: string }).targetStatus;
    const previous = cards;
    setCards(current => current?.map(item => item.id !== card.id ? item : { ...item, status: target, allowedTransitions: [], statusSince: new Date().toISOString() }));
    setBusyFor(card.id, true);
    try {
      await api(`/orders/${card.id}/transitions`, auth, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(body) });
      say(success); await load(); return true;
    } catch (caught) {
      setCards(previous);
      const message = caught instanceof Error ? caught.message : 'No se pudo actualizar.';
      say(`${card.publicCode}: ${message} Se devolvió a «${statusLabel(card.status)}».`, 'error');
      return false;
    } finally { setBusyFor(card.id, false); }
  }

  function advance(card: Card, transition: Transition) {
    void run(card, { targetStatus: transition.targetStatus }, `${card.publicCode} pasó a «${statusLabel(transition.targetStatus)}».`);
  }
  /** Retroceder: primero el motivo; si se cancela, la tarjeta no se mueve. */
  function askBack(card: Card, transition: Transition) { setBackError(''); setPendingBack({ card, transition }); }
  async function back(reasonCode: string, reason?: string) {
    if (!pendingBack) return;
    const { card, transition } = pendingBack;
    setBackError('');
    const ok = await run(card, { targetStatus: transition.targetStatus, reasonCode, reason }, `${card.publicCode} volvió a «${statusLabel(transition.targetStatus)}» · ${reasonLabels[reasonCode] ?? reasonCode}.`);
    if (ok) setPendingBack(undefined); else setBackError('No se pudo retroceder. Revisa el aviso y vuelve a intentarlo.');
  }
  /** Mover a una columna (botón, arrastre o teclado): avanza directo o pide motivo para retroceder; si no se permite, explica por qué. */
  function move(card: Card, target?: string) {
    if (!target || target === card.status) { say(`${card.publicCode} se quedó en «${statusLabel(card.status)}».`, 'ok', false); return; }
    const transition = transitionTo(card, target);
    if (transition?.direction === 'FORWARD') { advance(card, transition); return; }
    if (transition?.direction === 'BACKWARD') { askBack(card, transition); return; }
    const backward = columnIndex(target) < columnIndex(card.status);
    say(backward ? `${card.publicCode} solo puede volver un paso, a «${statusLabel(COLUMNS[columnIndex(card.status) - 1]?.status ?? card.status)}».`
      : `${card.publicCode} no puede pasar a «${statusLabel(target)}» desde «${statusLabel(card.status)}».`, 'error');
  }

  // — Arrastrar con Pointer Events (dedo, lápiz o mouse) —
  function onPointerDown(event: ReactPointerEvent<HTMLElement>, card: Card) {
    if (event.button !== 0 || busy.has(card.id) || (event.target as HTMLElement).closest('button')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    updateDrag({ id: card.id, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, width: rect.width, active: false });
  }
  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const current = dragRef.current; if (!current) return;
    const moved = Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > DRAG_THRESHOLD;
    if (!current.active && !moved) return;
    const under = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-column]');
    if (!current.active) { const card = cards?.find(item => item.id === current.id); if (card) setAnnounce(`Arrastrando ${card.publicCode}.`); }
    updateDrag({ ...current, x: event.clientX, y: event.clientY, active: true, over: under?.dataset.column });
  }
  function onPointerUp(card: Card) {
    const current = dragRef.current; updateDrag(undefined);
    if (current?.active) move(card, current.over);
  }

  // — Teclado: Espacio o Enter toma la tarjeta, flechas eligen la columna, Enter suelta y Escape cancela —
  function onKeyDown(event: KeyboardEvent<HTMLElement>, card: Card, column: number) {
    if (event.target !== event.currentTarget) return;
    if (picked?.id === card.id) {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const target = Math.min(COLUMNS.length - 1, Math.max(0, picked.target + (event.key === 'ArrowRight' ? 1 : -1)));
        const transition = transitionTo(card, COLUMNS[target].status);
        setPicked({ id: card.id, target }); setAnnounce(`Columna ${COLUMNS[target].title}${target === column ? ' (actual)' : transition?.direction === 'BACKWARD' ? ' (retroceder, pide motivo)' : transition ? '' : ' (no permitida)'}.`);
      } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setPicked(undefined); move(card, COLUMNS[picked.target].status); }
      else if (event.key === 'Escape') { event.preventDefault(); setPicked(undefined); setAnnounce(`Cancelado. ${card.publicCode} sigue en ${COLUMNS[column].title}.`); }
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); setPicked({ id: card.id, target: column });
      setAnnounce(`Tomaste ${card.publicCode}. Usa las flechas para elegir columna, Enter para soltar y Escape para cancelar.`);
    }
  }

  const dragged = drag?.active ? cards?.find(card => card.id === drag.id) : undefined;
  const pickedCard = picked ? cards?.find(card => card.id === picked.id) : undefined;
  const dropState = (status: string) => {
    const card = dragged ?? pickedCard; if (!card) return undefined;
    const over = dragged ? drag?.over : COLUMNS[picked!.target].status;
    if (over !== status || status === card.status) return undefined;
    const transition = transitionTo(card, status);
    return transition?.direction === 'BACKWARD' ? 'back' : transition ? 'allowed' : 'denied';
  };
  const ghostHint = (card: Card, over?: string) => {
    if (!over || over === card.status) return 'Arrastra a otra columna';
    const transition = transitionTo(card, over);
    return transition?.direction === 'BACKWARD' ? `Soltar para volver a «${statusLabel(over)}» (pide motivo)` : transition ? `Soltar en «${statusLabel(over)}»` : 'No se puede soltar aquí';
  };

  return <section className={`kb ${drag?.active ? 'is-dragging' : ''}`}>
    <PageHeader title="Cocina" subtitle="Arrastra una tarjeta a la columna de al lado o usa sus flechas. Retroceder pide un motivo con un toque."
      aside={<button type="button" className="ds-btn ds-btn--ghost" onClick={() => void load()}><Icon name="refresh" />{updatedAt ? `Actualizado ${clock(updatedAt.toISOString())}` : 'Cargando…'}</button>} />
    <p id="kb-help" className="ds-sr-only">Con teclado: Espacio o Enter toma la tarjeta, las flechas izquierda y derecha eligen la columna, Enter la suelta y Escape cancela.</p>
    <p className="ds-sr-only" aria-live="assertive">{announce}</p>
    {notice && <p className="orders-notice kb-notice" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}><Icon name={notice.tone === 'ok' ? 'checkCircle' : 'alert'} size={18} />{notice.text}</p>}

    {error && !cards ? <div className="ds-card"><EmptyState illustration="error" title="No pudimos cargar el tablero" description={error} action={<button type="button" className="ds-btn ds-btn--primary ds-btn--lg" onClick={() => void load()}><Icon name="refresh" />Reintentar</button>} /></div>
      : <div className="kb-board">{COLUMNS.map((column, index) => {
        const items = cards?.filter(card => card.status === column.status) ?? [];
        return <section key={column.status} className="kb-column" data-column={column.status} data-status={column.status} data-drop={dropState(column.status)} aria-labelledby={`kb-col-${column.status}`}>
          <header className="kb-column__head">
            <h2 id={`kb-col-${column.status}`}><span className="kb-column__icon"><Icon name={orderStatuses[column.status].icon} size={18} /></span>{column.title}</h2>
            <span className="kb-column__count ds-num" aria-label={`${items.length} pedidos`}>{cards ? items.length : '–'}</span>
          </header>
          <div className="kb-column__list">
            {!cards ? <>{[0, 1].map(key => <div key={key} className="kb-card kb-card--loading"><Skeleton width="55%" height={26} /><Skeleton width="80%" height={16} /><Skeleton height={56} radius="var(--radius-lg)" /></div>)}</>
              : items.length === 0 ? <EmptyState compact illustration="done" title={column.empty} description={column.status === 'READY' ? 'Aquí quedan los pedidos preparados hasta que caja los complete.' : 'Suelta aquí una tarjeta o espera nuevos pedidos.'} />
                : items.map(card => {
                  const backTransition = index > 0 ? transitionTo(card, COLUMNS[index - 1].status) : undefined;
                  const forwardTransition = index < COLUMNS.length - 1 ? transitionTo(card, COLUMNS[index + 1].status) : undefined;
                  const isPicked = picked?.id === card.id;
                  return <article key={card.id} className="kb-card" data-status={card.status} data-placeholder={drag?.active && drag.id === card.id} data-picked={isPicked} aria-busy={busy.has(card.id)}
                    tabIndex={0} aria-roledescription="pedido arrastrable" aria-describedby="kb-help" aria-label={`${card.publicCode}, ${column.title}`}
                    onPointerDown={event => onPointerDown(event, card)} onPointerMove={onPointerMove} onPointerUp={() => onPointerUp(card)} onPointerCancel={() => updateDrag(undefined)}
                    onKeyDown={event => onKeyDown(event, card, index)}>
                    <header className="kb-card__head">
                      <h3 className="kb-card__code">{card.publicCode}</h3>
                      <StatusBadge status={card.status} />
                      <span className="kb-grip" aria-hidden="true"><Icon name="grip" size={22} /></span>
                    </header>
                    <div className="kb-card__meta">
                      <Elapsed card={card} now={now} />
                      <span className="kb-mode"><Icon name={card.fulfillmentType === 'DELIVERY' ? 'moto' : 'bag'} size={18} />
                        {card.fulfillmentType === 'DELIVERY' ? `Entrega${card.deliveryZone ? ` · ${card.deliveryZone}` : ''}` : `Retiro${card.pickupTime ? ` · ${clock(card.pickupTime)}` : ''}`}</span>
                    </div>
                    <p className="kb-card__customer">{card.customerName}</p>
                    <Units units={card.units} />
                    {/* Dos botones solo con flechas: retroceder (pide motivo) y avanzar. Deshabilitados en los extremos o si el backend no lo permite. */}
                    <footer className="kb-card__actions">
                      <button type="button" className="ds-icon-btn kb-arrow" disabled={!backTransition || busy.has(card.id)} onClick={() => backTransition && askBack(card, backTransition)}
                        aria-label={backTransition ? `Volver a ${statusLabel(backTransition.targetStatus)} (pide motivo)` : 'No se puede retroceder desde aquí'} title={backTransition ? `Volver a ${statusLabel(backTransition.targetStatus)}` : 'No se puede retroceder'}>
                        <Icon name="arrowLeft" size={26} /></button>
                      <button type="button" className="ds-icon-btn kb-arrow kb-arrow--next" disabled={!forwardTransition || busy.has(card.id)} onClick={() => forwardTransition && advance(card, forwardTransition)}
                        aria-label={forwardTransition ? `Pasar a ${statusLabel(forwardTransition.targetStatus)}` : 'No se puede avanzar desde aquí'} title={forwardTransition ? `Pasar a ${statusLabel(forwardTransition.targetStatus)}` : 'No se puede avanzar'}>
                        <Icon name="arrowRight" size={26} /></button>
                    </footer>
                  </article>;
                })}
          </div>
        </section>;
      })}</div>}

    {dragged && drag && <div className="kb-ghost" aria-hidden="true" style={{ left: drag.x - drag.offsetX, top: drag.y - drag.offsetY, width: drag.width }}>
      <span className="kb-card__code">{dragged.publicCode}</span>
      <span className="kb-ghost__hint">{ghostHint(dragged, drag.over)}</span>
    </div>}

    <ReasonPicker pending={pendingBack} kitchen={kitchen} busy={pendingBack ? busy.has(pendingBack.card.id) : false} error={backError} onCancel={() => { setPendingBack(undefined); setBackError(''); }} onChoose={(code, reason) => void back(code, reason)} />
  </section>;
}
