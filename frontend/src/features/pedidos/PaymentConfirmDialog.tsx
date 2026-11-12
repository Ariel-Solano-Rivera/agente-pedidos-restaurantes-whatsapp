import { useEffect, useRef } from 'react';
import { Icon } from '../../design/Icon';
import { money, OrderRef } from './orderTypes';

export type PendingPayment = { order: OrderRef; paymentId: string; amount: number | null };

/**
 * Confirmación corta del cobro (segunda ronda, bloque B). Solo ADMIN y CAJA la ven; el backend vuelve a validar
 * estado, restaurante e idempotencia (`POST /payments/{id}/confirm`). Un comprobante nunca confirma por sí solo.
 */
export function PaymentConfirmDialog({ pending, busy, error, onCancel, onConfirm }: { pending?: PendingPayment; busy: boolean; error: string; onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (pending) { if (!ref.current?.open) ref.current?.showModal(); } else ref.current?.close(); }, [pending]);
  return <dialog ref={ref} className="ds-modal orders-dialog" aria-labelledby="payment-title" onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    {pending && <form onSubmit={event => { event.preventDefault(); onConfirm(); }}>
      <div className="ds-modal__body">
        <h2 id="payment-title">Confirmar cobro <span className="orders-dialog__code">{pending.order.publicCode}</span></h2>
        <p className="orders-dialog__customer">{pending.order.customerName}</p>
        {pending.amount !== null && <p className="orders-dialog__amount ds-num">{money(pending.amount)}</p>}
        <p className="orders-dialog__note"><Icon name="alert" size={16} />Confirmas que el restaurante recibió este pago. Queda registrado con tu usuario y la hora; no cambia el estado del pedido.</p>
        {error && <p className="ds-field__error" role="alert"><Icon name="alert" size={16} />{error}</p>}
      </div>
      <div className="ds-modal__actions">
        <button type="button" className="ds-btn ds-btn--secondary" disabled={busy} onClick={onCancel}>Volver</button>
        <button type="submit" className="ds-btn ds-btn--primary" disabled={busy}>{busy ? 'Guardando…' : 'Confirmar cobro'}</button>
      </div>
    </form>}
  </dialog>;
}
