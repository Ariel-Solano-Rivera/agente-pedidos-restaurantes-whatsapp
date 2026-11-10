import { KeyboardEvent, PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../design/Icon';
import { EmptyState, PageHeader, Skeleton } from '../../design/States';
import { orderStatuses, statusLabel } from '../../design/StatusBadge';
import { api, User } from '../../shared/api';
import { Countdown } from '../pedidos/Countdown';
import { actionLabel, clock, OrderUnit, Transition } from '../pedidos/orderTypes';
import './kitchen.css';

/** `GET /orders/board`: pedidos activos sin importes, con unidades, transiciones del rol y `undo` propio. */
type Card = {
  id: string; publicCode: string; status: string; fulfillmentType: 'PICKUP' | 'DELIVERY'; customerName: string; pickupTime: string | null; deliveryZone: string | null;
  createdAt: string; statusSince: string; units: OrderUnit[]; allowedTransitions: Transition[]; undo: { targetStatus: string; expiresAt: string } | null;
};
type Board = { cards: Card[]; generatedAt: string };

/** Máximo cuatro columnas (regla de la etapa 4): son los estados que COCINA puede mover. */
const COLUMNS = [
  { status: 'ACCEPTED', title: 'Por preparar', empty: 'Nada por preparar' },
  { status: 'PREPARING', title: 'En preparación', empty: 'Nada en preparación' },
  { status: 'READY', title: 'Listo', empty: 'Aún no hay pedidos listos' },
] as const;
const REFRESH_MS = 15_000;
const DRAG_THRESHOLD = 8;

type Drag = { id: string; startX: number; startY: number; x: number; y: number; offsetX: number; offsetY: number; width: number; active: boolean; over?: string };

/** Transición que se puede hacer soltando: avance sin motivo devuelto por el backend. */
const dropTransition = (card: Card, target: string) => card.allowedTransitions.find(item => item.targetStatus === target && !item.requiresReason && !item.destructive);
/** Soltar en la columna anterior deshace el último cambio propio mientras el backend ofrezca `undo` y no venza la ventana. */
const canUndoTo = (card: Card, target: string) => Boolean(card.undo && card.undo.targetStatus === target && new Date(card.undo.expiresAt).getTime() > Date.now());
type DropAction = { kind: 'advance'; transition: Transition } | { kind: 'undo' };
const dropAction = (card: Card, target: string): DropAction | undefined => {
  const transition = dropTransition(card, target);
  if (transition) return { kind: 'advance', transition };
  return canUndoTo(card, target) ? { kind: 'undo' } : undefined;
};
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

function Units({ units }: { units: OrderUnit[] }) {
  return <ol className="kb-units">{units.map((unit, index) => {
    const extras = unit.options.filter(option => option.type === 'EXTRA');
    const removed = unit.options.filter(option => option.type === 'REMOVED_INGREDIENT');
    const notes = unit.options.filter(option => option.type === 'INSTRUCTION');
    return <li key={unit.id}>
      <p className="kb-unit"><span className="kb-unit__n ds-num">{index + 1}</span><span><b>{unit.dish}</b> <span className="kb-unit__variant">{unit.variant}</span></span></p>
      {(extras.length + removed.length + notes.length) > 0 && <ul className="kb-mods">
        {extras.map(option => <li key={`e${option.name}`} className="kb-mod kb-mod--plus"><Icon name="check" size={14} />{option.name}</li>)}
        {removed.map(option => <li key={`r${option.name}`} className="kb-mod kb-mod--minus"><Icon name="ban" size={14} />Sin {option.name.toLowerCase()}</li>)}
        {notes.map(option => <li key={`n${option.name}`} className="kb-mod kb-mod--note"><Icon name="chat" size={14} />{option.name}</li>)}
      </ul>}
    </li>;
  })}</ol>;
}

export function KitchenBoard({ auth, user }: { auth: string; user: User }) {
  const kitchen = user.roles.includes('ROLE_COCINA') && !user.roles.includes('ROLE_ADMIN');
  const [cards, setCards] = useState<Card[]>(); const [error, setError] = useState(''); const [updatedAt, setUpdatedAt] = useState<Date>();
  const [busy, setBusy] = useState<Set<string>>(new Set()); const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string }>();
  const [drag, setDrag] = useState<Drag>(); const [picked, setPicked] = useState<{ id: string; target: number }>(); const [announce, setAnnounce] = useState('');
  const [now, setNow] = useState(() => Date.now());
  // La referencia evita cierres obsoletos en los manejadores de puntero y en el temporizador.
  const dragRef = useRef<Drag | undefined>(undefined);
  const updateDrag = (next?: Drag) => { dragRef.current = next; setDrag(next); };

  const load = useCallback(async () => {
    try { const board = await api<Board>('/orders/board', auth); setCards(board.cards); setError(''); setUpdatedAt(new Date()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo cargar el tablero.'); }
  }, [auth]);
  useEffect(() => { void load(); }, [load]);
  // Recarga periódica mientras nadie arrastra ni espera una respuesta; el reloj de cada tarjeta avanza cada 15 s.
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === 'visible' && !dragRef.current && !picked && busy.size === 0) void load();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load, picked, busy]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(undefined), 6000); return () => clearTimeout(timer); }, [notice]);

  const say = (text: string, tone: 'ok' | 'error' = 'ok', visible = true) => { setAnnounce(text); if (visible) setNotice({ tone, text }); };
  const setBusyFor = (id: string, on: boolean) => setBusy(current => { const next = new Set(current); if (on) next.add(id); else next.delete(id); return next; });

  /** Actualización optimista: mueve la tarjeta, llama al backend y revierte si falla. */
  async function run(card: Card, path: string, body: object | undefined, optimistic: Card | null, success: string) {
    const previous = cards;
    setCards(current => current?.flatMap(item => item.id !== card.id ? [item] : optimistic ? [optimistic] : []));
    setBusyFor(card.id, true);
    try {
      await api(path, auth, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: body ? JSON.stringify(body) : undefined });
      say(success); await load();
    } catch (caught) {
      setCards(previous);
      say(`${card.publicCode}: ${caught instanceof Error ? caught.message : 'No se pudo actualizar.'} Se devolvió a «${statusLabel(card.status)}».`, 'error');
    } finally { setBusyFor(card.id, false); }
  }

  function advance(card: Card, transition: Transition) {
    const stays = COLUMNS.some(column => column.status === transition.targetStatus);
    const optimistic = stays ? { ...card, status: transition.targetStatus, allowedTransitions: [], undo: null, statusSince: new Date().toISOString() } : null;
    void run(card, `/orders/${card.id}/transitions`, { targetStatus: transition.targetStatus }, optimistic,
      `${card.publicCode} pasó a «${statusLabel(transition.targetStatus)}».${kitchen ? ' Puedes deshacerlo durante unos minutos.' : ''}`);
  }
  function undo(card: Card) {
    if (!card.undo) return;
    const target = card.undo.targetStatus;
    void run(card, `/orders/${card.id}/undo`, undefined, { ...card, status: target, allowedTransitions: [], undo: null, statusSince: new Date().toISOString() },
      `Cambio deshecho: ${card.publicCode} volvió a «${statusLabel(target)}».`);
  }
  /** Soltar en una columna: solo si `allowedTransitions` lo permite; si no, la tarjeta vuelve y se explica por qué. */
  function drop(card: Card, target?: string) {
    if (!target || target === card.status) { say(`${card.publicCode} se quedó en «${statusLabel(card.status)}».`, 'ok', false); return; }
    const action = dropAction(card, target);
    if (action?.kind === 'advance') { advance(card, action.transition); return; }
    if (action?.kind === 'undo') { undo(card); return; }
    const backward = COLUMNS.findIndex(column => column.status === target) < COLUMNS.findIndex(column => column.status === card.status);
    say(backward && kitchen ? `${card.publicCode} volvió a su columna: solo puedes deshacer tu último cambio durante 2 minutos. Si fue un error, avisa a caja.`
      : backward ? `Para retroceder ${card.publicCode} hace falta un motivo: hazlo desde Pedidos.`
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
    if (current?.active) drop(card, current.over);
  }

  // — Teclado: Espacio o Enter toma la tarjeta, flechas eligen la columna, Enter suelta y Escape cancela —
  function onKeyDown(event: KeyboardEvent<HTMLElement>, card: Card, column: number) {
    if (event.target !== event.currentTarget) return;
    if (picked?.id === card.id) {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const target = Math.min(COLUMNS.length - 1, Math.max(0, picked.target + (event.key === 'ArrowRight' ? 1 : -1)));
        const action = dropAction(card, COLUMNS[target].status);
        setPicked({ id: card.id, target }); setAnnounce(`Columna ${COLUMNS[target].title}${target === column ? ' (actual)' : action?.kind === 'undo' ? ' (deshacer tu último cambio)' : action ? '' : ' (no permitida)'}.`);
      } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setPicked(undefined); drop(card, COLUMNS[picked.target].status); }
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
    const action = dropAction(card, status);
    return action?.kind === 'undo' ? 'undo' : action ? 'allowed' : 'denied';
  };

  return <section className={`kb ${drag?.active ? 'is-dragging' : ''}`}>
    <PageHeader title="Cocina" subtitle={<>Arrastra una tarjeta a la columna siguiente o usa su botón. {kitchen ? 'Si fue un error, arrástrala de vuelta o usa «Deshacer» durante 2 minutos.' : 'Para retroceder con motivo, usa Pedidos.'}</>}
      aside={<button type="button" className="ds-btn ds-btn--ghost" onClick={() => void load()}><Icon name="refresh" />{updatedAt ? `Actualizado ${clock(updatedAt.toISOString())}` : 'Cargando…'}</button>} />
    <p id="kb-help" className="ds-sr-only">Con teclado: Espacio o Enter toma la tarjeta, las flechas izquierda y derecha eligen la columna, Enter la suelta y Escape cancela.</p>
    <p className="ds-sr-only" aria-live="assertive">{announce}</p>
    {notice && <p className="orders-notice kb-notice" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}><Icon name={notice.tone === 'ok' ? 'checkCircle' : 'alert'} size={18} />{notice.text}</p>}

    {error && !cards ? <div className="ds-card"><EmptyState illustration="error" title="No pudimos cargar el tablero" description={error} action={<button type="button" className="ds-btn ds-btn--primary ds-btn--lg" onClick={() => void load()}><Icon name="refresh" />Reintentar</button>} /></div>
      : <div className="kb-board">{COLUMNS.map((column, columnIndex) => {
        const items = cards?.filter(card => card.status === column.status) ?? [];
        return <section key={column.status} className="kb-column" data-column={column.status} data-status={column.status} data-drop={dropState(column.status)} aria-labelledby={`kb-col-${column.status}`}>
          <header className="kb-column__head">
            <h2 id={`kb-col-${column.status}`}><span className="kb-column__icon"><Icon name={orderStatuses[column.status].icon} size={18} /></span>{column.title}</h2>
            <span className="kb-column__count ds-num" aria-label={`${items.length} pedidos`}>{cards ? items.length : '–'}</span>
          </header>
          <div className="kb-column__list">
            {!cards ? <>{[0, 1].map(index => <div key={index} className="kb-card kb-card--loading"><Skeleton width="55%" height={26} /><Skeleton width="80%" height={16} /><Skeleton height={56} radius="var(--radius-lg)" /></div>)}</>
              : items.length === 0 ? <EmptyState compact illustration="done" title={column.empty} description={column.status === 'READY' ? 'Aquí quedan los pedidos preparados hasta que caja los complete.' : 'Cuando haya pedidos aparecerán aquí.'} />
                : items.map(card => {
                  const next = card.allowedTransitions.filter(item => item.direction === 'FORWARD' && !item.destructive && !item.requiresReason);
                  const undoOpen = card.undo && new Date(card.undo.expiresAt).getTime() > now;
                  const isPicked = picked?.id === card.id;
                  return <article key={card.id} className="kb-card" data-status={card.status} data-placeholder={drag?.active && drag.id === card.id} data-picked={isPicked} aria-busy={busy.has(card.id)}
                    tabIndex={0} aria-roledescription="pedido arrastrable" aria-describedby="kb-help" aria-label={`${card.publicCode}, ${column.title}`}
                    onPointerDown={event => onPointerDown(event, card)} onPointerMove={onPointerMove} onPointerUp={() => onPointerUp(card)} onPointerCancel={() => updateDrag(undefined)}
                    onKeyDown={event => onKeyDown(event, card, columnIndex)}>
                    <header className="kb-card__head">
                      <h3 className="kb-card__code">{card.publicCode}</h3>
                      <span className="kb-grip" aria-hidden="true"><Icon name="grip" size={22} /></span>
                    </header>
                    <div className="kb-card__meta">
                      <Elapsed card={card} now={now} />
                      <span className="kb-mode"><Icon name={card.fulfillmentType === 'DELIVERY' ? 'moto' : 'bag'} size={18} />
                        {card.fulfillmentType === 'DELIVERY' ? `Entrega${card.deliveryZone ? ` · ${card.deliveryZone}` : ''}` : `Retiro${card.pickupTime ? ` · ${clock(card.pickupTime)}` : ''}`}</span>
                    </div>
                    <p className="kb-card__customer">{card.customerName}</p>
                    <Units units={card.units} />
                    {(next.length > 0 || undoOpen) && <footer className="kb-card__actions">
                      {next.map(transition => <button key={transition.targetStatus} type="button" className="ds-btn ds-btn--primary ds-btn--lg" disabled={busy.has(card.id)} onClick={() => advance(card, transition)}>
                        {actionLabel(card.status, transition)}<Icon name="arrowRight" size={20} /></button>)}
                      {undoOpen && card.undo && <button type="button" className="ds-btn ds-btn--secondary ds-btn--lg" disabled={busy.has(card.id)} onClick={() => undo(card)}>
                        <Icon name="undo" size={20} />Deshacer<span className="kb-countdown" aria-label="tiempo restante"><Countdown until={card.undo.expiresAt} onExpire={() => setNow(Date.now())} /></span></button>}
                    </footer>}
                  </article>;
                })}
          </div>
        </section>;
      })}</div>}

    {dragged && drag && <div className="kb-ghost" aria-hidden="true" style={{ left: drag.x - drag.offsetX, top: drag.y - drag.offsetY, width: drag.width }}>
      <span className="kb-card__code">{dragged.publicCode}</span>
      <span className="kb-ghost__hint">{drag.over && drag.over !== dragged.status ? (dropAction(dragged, drag.over)?.kind === 'undo' ? `Soltar para deshacer (volver a «${statusLabel(drag.over)}»)` : dropAction(dragged, drag.over) ? `Soltar en «${statusLabel(drag.over)}»` : 'No se puede soltar aquí') : 'Arrastra a otra columna'}</span>
    </div>}
  </section>;
}
