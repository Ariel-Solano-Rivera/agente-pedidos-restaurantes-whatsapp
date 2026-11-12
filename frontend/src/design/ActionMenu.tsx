import { KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { Icon, IconName } from './Icon';

export type MenuItem = { id: string; label: string; icon?: IconName; danger?: boolean; disabled?: boolean; onSelect: () => void };

/**
 * Menú de acciones «⋯» (segunda ronda, bloque B): botón de icono con `aria-haspopup="menu"` y `aria-expanded`,
 * lista `role="menu"` con `menuitem`, flechas, Inicio/Fin, Esc, cierre al hacer clic fuera y foco de vuelta al botón.
 */
export function ActionMenu({ label, items, disabled = false, size = 44 }: { label: string; items: MenuItem[]; disabled?: boolean; size?: 44 | 56 }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null); const button = useRef<HTMLButtonElement>(null); const menu = useRef<HTMLDivElement>(null);
  const enabled = items.filter(item => !item.disabled);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    (menu.current?.querySelector('[role="menuitem"]:not(:disabled)') as HTMLElement | null)?.focus();
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  function run(item: MenuItem) { setOpen(false); button.current?.focus(); item.onSelect(); }
  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    const nodes = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []);
    const current = nodes.indexOf(document.activeElement as HTMLElement);
    const focus = (index: number) => nodes[(index + nodes.length) % nodes.length]?.focus();
    switch (event.key) {
      case 'ArrowDown': event.preventDefault(); focus(current + 1); break;
      case 'ArrowUp': event.preventDefault(); focus(current - 1); break;
      case 'Home': event.preventDefault(); focus(0); break;
      case 'End': event.preventDefault(); focus(nodes.length - 1); break;
      case 'Escape': event.preventDefault(); setOpen(false); button.current?.focus(); break;
      case 'Tab': setOpen(false); break;
    }
  }

  return <div ref={root} className="ds-menu">
    <button ref={button} type="button" className={`ds-icon-btn ${size === 56 ? 'ds-icon-btn--lg' : ''}`} aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} aria-controls={`${id}-menu`}
      disabled={disabled || enabled.length === 0} onClick={() => setOpen(current => !current)}
      onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); } }}>
      <Icon name="more" size={20} />
    </button>
    <div ref={menu} id={`${id}-menu`} role="menu" aria-label={label} className="ds-menu__list" hidden={!open} onKeyDown={onKey}>
      {items.map(item => <button key={item.id} type="button" role="menuitem" tabIndex={-1} className={`ds-menu__item ${item.danger ? 'ds-menu__item--danger' : ''}`} disabled={item.disabled} onClick={() => run(item)}>
        {item.icon && <Icon name={item.icon} size={18} />}{item.label}
      </button>)}
    </div>
  </div>;
}
