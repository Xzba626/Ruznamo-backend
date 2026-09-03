import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocale, useStrings } from '../context/LocaleContext';

const primaryNav = [
  { to: '/', labelKey: 'dashboard' as const, permission: 'dashboard:read' },
  { to: '/orders', labelKey: 'sales' as const, permission: 'orders:read' },
  { to: '/licenses', labelKey: 'licenses' as const, permission: 'licenses:read' },
  { to: '/devices', labelKey: 'devices' as const, permission: 'devices:read' },
  { to: '/analytics', labelKey: 'analytics' as const, permission: 'dashboard:read' },
  { to: '/updates', labelKey: 'updates' as const, permission: 'releases:read' },
  { to: '/plans', labelKey: 'plans' as const, permission: 'plans:read' },
  { to: '/system', labelKey: 'system' as const },
];

export function Layout() {
  const { logout, hasPermission } = useAuth();
  const { locale, setLocale } = useLocale();
  const strings = useStrings();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

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
            <div className="locale-switch" role="group" aria-label={strings.header.language}>
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
            <div className="profile-menu" ref={menuRef}>
              <button
                type="button"
                className="profile-trigger"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((open) => !open);
                }}
              >
                <span className="profile-avatar" aria-hidden>
                  👤
                </span>
              </button>
              {menuOpen && (
                <div className="profile-dropdown" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/profile');
                    }}
                  >
                    {strings.header.profile}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/profile#security');
                    }}
                  >
                    {strings.header.security}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/profile#telegram');
                    }}
                  >
                    {strings.header.telegramAdmin}
                  </button>
                  <hr />
                  <button
                    type="button"
                    role="menuitem"
                    className="danger"
                    onClick={() => {
                      setMenuOpen(false);
                      void logout();
                    }}
                  >
                    {strings.common.logout}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
