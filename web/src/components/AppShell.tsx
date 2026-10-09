import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useTheme } from '../hooks/useTheme';
import { Icon } from './ui';

export function AppShell() {
  const { session, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  if (!session) return null;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark">
              <Icon name="box" size={16} />
            </span>
            <span className="brand-name">Catalog AI</span>
          </div>

          <nav className="nav" aria-label="Principal">
            <NavLink to="/" end>
              <Icon name="box" size={16} /> Produtos
            </NavLink>
            <NavLink to="/chat">
              <Icon name="sparkles" size={16} /> Assistente
            </NavLink>
          </nav>

          <div className="topbar-actions">
            <div className="whoami">
              <strong>{session.company.name}</strong>
              <span>
                {session.user.name} · {session.user.role === 'admin' ? 'Admin' : 'Usuário'}
              </span>
            </div>
            <button
              className="btn btn-icon btn-ghost"
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
              title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
            <button className="btn btn-icon btn-ghost" onClick={signOut} aria-label="Sair" title="Sair">
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
