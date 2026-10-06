import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ROUTES } from '../constants';
import { formatDate, toIsoDate } from '../utils/analytics';
import { LogoutIcon } from './Icons';
import { LanguageSelect } from './LanguageSelect';

const initials = (name = '') =>
  name
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

/**
 * Dashboard frame: a full-height sidebar (product, the analytics pages, a data note,
 * sign out) and a light top bar (today, language, the signed-in manager).
 * The page itself renders as `children`.
 */
export function AppShell({ children }) {
  const { t, i18n } = useTranslation();
  const { profile, signOut } = useAuth();
  const link = ({ isActive }) => `side-link${isActive ? ' active' : ''}`;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>
            <span className="brand">{t('common.appName')}</span>
            <span className="brand-sub">{t('shell.tagline')}</span>
          </span>
        </div>

        <nav className="sidebar-nav" aria-label={t('shell.mainNav')}>
          <p className="side-section">{t('shell.analytics')}</p>
          <NavLink to={ROUTES.reports} end className={link}>
            {t('tabs.reports')}
          </NavLink>
          <NavLink to={ROUTES.saved} className={link}>
            {t('tabs.savedReports')}
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-note">
            <strong>{t('shell.noteTitle')}</strong>
            <span>{t('shell.noteBody')}</span>
          </div>
          <button type="button" className="sidebar-signout" onClick={signOut}>
            <LogoutIcon size={16} />
            <span>{t('analytics.signOut')}</span>
          </button>
        </div>
      </aside>

      <div className="shell-body">
        <header className="topbar">
          <span className="topbar-date">{formatDate(toIsoDate(new Date()), i18n.language)}</span>
          <div className="topbar-user">
            <LanguageSelect />
            <span className="avatar" aria-hidden="true">
              {initials(profile?.fullName)}
            </span>
            <span className="topbar-name">
              <span className="strong">{profile?.fullName}</span>
              <span className="topbar-role">{t('shell.role')}</span>
            </span>
          </div>
        </header>
        <div className="shell-main">{children}</div>
      </div>
    </div>
  );
}
