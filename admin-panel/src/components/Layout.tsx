import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { t } from '../i18n';

const strings = t();

const nav = [
  { to: '/', label: strings.nav.dashboard },
  { to: '/users', label: strings.nav.users, permission: 'users:read' },
  { to: '/licenses', label: strings.nav.licenses, permission: 'licenses:read' },
  { to: '/devices', label: strings.nav.devices, permission: 'devices:read' },
  { to: '/orders', label: strings.nav.orders, permission: 'orders:read' },
  { to: '/telegram', label: strings.nav.telegram },
  { to: '/audit', label: strings.nav.audit, permission: 'audit:read' },
  { to: '/system', label: strings.nav.system },
  { to: '/profile', label: strings.nav.profile },
];

export function Layout() {
  const { admin, logout, hasPermission } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">{strings.brand}</div>
        <nav>
          {nav
            .filter((item) => !item.permission || hasPermission(item.permission))
            .map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}>
                {item.label}
              </NavLink>
            ))}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>{admin?.email}</div>
          <button type="button" className="btn-secondary" onClick={() => void logout()}>
            {strings.common.logout}
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
