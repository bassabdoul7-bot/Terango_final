import { createContext, useContext, useState, useEffect } from 'react';

var AuthContext = createContext(null);

export function AuthProvider({ children }) {
  var [token, setToken] = useState(localStorage.getItem('admin_token'));
  var [user, setUser] = useState(function() {
    var saved = localStorage.getItem('admin_user');
    if (saved) {
      try { return JSON.parse(saved); } catch(e) { return null; }
    }
    return null;
  });

  useEffect(function() {
    if (token && !user) {
      try {
        var payload = JSON.parse(atob(token.split('.')[1]));
        setUser(payload);
      } catch(e) {
        setToken(null);
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
      }
    }
  }, [token]);

  function login(t, u) {
    localStorage.setItem('admin_token', t);
    localStorage.setItem('admin_user', JSON.stringify(u));
    setToken(t);
    setUser(u);
  }

  function logout() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setToken(null);
    setUser(null);
  }

  var role = user ? user.role : null;
  var isAdmin = role === 'admin';
  var isPartner = role === 'partner';

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token, role, isAdmin, isPartner }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
