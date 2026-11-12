import { FormEvent, useEffect, useRef, useState } from 'react';
import { Icon } from '../../design/Icon';
import { StatusBadge } from '../../design/StatusBadge';
import { actionLabel, OrderRef, reasonLabels, Transition } from './orderTypes';

export type PendingAction = { order: OrderRef; transition: Transition };

/**
 * Confirma un cambio de estado mostrando origen y destino. Retroceder exige un motivo de la lista
 * (y texto solo con «Otro motivo»); el backend vuelve a validar todo.
 */
export function TransitionDialog({ pending, busy, error, onCancel, onConfirm }: {
  pending?: PendingAction; busy: boolean; error: string; onCancel: () => void; onConfirm: (reasonCode?: string, reason?: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reasonCode, setReasonCode] = useState(''); const [reason, setReason] = useState(''); const [localError, setLocalError] = useState('');
  useEffect(() => {
    if (pending) { setReasonCode(''); setReason(''); setLocalError(''); if (!ref.current?.open) ref.current?.showModal(); }
    else ref.current?.close();
  }, [pending]);

  const backward = pending?.transition.direction === 'BACKWARD';
  const destructive = Boolean(pending?.transition.destructive);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (backward && !reasonCode) { setLocalError('Elige el motivo del retroceso.'); return; }
    if (backward && reasonCode === 'OTRO' && !reason.trim()) { setLocalError('Describe el motivo cuando eliges «Otro motivo».'); return; }
    onConfirm(backward ? reasonCode : undefined, backward ? reason.trim() || undefined : undefined);
  }

  return <dialog ref={ref} className="ds-modal orders-dialog" aria-labelledby="transition-title"
    onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    {pending && <form onSubmit={submit}>
      <div className="ds-modal__body">
        <h2 id="transition-title">{actionLabel(pending.order.status, pending.transition)} <span className="orders-dialog__code">{pending.order.publicCode}</span></h2>
        <p className="orders-dialog__customer">{pending.order.customerName}</p>
        <div className="orders-dialog__path" aria-label="Cambio de estado">
          <StatusBadge status={pending.order.status} /><Icon name="arrowRight" size={18} /><StatusBadge status={pending.transition.targetStatus} />
        </div>
        {backward && <fieldset className="orders-reasons">
          <legend>Motivo del retroceso <span aria-hidden="true">*</span></legend>
          {Object.entries(reasonLabels).map(([code, label]) => <label key={code} className="orders-reason">
            <input type="radio" name="reason" value={code} checked={reasonCode === code} onChange={() => { setReasonCode(code); setLocalError(''); }} />
            <span>{label}</span>
          </label>)}
        </fieldset>}
        {backward && <label className="ds-field">
          <span className="ds-field__label">Detalle {reasonCode === 'OTRO' ? '(obligatorio)' : '(opcional)'}</span>
          <textarea className="ds-input orders-textarea" maxLength={300} rows={3} value={reason} onChange={event => setReason(event.target.value)} aria-invalid={Boolean(localError) && reasonCode === 'OTRO'} />
          <span className="ds-field__hint">Queda en el historial del pedido con tu usuario y rol.</span>
        </label>}
        {backward && <p className="orders-dialog__note"><Icon name="alert" size={16} />Retroceder no libera la reserva ni cambia el pago.</p>}
        {destructive && <p className="orders-dialog__warning"><Icon name="alert" size={16} />Esta acción cierra el pedido y no se puede revertir desde el panel.</p>}
        {(localError || error) && <p className="ds-field__error" role="alert"><Icon name="alert" size={16} />{localError || error}</p>}
      </div>
      <div className="ds-modal__actions">
        <button type="button" className="ds-btn ds-btn--secondary" disabled={busy} onClick={onCancel}>Volver</button>
        <button type="submit" className={`ds-btn ${destructive ? 'ds-btn--danger' : 'ds-btn--primary'}`} disabled={busy}>{busy ? 'Guardando…' : `Confirmar: ${actionLabel(pending.order.status, pending.transition).toLowerCase()}`}</button>
      </div>
    </form>}
  </dialog>;
}
