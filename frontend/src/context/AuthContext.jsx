import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, onUnauthorized, setToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  // True after a deliberate sign-out, so protected pages send the user home instead of to /login.
  const [signedOut, setSignedOut] = useState(false);

  const clearSession = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);
  const logout = useCallback(() => {
    setSignedOut(true);
    clearSession();
  }, [clearSession]);

  useEffect(() => {
    onUnauthorized(clearSession); // expired token: protected pages redirect to /login and come back
    if (!getToken()) {
      setReady(true);
      return;
    }
    api('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => clearSession())
      .finally(() => setReady(true));
  }, [clearSession]);

  const authenticate = useCallback(async (path, body) => {
    const data = await api(path, { method: 'POST', body });
    setToken(data.token);
    setSignedOut(false);
    setUser(data.user);
    return data.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      signedOut,
      isAdmin: user?.role === 'admin',
      login: (email, password) => authenticate('/auth/login', { email, password }),
      register: (name, email, password) => authenticate('/auth/register', { name, email, password }),
      logout,
    }),
    [user, ready, signedOut, authenticate, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
