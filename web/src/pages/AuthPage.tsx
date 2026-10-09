import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { authApi } from '../api/endpoints';
import { useAuth } from '../auth/useAuth';
import { Icon } from '../components/ui';
import { useTheme } from '../hooks/useTheme';

type Mode = 'login' | 'create' | 'join';

const TABS: { mode: Mode; label: string }[] = [
  { mode: 'login', label: 'Entrar' },
  { mode: 'create', label: 'Criar empresa' },
  { mode: 'join', label: 'Convite' },
];

export function AuthPage() {
  const { signIn } = useAuth();
  const { theme, toggle } = useTheme();
  const [mode, setMode] = useState<Mode>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', companyName: '', inviteCode: '' });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const auth =
        mode === 'login'
          ? await authApi.login(form.email, form.password)
          : await authApi.register({
              name: form.name,
              email: form.email,
              password: form.password,
              ...(mode === 'create' ? { companyName: form.companyName } : { inviteCode: form.inviteCode }),
            });
      await signIn(auth.token);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.details ?? {});
      } else {
        setError('Erro inesperado');
      }
      setBusy(false);
    }
  }

  const fieldError = (key: string) => fieldErrors[key]?.[0];

  return (
    <div className="auth-page">
      <button className="btn btn-icon btn-ghost auth-theme" onClick={toggle} aria-label="Alternar tema">
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
      </button>

      <div className="auth-card card">
        <div className="brand brand-lg">
          <span className="brand-mark">
            <Icon name="box" size={20} />
          </span>
          <span className="brand-name">Catalog AI</span>
        </div>
        <p className="muted center-text">Catálogo de produtos com um assistente de IA para os seus clientes.</p>

        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.mode}
              role="tab"
              aria-selected={mode === t.mode}
              className={mode === t.mode ? 'active' : ''}
              onClick={() => {
                setMode(t.mode);
                setError(null);
                setFieldErrors({});
              }}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="form">
          {mode !== 'login' && (
            <label className="field">
              <span>Seu nome</span>
              <input value={form.name} onChange={set('name')} required minLength={2} autoComplete="name" />
            </label>
          )}
          {mode === 'create' && (
            <label className="field">
              <span>Nome da empresa</span>
              <input value={form.companyName} onChange={set('companyName')} required minLength={2} />
            </label>
          )}
          {mode === 'join' && (
            <label className="field">
              <span>Código de convite</span>
              <input value={form.inviteCode} onChange={set('inviteCode')} required />
            </label>
          )}
          <label className="field">
            <span>E-mail</span>
            <input type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
            {fieldError('email') && <small className="field-error">{fieldError('email')}</small>}
          </label>
          <label className="field">
            <span>Senha</span>
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              required
              minLength={mode === 'login' ? 1 : 8}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {mode !== 'login' && <small className="muted">Mínimo de 8 caracteres.</small>}
            {fieldError('password') && <small className="field-error">{fieldError('password')}</small>}
          </label>

          {error && <div className="alert" role="alert">{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
      </div>
    </div>
  );
}
