import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../shared/api';
import { Branding } from '../../shared/branding';

const HEX = /^#[0-9A-Fa-f]{6}$/;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function ColorField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  const valid = HEX.test(value);
  return <div className="color-field"><label htmlFor={id}>{label}</label><div>
    <input type="color" aria-label={`${label}: selector`} value={valid ? value : '#000000'} onChange={event => onChange(event.target.value.toUpperCase())} />
    <input id={id} value={value} maxLength={7} spellCheck={false} aria-invalid={!valid} onChange={event => onChange(event.target.value.trim())} placeholder="#RRGGBB" />
  </div>{!valid && <small className="error">Usa el formato hexadecimal #RRGGBB.</small>}</div>;
}

function BrandTab({ auth, branding, logoUrl, onChanged }: { auth: string; branding?: Branding; logoUrl: string; onChanged: () => Promise<void> }) {
  const [primary, setPrimary] = useState(''); const [secondary, setSecondary] = useState('');
  const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  useEffect(() => { if (branding) { setPrimary(branding.primaryColor); setSecondary(branding.secondaryColor); } }, [branding]);
  if (!branding) return <p className="empty-state">Cargando marca…</p>;
  const dirty = primary.toUpperCase() !== branding.primaryColor || secondary.toUpperCase() !== branding.secondaryColor;
  const valid = HEX.test(primary) && HEX.test(secondary);

  async function run(action: () => Promise<unknown>, success: string) {
    setSaving(true); setError(''); setNotice('');
    try { await action(); await onChanged(); setNotice(success); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo guardar la marca.'); }
    finally { setSaving(false); }
  }
  function save(event: FormEvent) {
    event.preventDefault();
    if (!valid) { setError('Revisa el formato de los colores.'); return; }
    void run(() => api('/admin/branding', auth, { method: 'PUT', body: JSON.stringify({ primaryColor: primary, secondaryColor: secondary }) }), 'Colores guardados y aplicados al panel.');
  }
  function upload(file?: File) {
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type) || file.size > 2 * 1024 * 1024) { setError('El logo debe ser PNG, JPEG o WebP y pesar máximo 2 MB.'); return; }
    const form = new FormData(); form.append('file', file);
    void run(() => api('/admin/branding/logo', auth, { method: 'POST', body: form }), 'Logo actualizado.');
  }

  return <div className="brand-settings">
    <form className="menu-form brand-form" onSubmit={save}>
      <h2>Colores</h2>
      <p className="hint">El color principal se usa en botones y en la barra lateral; el secundario, en acciones, acentos y gráficos.</p>
      <div className="form-grid"><ColorField id="brand-primary" label="Color principal" value={primary} onChange={setPrimary} /><ColorField id="brand-secondary" label="Color secundario" value={secondary} onChange={setSecondary} /></div>
      <div className="brand-preview" aria-label="Vista previa" style={{ ['--preview-primary' as string]: valid ? primary : branding.primaryColor, ['--preview-secondary' as string]: valid ? secondary : branding.secondaryColor }}>
        <span className="preview-primary">Botón principal</span><span className="preview-secondary">Acción secundaria</span><span className="preview-text">Texto con color secundario</span>
      </div>
      <section className="contrast-report" aria-live="polite"><h3>Contraste (WCAG AA, mínimo 4,5:1) de los colores guardados</h3>
        <ul>{branding.contrast.map(check => <li key={check.usage} className={check.passesAA ? 'ok' : 'warn'}>
          <span aria-hidden="true">{check.passesAA ? '✓' : '⚠'}</span><div><b>{check.passesAA ? 'Cumple' : 'Contraste insuficiente'}: {Number(check.ratio).toLocaleString('es-EC')}:1</b><small>{check.usage} · {check.color} contra {check.against}</small></div>
        </li>)}</ul>
        {branding.contrast.some(check => !check.passesAA) && <p className="warning">Algunos textos pueden ser difíciles de leer. Puedes guardar igual, pero se recomienda un color más oscuro.</p>}
        {dirty && <p className="hint">Guarda para recalcular el contraste con los colores nuevos.</p>}
      </section>
      {error && <p className="error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
      <div className="dialog-actions"><button type="button" className="secondary" disabled={!dirty || saving} onClick={() => { setPrimary(branding.primaryColor); setSecondary(branding.secondaryColor); }}>Descartar cambios</button><button type="submit" disabled={!dirty || !valid || saving}>{saving ? 'Guardando…' : 'Guardar colores'}</button></div>
    </form>
    <section className="menu-form brand-logo">
      <h2>Logo o foto del local</h2>
      <div className="brand-logo-preview">{logoUrl ? <img src={logoUrl} alt="Logo actual del restaurante" /> : <span>Sin logo: se usa el logo de la tesis.</span>}</div>
      <label className="photo-picker"><span><b>{branding.hasLogo ? 'Reemplazar logo' : 'Subir logo'}</b><small>PNG, JPEG o WebP · máximo 2 MB · el servidor valida el contenido real</small></span>
        <input type="file" accept="image/png,image/jpeg,image/webp" disabled={saving} onChange={event => { upload(event.target.files?.[0]); event.target.value = ''; }} /></label>
      {branding.hasLogo && <button type="button" className="order-action destructive" disabled={saving} onClick={() => { if (window.confirm('¿Quitar el logo del restaurante?')) void run(() => api('/admin/branding/logo', auth, { method: 'DELETE' }), 'Logo eliminado.'); }}>Quitar logo</button>}
    </section>
  </div>;
}

export function SettingsPage({ auth, branding, logoUrl, onBrandingChanged }: { auth: string; branding?: Branding; logoUrl: string; onBrandingChanged: () => Promise<void> }) {
  return <section className="page-content settings-page">
    <header className="page-heading"><div><h1>Configuración</h1><p>Ajustes del restaurante. Solo administración puede modificarlos.</p></div></header>
    <div className="segmented settings-tabs" role="tablist" aria-label="Secciones de configuración"><button type="button" role="tab" aria-selected="true" className="active">Marca</button></div>
    <BrandTab auth={auth} branding={branding} logoUrl={logoUrl} onChanged={onBrandingChanged} />
  </section>;
}
