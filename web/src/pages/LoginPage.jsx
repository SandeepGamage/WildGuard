import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AUTH_STATUS, useAuth } from '../auth/AuthContext';
import { ClipboardIcon, PinIcon, TrendIcon } from '../components/Icons';
import { LanguageSelect } from '../components/LanguageSelect';
import { ROUTES } from '../constants';
import { friendlyError } from '../utils/errors';

const FEATURES = [
  { key: 'reports', Icon: ClipboardIcon },
  { key: 'hotspots', Icon: PinIcon },
  { key: 'trends', Icon: TrendIcon },
];

/** Park Manager sign in (email + password; accounts are created by the DWC administrator). */
export default function LoginPage() {
  const { t } = useTranslation();
  const { status, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const target = location.state?.from ?? ROUTES.reports;

  if (status === AUTH_STATUS.SIGNED_IN) return <Navigate to={target} replace />;

  const submit = async (event) => {
    event.preventDefault();
    if (!account.trim() || !password) {
      setError(t('login.required'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(account.trim(), password);
      navigate(target, { replace: true });
    } catch (err) {
      setError(friendlyError(err, t));
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <section className="login-hero">
        <svg className="login-trail" viewBox="0 0 600 900" preserveAspectRatio="none" aria-hidden="true">
          <path d="M440 0 C520 180 520 300 380 420 S120 640 140 900" />
        </svg>
        <div className="login-brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>{t('common.appName')}</span>
        </div>
        <div className="login-pitch">
          <p className="login-headline">{t('login.headline')}</p>
          <p className="login-lead">{t('login.lead')}</p>
          <ul className="login-features">
            {FEATURES.map(({ key, Icon }) => (
              <li key={key}>
                <span className="login-feature-icon">
                  <Icon />
                </span>
                {t(`login.features.${key}`)}
              </li>
            ))}
          </ul>
        </div>
        <p className="login-hero-note">{t('login.restricted')}</p>
      </section>

      <section className="login-panel">
        <div className="login-panel-top">
          <LanguageSelect />
        </div>
        <form className="login-form" onSubmit={submit} noValidate>
          <div className="login-intro">
            <h1>{t('login.title')}</h1>
            <p className="muted">{t('login.subtitle')}</p>
          </div>

          <label className="field">
            <span className="field-label">{t('login.account')}</span>
            <input
              type="email"
              autoComplete="username"
              placeholder={t('login.accountPlaceholder')}
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              aria-invalid={Boolean(error)}
            />
          </label>
          <label className="field">
            <span className="field-label">{t('login.password')}</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(error)}
            />
          </label>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? t('common.loading') : t('login.submit')}
          </button>

          <p className="login-help muted">{t('login.help')}</p>
        </form>
        <p className="login-footer">{t('login.footer')}</p>
      </section>
    </main>
  );
}
