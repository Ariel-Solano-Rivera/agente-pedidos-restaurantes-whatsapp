import { Icon } from './Icon';

export type FilterOption = { value: string; label: string; count?: number | null; detail?: string };

/**
 * Grupo de filtros como botones (sin menús desplegables): selección única con `aria-pressed`,
 * marca de verificación y contador por opción. La opción con valor '' representa «Todos».
 */
export function FilterGroup({ legend, options, value, onChange, loading = false }: {
  legend: string; options: FilterOption[]; value: string; onChange: (value: string) => void; loading?: boolean;
}) {
  return <fieldset className="ds-filter-group" aria-busy={loading}>
    <legend className="ds-eyebrow">{legend}</legend>
    {options.map(option => {
      const pressed = value === option.value;
      return <button key={option.value || 'all'} type="button" className="ds-chip" aria-pressed={pressed} onClick={() => onChange(option.value)}>
        <Icon name="check" size={16} className="ds-chip__check" />
        {option.label}{option.detail && <span className="ds-chip__detail">{option.detail}</span>}
        {option.count !== undefined && <span className="ds-chip__count" aria-label={option.count === null ? 'sin dato' : `${option.count} pedidos`}>{option.count ?? '–'}</span>}
      </button>;
    })}
  </fieldset>;
}
