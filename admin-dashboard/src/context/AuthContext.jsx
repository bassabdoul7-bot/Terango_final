import { createContext, useContext, useState, useEffect } from 'react';

var AuthContext = createContext(null);

export function AuthProvider({ children }) {
  var [token, setToken] = useState(localStorage.getItem('admin_token'));
  var [user, setUser] = useState(null);

  useEffect(function() {
    if (token) {
      try {
        var payload = JSON.parse(atob(token.split('.')[1]));
        setUser(payload);
      } catch(e) {
        setToken(null);
        localStorage.removeItem('admin_token');
      }
    }
  }, [token]);

  function login(t, u) {
    localStorage.setItem('admin_token', t);
    setToken(t);
    setUser(u);
  }

  function logout() {
    localStorage.removeItem('admin_token');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
