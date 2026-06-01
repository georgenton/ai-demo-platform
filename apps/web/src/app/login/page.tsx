// -----------------------------------------------------------------------------
// /login — página de inicio de sesión.
//
// STUB FUNCIONAL (PR-MT4):
//   Esta UI es deliberadamente minimal y usa solo tokens del ui-kit.css y los
//   strings i18n. Es 100% funcional end-to-end (login real contra el backend,
//   redirect a la ruta original via ?from=...), pero el polishing visual
//   (background art, branding, animaciones) lo hacés vos en Claude Design en
//   un PR siguiente — el contrato (form, useAuth, redirect) ya está fijo.
//
// Flujo:
//   1) El middleware (apps/web/src/middleware.ts) redirige a /login con
//      ?from=<ruta original> cuando la cookie auth no está presente.
//   2) El usuario completa email + password y submitea.
//   3) Llamamos useAuth().login() → backend setea la cookie httpOnly.
//   4) En éxito, navegamos al ?from o a / por default.
//   5) En error, mostramos el mensaje según el tipo:
//        - 401 → "Credenciales inválidas"
//        - red/5xx → "No se pudo contactar al servidor"
// -----------------------------------------------------------------------------

'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import type { StringKey } from '@/lib/i18n/strings';

/**
 * `useSearchParams` requiere Suspense boundary cuando se usa en una página
 * pre-renderizada. Wrappeamos el form con uno mínimo para satisfacer el req.
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

      // Redirect al destino original o a /. El middleware vuelve a evaluar
      // sobre la nueva URL y deja pasar porque la cookie ya está seteada.
      const from = searchParams.get('from');
      const safeFrom =
        from && from.startsWith('/') && !from.startsWith('//') ? from : '/';
      router.replace(safeFrom);
    } catch (err) {
      // Diferenciamos 401 (credenciales) de network/5xx (servidor caído)
      // porque el copy le dice al usuario qué hacer distinto en cada caso.
      if (err instanceof ApiError && err.status === 401) {
        setErrorKey('auth.login.error.invalid');
      } else {
        setErrorKey('auth.login.error.network');
      }
      setSubmitting(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--surface-bg, #0c1418)',
        padding: 'var(--spacing-4, 16px)',
      }}
    >
      <form
        onSubmit={handleSubmit}
        // Stub minimal: card centrada, tokens del ui-kit. El polishing va a Claude Design.
        style={{
          width: '100%',
          maxWidth: 380,
          background: 'var(--surface-card, #131e23)',
          border: '1px solid var(--border-default, #1f2c33)',
          borderRadius: 'var(--radius-lg, 12px)',
          padding: 'var(--spacing-6, 24px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-4, 16px)',
        }}
      >
        <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1
            style={{
              fontSize: 'var(--font-size-xl, 20px)',
              fontWeight: 600,
              color: 'var(--text-strong, #f0f5f8)',
              margin: 0,
            }}
          >
            {t('auth.login.title')}
          </h1>
          <p
            style={{
              fontSize: 'var(--font-size-sm, 13px)',
              color: 'var(--text-muted, #87969f)',
              margin: 0,
            }}
          >
            {t('auth.login.subtitle')}
          </p>
        </header>

        <label
          style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
          htmlFor="login-email"
        >
          <span
            style={{
              fontSize: 'var(--font-size-sm, 13px)',
              color: 'var(--text-default, #c5d1d8)',
            }}
          >
            {t('auth.login.email')}
          </span>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.login.emailPlaceholder')}
            required
            autoComplete="email"
            autoFocus
            disabled={submitting}
            style={inputStyle}
          />
        </label>

        <label
          style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
          htmlFor="login-password"
        >
          <span
            style={{
              fontSize: 'var(--font-size-sm, 13px)',
              color: 'var(--text-default, #c5d1d8)',
            }}
          >
            {t('auth.login.password')}
          </span>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('auth.login.passwordPlaceholder')}
            required
            autoComplete="current-password"
            disabled={submitting}
            style={inputStyle}
          />
        </label>

        {errorKey && (
          <div
            role="alert"
            style={{
              fontSize: 'var(--font-size-sm, 13px)',
              color: 'var(--text-danger, #ff6b7a)',
            }}
          >
            {t(errorKey)}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !email || !password}
          style={{
            marginTop: 'var(--spacing-2, 8px)',
            padding: '10px 16px',
            borderRadius: 'var(--radius-md, 8px)',
            border: 'none',
            background: 'var(--accent-default, #43c194)',
            color: '#0c1418',
            fontWeight: 600,
            fontSize: 'var(--font-size-sm, 13px)',
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting || !email || !password ? 0.6 : 1,
          }}
        >
          {submitting ? t('auth.login.submitting') : t('auth.login.submit')}
        </button>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 'var(--radius-md, 8px)',
  border: '1px solid var(--border-default, #1f2c33)',
  background: 'var(--surface-input, #0c1418)',
  color: 'var(--text-strong, #f0f5f8)',
  fontSize: 'var(--font-size-sm, 13px)',
  fontFamily: 'inherit',
  outline: 'none',
};
