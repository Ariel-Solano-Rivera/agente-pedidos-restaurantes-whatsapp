import { FormEvent, useRef, useState } from 'react';
import { Icon, IconName } from '../../design/Icon';
import { api, User } from '../../shared/api';
import './login.css';

/** Cuentas ficticias de la guía de ejecución (docs/guia-ejecucion.md); solo para la demostración local. */
const DEMO_ACCOUNTS = [
  { email: 'admin@marazul.test', role: 'Administración', place: 'Mar Azul' },
  { email: 'caja@marazul.test', role: 'Caja', place: 'Mar Azul' },
  { email: 'cocina@marazul.test', role: 'Cocina', place: 'Mar Azul' },
  { email: 'admin@sierraverde.test', role: 'Administración', place: 'Sierra Verde' },
];
const DEMO_PASSWORD = 'password';
const FEATURES: Array<{ icon: IconName; text: string }> = [
  { icon: 'receipt', text: 'Pedidos de WhatsApp con estados y acciones según tu rol.' },
  { icon: 'flame', text: 'Tablero de cocina para avanzar pedidos con un toque.' },
  { icon: 'chat', text: 'Conversaciones derivadas a una persona cuando hace falta.' },
];

export function LoginPage({ onLogin }: { onLogin: (auth: string, user: User) => void }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [show, setShow] = useState(false);
  const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) { setError('Ingresa tu usuario o correo y tu contraseña para continuar.'); return; }
    setError(''); setSubmitting(true);
    try { const auth = btoa(`${email.trim()}:${password}`); onLogin(auth, await api<User>('/me', auth)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo iniciar sesión.'); }
    finally { setSubmitting(false); }
  }
  function fillDemo(account: string) { setEmail(account); setPassword(DEMO_PASSWORD); setError(''); submitRef.current?.focus(); }

  return <main className="lg ds-root">
    <section className="lg-brand" aria-label="Plataforma de la tesis">
      <div className="lg-brand__top"><img src="/tesis-logo.png" alt="" /><span>Panel del restaurante</span></div>
      <div className="lg-brand__body">
        <h2>Pedidos por WhatsApp, cocina y caja en un solo lugar.</h2>
        <ul>{FEATURES.map(item => <li key={item.text}><span aria-hidden="true"><Icon name={item.icon} size={18} /></span>{item.text}</li>)}</ul>
      </div>
      <p className="lg-brand__foot"><Icon name="alert" size={16} />Entorno de demostración con datos ficticios.</p>
    </section>

    <section className="lg-panel">
      <div className="lg-card">
        <header><h1>Inicia sesión</h1><p>Accede al panel administrativo de tu restaurante.</p></header>
        <form onSubmit={event => void submit(event)} noValidate>
          <label className="ds-field" htmlFor="login-identity"><span className="ds-field__label">Usuario o correo</span>
            <input id="login-identity" className="ds-input" name="username" autoComplete="username" placeholder="nombre@restaurante.test" value={email} onChange={event => setEmail(event.target.value)}
              aria-invalid={Boolean(error)} aria-describedby={error ? 'login-error' : undefined} disabled={submitting} /></label>
          <div className="ds-field">
            <label className="ds-field__label" htmlFor="login-password">Contraseña</label>
            <div className="lg-password">
              <input id="login-password" className="ds-input" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)}
                aria-invalid={Boolean(error)} aria-describedby={error ? 'login-error' : undefined} disabled={submitting} />
              <button type="button" className="ds-icon-btn lg-password__toggle" aria-pressed={show} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} title={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShow(value => !value)}>
                <Icon name={show ? 'eyeOff' : 'eye'} size={18} /></button>
            </div>
          </div>
          {error && <p id="login-error" className="lg-error" role="alert"><Icon name="alert" size={18} />{error}</p>}
          <button ref={submitRef} type="submit" className="ds-btn ds-btn--primary ds-btn--lg lg-submit" disabled={submitting}>{submitting ? 'Ingresando…' : 'Iniciar sesión'}{!submitting && <Icon name="arrowRight" size={18} />}</button>
        </form>

        <section className="lg-demo" aria-labelledby="lg-demo-title">
          <h2 id="lg-demo-title" className="ds-eyebrow">Cuentas de demostración</h2>
          <p>Elige una para rellenar el formulario (contraseña <code>{DEMO_PASSWORD}</code>).</p>
          <ul>{DEMO_ACCOUNTS.map(account => <li key={account.email}>
            <button type="button" className="lg-demo__item" aria-pressed={email === account.email} onClick={() => fillDemo(account.email)}>
              <span className="lg-demo__avatar" aria-hidden="true">{account.role.slice(0, 1)}</span>
              <span className="lg-demo__text"><b>{account.role}</b><small>{account.email} · {account.place}</small></span>
              {email === account.email && <Icon name="check" size={16} className="lg-demo__check" />}
            </button>
          </li>)}</ul>
        </section>
      </div>
    </section>
  </main>;
}
