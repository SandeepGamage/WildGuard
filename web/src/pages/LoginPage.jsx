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

/** Sign in: Park Manager (UC4) or Operations Officer (UC2). */
export default function LoginPage() {
  const { t } = useTranslation();
  const { status, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedRole, setSelectedRole] = useState('PARK_MANAGER');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const target = location.state?.from ?? ROUTES.reports;

  if (status === AUTH_STATUS.SIGNED_IN) return <Navigate to={target} replace />;

  const submit = async (event) => {
    event.preventDefault();
    if (selectedRole === 'OPERATIONS_OFFICER') {
      if (!account.trim() || !password) {
        setError('Please enter your Officer Email / ID and Password to sign in.');
        return;
      }
      window.location.href = '/operations.html';
      return;
    }
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

  const handleRoleChange = (role) => {
    setSelectedRole(role);
    setError(null);
    setAccount('');
    setPassword('');
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
          <p className="login-headline">
            {selectedRole === 'OPERATIONS_OFFICER'
              ? 'Real-time Collar Hazards & Emergency Control.'
              : t('login.headline')}
          </p>
          <p className="login-lead">
            {selectedRole === 'OPERATIONS_OFFICER'
              ? 'Control room monitoring for GPS elephant collar breaches, automated villager warnings, nearest responder dispatch, and camera trap verification.'
              : t('login.lead')}
          </p>
          <ul className="login-features">
            {selectedRole === 'OPERATIONS_OFFICER' ? (
              <>
                <li>
                  <span className="login-feature-icon">🚨</span>
                  Virtual Geofence Boundary Breach Alarm System
                </li>
                <li>
                  <span className="login-feature-icon">📲</span>
                  Automated Early-Warning SMS to Surrounding Villages
                </li>
                <li>
                  <span className="login-feature-icon">🚓</span>
                  Nearest Field Responder Auto-Dispatch &amp; Escalation
                </li>
              </>
            ) : (
              FEATURES.map(({ key, Icon }) => (
                <li key={key}>
                  <span className="login-feature-icon">
                    <Icon />
                  </span>
                  {t(`login.features.${key}`)}
                </li>
              ))
            )}
          </ul>
        </div>
        <p className="login-hero-note">
          {selectedRole === 'OPERATIONS_OFFICER'
            ? 'Department of Wildlife Conservation • Control Room Operations Desk'
            : t('login.restricted')}
        </p>
      </section>

      <section className="login-panel">
        <div className="login-panel-top">
          <LanguageSelect />
        </div>
        <form className="login-form" onSubmit={submit} noValidate>
          {/* Role Switcher Segmented Control */}
          <div
            role="tablist"
            aria-label="Switch Profile"
            style={{
              display: 'flex',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '3px',
              marginBottom: '0.75rem',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            }}
          >
            <button
              type="button"
              role="tab"
              id="roleBtnManager"
              aria-selected={selectedRole === 'PARK_MANAGER'}
              onClick={() => handleRoleChange('PARK_MANAGER')}
              style={{
                flex: 1,
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: selectedRole === 'PARK_MANAGER' ? '500' : '400',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: selectedRole === 'PARK_MANAGER' ? '#e9ecef' : 'transparent',
                color: selectedRole === 'PARK_MANAGER' ? '#1f2937' : '#6b7280',
                transition: 'all 0.15s ease-in-out',
                textAlign: 'center',
              }}
            >
              Park Manager
            </button>
            <button
              type="button"
              role="tab"
              id="roleBtnOperations"
              aria-selected={selectedRole === 'OPERATIONS_OFFICER'}
              onClick={() => handleRoleChange('OPERATIONS_OFFICER')}
              style={{
                flex: 1,
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: selectedRole === 'OPERATIONS_OFFICER' ? '500' : '400',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: selectedRole === 'OPERATIONS_OFFICER' ? '#e9ecef' : 'transparent',
                color: selectedRole === 'OPERATIONS_OFFICER' ? '#1f2937' : '#6b7280',
                transition: 'all 0.15s ease-in-out',
                textAlign: 'center',
              }}
            >
              Operations Officer
            </button>
          </div>

          <div className="login-intro">
            <h1>{t('login.title')}</h1>
            <p className="muted">
              {selectedRole === 'OPERATIONS_OFFICER'
                ? 'Sign in to open the Real-time Wildlife Hazard & Collar Alert Operations Console.'
                : t('login.subtitle')}
            </p>
          </div>

          <label className="field">
            <span className="field-label">
              {selectedRole === 'OPERATIONS_OFFICER' ? 'Officer Email / ID' : t('login.account')}
            </span>
            <input
              type="email"
              autoComplete="username"
              placeholder=""
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
              placeholder=""
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
            {busy
              ? t('common.loading')
              : selectedRole === 'OPERATIONS_OFFICER' ? 'Open Operations Control Room →' : t('login.submit')}
          </button>

          <p className="login-help muted">
            {selectedRole === 'OPERATIONS_OFFICER'
              ? 'Authorized DWC control room operators only.'
              : t('login.help')}
          </p>
        </form>
        <p className="login-footer">{t('login.footer')}</p>
      </section>
    </main>
  );
}
