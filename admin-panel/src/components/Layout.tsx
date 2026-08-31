import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const nav = [
  { to: '/', label: 'Dashboard' },
  { to: '/users', label: 'Users', permission: 'users:read' },
  { to: '/licenses', label: 'Licenses', permission: 'licenses:read' },
  { to: '/devices', label: 'Devices', permission: 'devices:read' },
  { to: '/telegram', label: 'Telegram' },
  { to: '/audit', label: 'Audit Logs', permission: 'audit:read' },
  { to: '/system', label: 'System' },
  { to: '/profile', label: 'Profile' },
];

export function Layout() {
  const { admin, logout, hasPermission } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Ruznamo Admin</div>
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
            Logout
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
