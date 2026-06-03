// -----------------------------------------------------------------------------
// /login — página de inicio de sesión.
//
// Implementación final basada en el mockup 01-login.html del paquete
// multitenant_refinement de Claude Design. Estructura split-screen:
//
//   ┌──────────────────┬───────────────────┐
//   │  Panel de marca  │  Formulario       │
//   │  (navy + glow)   │  (form + footer)  │
//   └──────────────────┴───────────────────┘
//
// El panel de marca colapsa a mobile (< 880px) y solo queda el form.
//
// Contratos (NO romper):
//   1. <Suspense> wrapper porque usamos useSearchParams (Next 16).
//   2. await auth.login({ email, password }).
//   3. En éxito, router.replace(searchParams.get('from') || '/').
//   4. Validación del 'from': debe empezar con '/' y NO con '//' (anti
//      open-redirect).
//   5. ApiError 401 → t('auth.login.error.invalid').
//      Cualquier otro error → t('auth.login.error.network').
// -----------------------------------------------------------------------------

'use client';

import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { Icon } from '@/components/ui';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import type { StringKey } from '@/lib/i18n/strings';

/**
 * `useSearchParams` requiere Suspense boundary cuando la página es
 * pre-renderizada estática (Next 16). Wrapper mínimo que delega al form.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { t } = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<StringKey | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorKey(null);

    try {
      await auth.login({ email, password });

      // Anti open-redirect: el 'from' tiene que ser un path relativo seguro.
      // Cualquier otra cosa (URLs absolutas, protocolos exóticos, // → host
      // relativo) cae al fallback '/'.
      const from = searchParams.get('from');
      const safeFrom =
        from && from.startsWith('/') && !from.startsWith('//') ? from : '/';
      router.replace(safeFrom);
    } catch (err) {
      // Distinguimos 401 (credenciales) de network/5xx (servidor caído)
      // porque el copy le dice al usuario qué hacer en cada caso.
      if (err instanceof ApiError && err.status === 401) {
        setErrorKey('auth.login.error.invalid');
      } else {
        setErrorKey('auth.login.error.network');
      }
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-split">
      {/* Panel de marca — primera impresión del cliente. Colapsa en mobile. */}
      <aside className="auth-brand">
        <div className="auth-brand-lockup">
          <Image
            src="/brand/logo-mark-on-dark.svg"
            width={34}
            height={34}
            alt=""
            aria-hidden
            priority
          />
          <div>
            <div className="name">AI Demo Platform</div>
            <div className="tag">Nutanix Enterprise AI</div>
          </div>
        </div>

        <div className="auth-brand-body">
          <div className="auth-brand-eyebrow">{t('auth.brand.eyebrow')}</div>
          <h2 className="auth-brand-headline">{t('auth.brand.headline')}</h2>
          <p className="auth-brand-sub">{t('auth.brand.sub')}</p>
          <ul className="auth-brand-points">
            <li>
              <Icon name="shield-check" className="ic" />
              {t('auth.brand.point.privacy')}
            </li>
            <li>
              <Icon name="building-2" className="ic" />
              {t('auth.brand.point.tenant')}
            </li>
            <li>
              <Icon name="server" className="ic" />
              {t('auth.brand.point.onprem')}
            </li>
          </ul>
        </div>
      </aside>

      {/* Lado del formulario */}
      <section className="auth-panel">
        <form className="login-form" onSubmit={handleSubmit} autoComplete="on">
          <div className="login-form-head">
            <h1>{t('auth.login.title')}</h1>
            <p>{t('auth.login.subtitle')}</p>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="login-email">
              {t('auth.login.email')}
            </label>
            <input
              id="login-email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.login.emailPlaceholder')}
              autoComplete="email"
              autoFocus
              required
              disabled={submitting}
            />
          </div>

          <div className="field">
            <div className="auth-meta">
              <label className="field-label" htmlFor="login-password">
                {t('auth.login.password')}
              </label>
              {/* "Olvidé contraseña" deshabilitado intencionalmente — el flujo
                  no está implementado todavía. Mantengo la affordance visual
                  para que el cliente la note cuando se sume. */}
              <a
                className="link-muted"
                href="#"
                aria-disabled
                tabIndex={-1}
                onClick={(e) => e.preventDefault()}
              >
                {t('auth.login.forgot')}
              </a>
            </div>
            <input
              id="login-password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.login.passwordPlaceholder')}
              autoComplete="current-password"
              required
              disabled={submitting}
            />
          </div>

          {errorKey && (
            <div className="field-error" role="alert">
              <Icon name="alert-circle" className="ic" />
              <span>{t(errorKey)}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-accent btn-lg"
            style={{ width: '100%' }}
            disabled={submitting || !email || !password}
          >
            {submitting ? t('auth.login.submitting') : t('auth.login.submit')}
          </button>

          <p className="auth-foot">
            <Icon
              name="lock"
              size={12}
              className="ic"
              style={{ verticalAlign: '-1px', marginRight: 4 }}
            />
            {t('auth.login.secured')}
          </p>
        </form>
      </section>
    </main>
  );
}
