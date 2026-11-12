import { CSSProperties, FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { Icon, IconName } from '../../design/Icon';
import { PageHeader, Skeleton } from '../../design/States';
import { api } from '../../shared/api';
import { Branding, ContrastCheck } from '../../shared/branding';
import { ThemePreference, useTheme } from '../../shared/theme';
import './settings.css';

const HEX = /^#[0-9A-Fa-f]{6}$/;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
type Tab = 'brand' | 'appearance';
type Notice = { tone: 'ok' | 'error'; text: string };

/** Fila de ajustes: título y explicación a la izquierda, control a la derecha (referencia marca-01). */
function Row({ title, hint, children, id }: { title: string; hint: string; children: ReactNode; id?: string }) {
  return <div className="st-row"><div className="st-row__label"><h3 id={id}>{title}</h3><p>{hint}</p></div><div className="st-row__control">{children}</div></div>;
}

/** Resultado de contraste calculado por el backend (`contrast[]`); el panel no lo recalcula. */
function ContrastResult({ check, pending }: { check?: ContrastCheck; pending: boolean }) {
  if (pending) return <p className="st-contrast" data-state="pending"><Icon name="clock" size={16} />Guarda para que el sistema verifique el contraste.</p>;
  if (!check) return null;
  const ratio = Number(check.ratio).toLocaleString('es-EC', { maximumFractionDigits: 2 });
  return <p className="st-contrast" data-state={check.passesAA ? 'ok' : 'warn'}>
    <Icon name={check.passesAA ? 'checkCircle' : 'alert'} size={16} />
    <span><b>{check.passesAA ? 'Cumple AA' : 'Contraste insuficiente'} · {ratio}:1</b><small>{check.usage}</small></span>
  </p>;
}

function ColorControl({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  const valid = HEX.test(value);
  return <div className="st-color">
    <label className="st-color__swatch" style={{ background: valid ? value : 'transparent' }}>
      <span className="ds-sr-only">{label}: selector de color</span>
      <input type="color" value={valid ? value : '#000000'} onChange={event => onChange(event.target.value.toUpperCase())} />
    </label>
    <label className="st-color__hex"><span className="ds-sr-only">{label}: código hexadecimal</span>
      <span aria-hidden="true">#</span><input id={id} className="ds-input" value={value.replace('#', '')} maxLength={6} spellCheck={false} aria-invalid={!valid}
        onChange={event => onChange(`#${event.target.value.replace(/[^0-9a-fA-F]/g, '').toUpperCase()}`)} /></label>
    {!valid && <span className="ds-field__error"><Icon name="alert" size={14} />Usa 6 dígitos hexadecimales.</span>}
  </div>;
}

/** Vista previa en miniatura del panel con los colores elegidos (aún sin guardar). */
/** `fallback`: el backend marcó el principal guardado sin AA contra blanco; las acciones usan el color por defecto, como en el panel. */
function Preview({ primary, secondary, logoUrl, fallback }: { primary: string; secondary: string; logoUrl: string; fallback: boolean }) {
  return <div className="st-preview" aria-hidden="true" style={{ '--p': primary, '--s': secondary, '--action': fallback ? '#0a3165' : primary } as CSSProperties}>
    <div className="st-preview__side"><span className="st-preview__logo">{logoUrl ? <img src={logoUrl} alt="" /> : 'R'}</span><span className="st-preview__item is-active" /><span className="st-preview__item" /><span className="st-preview__item" /></div>
    <div className="st-preview__main"><span className="st-preview__title" /><span className="st-preview__line" /><div className="st-preview__row"><span className="st-preview__btn">Aceptar</span><span className="st-preview__link">Ver detalle</span></div>
      <div className="st-preview__bars"><span style={{ height: '40%' }} /><span style={{ height: '70%' }} /><span style={{ height: '55%' }} /><span style={{ height: '90%' }} /></div></div>
  </div>;
}

function BrandTab({ auth, branding, logoUrl, onChanged, say }: { auth: string; branding?: Branding; logoUrl: string; onChanged: () => Promise<void>; say: (notice: Notice) => void }) {
  const [primary, setPrimary] = useState(''); const [secondary, setSecondary] = useState(''); const [saving, setSaving] = useState(false); const [removing, setRemoving] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (branding) { setPrimary(branding.primaryColor); setSecondary(branding.secondaryColor); } }, [branding]);
  useEffect(() => { if (removing) { if (!dialog.current?.open) dialog.current?.showModal(); } else dialog.current?.close(); }, [removing]);
  if (!branding) return <div className="st-loading"><Skeleton height={64} radius="var(--radius-md)" /><Skeleton height={64} radius="var(--radius-md)" /><Skeleton height={140} radius="var(--radius-lg)" /></div>;

  const primaryDirty = primary.toUpperCase() !== branding.primaryColor.toUpperCase(); const secondaryDirty = secondary.toUpperCase() !== branding.secondaryColor.toUpperCase();
  const dirty = primaryDirty || secondaryDirty; const valid = HEX.test(primary) && HEX.test(secondary);
  const checkFor = (color: string) => branding.contrast.find(check => check.color.toUpperCase() === color.toUpperCase());

  async function run(action: () => Promise<unknown>, success: string) {
    setSaving(true);
    try { await action(); await onChanged(); say({ tone: 'ok', text: success }); return true; }
    catch (caught) { say({ tone: 'error', text: caught instanceof Error ? caught.message : 'No se pudo guardar la marca.' }); return false; }
    finally { setSaving(false); }
  }
  function save(event: FormEvent) {
    event.preventDefault(); if (!valid) return;
    void run(() => api('/admin/branding', auth, { method: 'PUT', body: JSON.stringify({ primaryColor: primary, secondaryColor: secondary }) }), 'Colores guardados y aplicados al panel. El contraste se volvió a calcular.');
  }
  function upload(file?: File) {
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type) || file.size > 2 * 1024 * 1024) { say({ tone: 'error', text: 'El logo debe ser PNG, JPEG o WebP y pesar como máximo 2 MB.' }); return; }
    const form = new FormData(); form.append('file', file);
    void run(() => api('/admin/branding/logo', auth, { method: 'POST', body: form }), 'Logo actualizado.');
  }

  return <>
    <form className="st-section" onSubmit={save} aria-labelledby="st-colors">
      <h2 id="st-colors" className="ds-eyebrow">Colores</h2>
      <Row title="Color principal" hint="Botones principales, elemento activo del menú y acentos de marca." id="st-primary">
        <ColorControl id="brand-primary" label="Color principal" value={primary} onChange={setPrimary} />
        <ContrastResult check={checkFor(branding.primaryColor)} pending={primaryDirty} />
      </Row>
      <Row title="Color secundario" hint="Acciones secundarias, enlaces y acentos." id="st-secondary">
        <ColorControl id="brand-secondary" label="Color secundario" value={secondary} onChange={setSecondary} />
        <ContrastResult check={checkFor(branding.secondaryColor)} pending={secondaryDirty} />
      </Row>
      <Row title="Vista previa" hint="Así se verá el panel con los colores elegidos. Si el principal no tiene contraste suficiente con el texto blanco, los botones usarán el color por defecto.">
        <Preview primary={HEX.test(primary) ? primary : branding.primaryColor} secondary={HEX.test(secondary) ? secondary : branding.secondaryColor} logoUrl={logoUrl} fallback={!primaryDirty && checkFor(branding.primaryColor)?.passesAA === false} />
      </Row>
      {branding.contrast.some(check => !check.passesAA) && !dirty && <p className="st-warning"><Icon name="alert" size={18} />Algún color guardado no alcanza 4,5:1 contra el texto blanco. Puedes mantenerlo, pero se recomienda un tono más oscuro.</p>}
      <div className="st-actions">
        <button type="button" className="ds-btn ds-btn--secondary" disabled={!dirty || saving} onClick={() => { setPrimary(branding.primaryColor); setSecondary(branding.secondaryColor); }}>Descartar cambios</button>
        <button type="submit" className="ds-btn ds-btn--primary" disabled={!dirty || !valid || saving}>{saving ? 'Guardando…' : 'Guardar colores'}</button>
      </div>
    </form>

    <section className="st-section" aria-labelledby="st-logo">
      <h2 id="st-logo" className="ds-eyebrow">Logo</h2>
      <Row title="Logo o foto del local" hint="Aparece en el menú lateral y en la barra superior del móvil. PNG, JPEG o WebP de hasta 2 MB; el servidor valida el contenido real del archivo y lo guarda como WebP.">
        <div className="st-logo">
          <span className="st-logo__preview">{logoUrl ? <img src={logoUrl} alt="Logo actual del restaurante" /> : <span className="st-logo__empty"><Icon name="image" size={28} />Sin logo</span>}</span>
          <div className="st-logo__actions">
            <label className={`ds-btn ds-btn--secondary st-upload ${saving ? 'is-disabled' : ''}`}><Icon name="plus" size={18} />{branding.hasLogo ? 'Reemplazar logo' : 'Subir logo'}
              <input type="file" accept="image/png,image/jpeg,image/webp" disabled={saving} onChange={event => { upload(event.target.files?.[0]); event.target.value = ''; }} /></label>
            {branding.hasLogo && <button type="button" className="ds-btn ds-btn--ghost st-remove" disabled={saving} onClick={() => setRemoving(true)}><Icon name="trash" size={18} />Quitar logo</button>}
            {!branding.hasLogo && <p className="st-hint">Sin logo se usa el de la tesis.</p>}
          </div>
        </div>
      </Row>
    </section>
    {branding.updatedAt && <p className="st-hint">Última actualización: {new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(branding.updatedAt))} · Cada cambio queda en la auditoría.</p>}

    <dialog ref={dialog} className="ds-modal" aria-labelledby="st-remove-title" onCancel={event => { event.preventDefault(); if (!saving) setRemoving(false); }}>
      {removing && <><div className="ds-modal__body"><h2 id="st-remove-title" style={{ fontSize: 'var(--text-xl)' }}>¿Quitar el logo?</h2><p className="ds-muted" style={{ margin: 0 }}>El panel volverá a mostrar el logo de la tesis. Puedes subir otro cuando quieras.</p></div>
        <div className="ds-modal__actions"><button type="button" className="ds-btn ds-btn--secondary" disabled={saving} onClick={() => setRemoving(false)}>Volver</button>
          <button type="button" className="ds-btn ds-btn--danger" disabled={saving} onClick={() => void run(() => api('/admin/branding/logo', auth, { method: 'DELETE' }), 'Logo eliminado.').then(() => setRemoving(false))}>Quitar logo</button></div></>}
    </dialog>
  </>;
}

const THEMES: Array<{ id: ThemePreference; title: string; text: string; icon: IconName }> = [
  { id: 'light', title: 'Claro', text: 'Fondo claro, ideal para caja y oficina.', icon: 'sun' },
  { id: 'dark', title: 'Oscuro', text: 'Menos brillo; por defecto en Cocina.', icon: 'moon' },
];

function AppearanceTab() {
  const { preference, setPreference } = useTheme();
  return <section className="st-section" aria-labelledby="st-theme">
    <h2 id="st-theme" className="ds-eyebrow">Tema</h2>
    <Row title="Tema del panel" hint="Se guarda solo para tu usuario en este navegador. También puedes cambiarlo desde el menú lateral.">
      <div className="st-themes" role="radiogroup" aria-label="Tema del panel">
        {THEMES.map(theme => <button key={theme.id} type="button" role="radio" aria-checked={preference === theme.id} className="st-theme" data-theme-card={theme.id} onClick={() => setPreference(theme.id)}>
          <span className="st-theme__art" aria-hidden="true"><span /><span /><span /></span>
          <span className="st-theme__text"><b><Icon name={theme.icon} size={16} />{theme.title}</b><small>{theme.text}</small></span>
          {preference === theme.id && <span className="st-theme__check" aria-hidden="true"><Icon name="check" size={16} /></span>}
        </button>)}
      </div>
    </Row>
  </section>;
}

export function SettingsPage({ auth, branding, logoUrl, onBrandingChanged }: { auth: string; branding?: Branding; logoUrl: string; onBrandingChanged: () => Promise<void> }) {
  const [tab, setTab] = useState<Tab>('brand'); const [notice, setNotice] = useState<Notice>();
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(undefined), 6000); return () => clearTimeout(timer); }, [notice]);
  return <section className="st">
    <PageHeader title="Configuración" subtitle="Ajustes del restaurante. Solo administración puede modificarlos." />
    <div className="ds-tabs st-tabs" role="tablist" aria-label="Secciones de configuración">
      <button type="button" role="tab" id="st-tab-brand" aria-controls="st-panel" className="ds-tab" aria-selected={tab === 'brand'} onClick={() => setTab('brand')}>Marca</button>
      <button type="button" role="tab" id="st-tab-appearance" aria-controls="st-panel" className="ds-tab" aria-selected={tab === 'appearance'} onClick={() => setTab('appearance')}>Apariencia</button>
    </div>
    {notice && <p className="orders-notice st-notice" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}><Icon name={notice.tone === 'ok' ? 'checkCircle' : 'alert'} size={18} />{notice.text}</p>}
    <div id="st-panel" role="tabpanel" aria-labelledby={`st-tab-${tab}`} className="ds-card st-panel">
      {tab === 'brand' ? <BrandTab auth={auth} branding={branding} logoUrl={logoUrl} onChanged={onBrandingChanged} say={setNotice} /> : <AppearanceTab />}
    </div>
  </section>;
}
