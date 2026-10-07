import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DEMO_ACCOUNTS = [
  { label: 'Demo customer', email: 'demo@cartpilot.dev', password: 'cartpilot123' },
  { label: 'Store admin', email: 'admin@cartpilot.dev', password: 'admin123' },
];

function AuthForm({ mode }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';

  const submit = async (event, override) => {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    const values = override || form;
    try {
      const user = isLogin
        ? await login(values.email, values.password)
        : await register(values.name, values.email, values.password);
      const fallback = user.role === 'admin' ? '/admin' : '/';
      navigate(location.state?.from || fallback, { replace: true });
    } catch (err) {
      setError(err.details?.length ? err.details.map((d) => d.message).join('. ') : err.message);
    } finally {
      setBusy(false);
    }
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="page narrow">
      <form className="card auth-card" onSubmit={submit}>
        <h1>{isLogin ? 'Welcome back' : 'Create your account'}</h1>
        <p className="muted">{isLogin ? 'Log in to see your usual cart.' : 'Get ₹50 off your first order with WELCOME50.'}</p>
        {!isLogin && (
          <label className="field">
            <span>Name</span>
            <input value={form.name} onChange={set('name')} autoComplete="name" required minLength={2} />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            required
            minLength={isLogin ? 1 : 8}
          />
        </label>
        {error && (
          <p className="coupon-bad" role="alert">
            {error}
          </p>
        )}
        <button className="button block" disabled={busy}>
          {busy ? 'Please wait…' : isLogin ? 'Log in' : 'Sign up'}
        </button>
        <p className="muted small center">
          {isLogin ? (
            <>
              New to CartPilot? <Link to="/register">Create an account</Link>
            </>
          ) : (
            <>
              Already have an account? <Link to="/login">Log in</Link>
            </>
          )}
        </p>
        {isLogin && (
          <div className="demo-accounts">
            <p className="muted small">Try the seeded demo accounts:</p>
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                className="button secondary small"
                disabled={busy}
                onClick={() => {
                  setForm({ ...form, email: account.email, password: account.password });
                  submit(null, account);
                }}
              >
                {account.label}
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}

export const Login = () => <AuthForm mode="login" />;
export const Register = () => <AuthForm mode="register" />;
