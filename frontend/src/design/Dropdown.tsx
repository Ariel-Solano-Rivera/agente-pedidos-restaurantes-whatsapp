import { KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';

export type DropdownOption = { value: string; label: string; count?: number | null; detail?: string };

/**
 * Menú desplegable accesible de selección única (segunda ronda, bloque B): botón con `aria-haspopup="listbox"`
 * y `aria-expanded`, lista `role="listbox"` con `aria-selected`, flechas, Inicio/Fin, Enter/Espacio, Esc y cierre
 * al hacer clic fuera. Cada opción puede mostrar un contador que calcula el backend. La opción con valor '' es «Todos».
 */
export function Dropdown({ label, options, value, onChange, loading = false, align = 'start', className = '' }: {
  label: string; options: DropdownOption[]; value: string; onChange: (value: string) => void; loading?: boolean; align?: 'start' | 'end'; className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null); const button = useRef<HTMLButtonElement>(null); const list = useRef<HTMLUListElement>(null);
  const selected = options.find(option => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    const index = Math.max(0, options.findIndex(option => option.value === value));
    (list.current?.children[index] as HTMLElement | undefined)?.focus();
    return () => document.removeEventListener('pointerdown', close);
  }, [open, options, value]);

  function choose(next: string) { setOpen(false); button.current?.focus(); if (next !== value) onChange(next); }
  function onListKey(event: KeyboardEvent<HTMLUListElement>) {
    const items = Array.from(list.current?.children ?? []) as HTMLElement[];
    const current = items.indexOf(document.activeElement as HTMLElement);
    const focus = (index: number) => items[(index + items.length) % items.length]?.focus();
    switch (event.key) {
      case 'ArrowDown': event.preventDefault(); focus(current + 1); break;
      case 'ArrowUp': event.preventDefault(); focus(current - 1); break;
      case 'Home': event.preventDefault(); focus(0); break;
      case 'End': event.preventDefault(); focus(items.length - 1); break;
      case 'Escape': event.preventDefault(); setOpen(false); button.current?.focus(); break;
      case 'Tab': setOpen(false); break;
      case 'Enter': case ' ': event.preventDefault(); if (current >= 0) choose(options[current].value); break;
    }
  }
  function onButtonKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); }
  }

  return <div ref={root} className={`ds-dropdown ${className}`} data-align={align} aria-busy={loading}>
    <button ref={button} id={`${id}-btn`} type="button" className="ds-dropdown__btn" aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-list`} onClick={() => setOpen(current => !current)} onKeyDown={onButtonKey}>
      <span className="ds-dropdown__label">{label}</span>
      <span className="ds-dropdown__value">{selected?.label}{selected?.detail && <span className="ds-dropdown__detail">{selected.detail}</span>}</span>
      {selected && selected.count !== undefined && <span className="ds-dropdown__count" aria-label={selected.count === null ? 'sin dato' : `${selected.count}`}>{selected.count ?? '–'}</span>}
      <Icon name="chevronDown" size={16} className="ds-dropdown__chevron" />
    </button>
    <ul ref={list} id={`${id}-list`} role="listbox" aria-labelledby={`${id}-btn`} className="ds-dropdown__list" hidden={!open} onKeyDown={onListKey}>
      {options.map(option => <li key={option.value || 'all'} role="option" aria-selected={option.value === value} tabIndex={-1} className="ds-dropdown__option" onClick={() => choose(option.value)}>
        <Icon name="check" size={16} className="ds-dropdown__check" />
        <span className="ds-dropdown__text">{option.label}{option.detail && <span className="ds-dropdown__detail">{option.detail}</span>}</span>
        {option.count !== undefined && <span className="ds-dropdown__count">{option.count ?? '–'}</span>}
      </li>)}
    </ul>
  </div>;
}
