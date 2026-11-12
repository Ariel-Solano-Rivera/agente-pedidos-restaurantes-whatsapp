import { ReactNode } from 'react';

type Illustration = 'empty' | 'error' | 'done';

/** Ilustraciones de línea de un solo color (heredan `color`); ligeras y propias, sin imágenes externas. */
const drawings: Record<Illustration, ReactNode> = {
  empty: <>
    <path d="M14 96h132" /><path d="M40 96V54h80v42" /><path d="M34 54h92" />
    <path d="M60 54c0-12 9-22 20-22s20 10 20 22" /><path d="M80 32v-6" /><circle cx="80" cy="23" r="3" />
    <path d="M58 70h44M58 80h28" /><path d="m128 30 4-4M134 40h6M124 20v-6" />
  </>,
  error: <>
    <path d="M14 96h132" /><path d="M48 96V40h64v56" /><path d="M48 52h64" />
    <circle cx="80" cy="74" r="12" /><path d="M80 67v8M80 80v.01" /><path d="m28 34 6 6M34 34l-6 6M128 24l6 6M134 24l-6 6" />
  </>,
  done: <>
    <path d="M14 96h132" /><circle cx="80" cy="56" r="26" /><path d="m68 56 8 8 16-16" />
    <path d="m34 30 4-4M126 30l-4-4M30 60h-8M138 60h-8" />
  </>,
};

export function EmptyState({ title, description, action, illustration = 'empty', compact = false }: {
  title: string; description: string; action?: ReactNode; illustration?: Illustration; compact?: boolean;
}) {
  return <div className={compact ? 'ds-empty ds-empty--compact' : 'ds-empty'} role={illustration === 'error' ? 'alert' : undefined}>
    <svg viewBox="0 0 160 110" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{drawings[illustration]}</svg>
    <h3>{title}</h3>
    <p>{description}</p>
    {action}
  </div>;
}

export function Skeleton({ width = '100%', height = 14, radius }: { width?: string | number; height?: number; radius?: string }) {
  return <span className="ds-skeleton" aria-hidden="true" style={{ width, height, borderRadius: radius }} />;
}

export function PageHeader({ title, subtitle, aside }: { title: string; subtitle?: ReactNode; aside?: ReactNode }) {
  return <header className="ds-page-header">
    <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
    {aside && <div className="ds-page-header__aside">{aside}</div>}
  </header>;
}
