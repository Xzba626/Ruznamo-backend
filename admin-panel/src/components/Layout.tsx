import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocale, useStrings } from '../context/LocaleContext';

const primaryNav = [
  { to: '/', labelKey: 'dashboard' as const, permission: 'dashboard:read' },
  { to: '/licenses', labelKey: 'licenses' as const, permission: 'licenses:read' },
  { to: '/devices', labelKey: 'devices' as const, permission: 'devices:read' },
  { to: '/orders', labelKey: 'orders' as const, permission: 'orders:read' },
  { to: '/analytics', labelKey: 'analytics' as const, permission: 'dashboard:read' },
  { to: '/updates', labelKey: 'updates' as const, permission: 'releases:read' },
  { to: '/plans', labelKey: 'requisites' as const, permission: 'plans:read' },
  { to: '/system', labelKey: 'system' as const },
];

export function Layout() {
  const { admin, logout, hasPermission } = useAuth();
  const { locale, setLocale } = useLocale();
  const strings = useStrings();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">{strings.brand}</div>
        <nav>
          {primaryNav
            .filter((item) => !item.permission || hasPermission(item.permission))
            .map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}>
                {strings.nav[item.labelKey]}
              </NavLink>
            ))}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-actions">
            <div className="locale-switch" role="group" aria-label="Language">
              <button
                type="button"
                className={locale === 'ru' ? 'active' : ''}
                onClick={() => setLocale('ru')}
              >
                RU
              </button>
              <button
                type="button"
                className={locale === 'tj' ? 'active' : ''}
                onClick={() => setLocale('tj')}
              >
                TJ
              </button>
            </div>
            <div>{admin?.email}</div>
            <button type="button" className="btn-secondary" onClick={() => void logout()}>
              {strings.common.logout}
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
