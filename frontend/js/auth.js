// Tiny auth helper. Stored in window.Auth for use by inline scripts and app.js.
(function () {
  const TOKEN_KEY = 'atmos.token';
  const USER_KEY = 'atmos.user';

  async function request(path, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
        ...(token() ? { Authorization: `Bearer ${token()}` } : {})
      }
    });
    let body = null;
    try { body = await res.json(); } catch (_) {}
    if (!res.ok) {
      const msg = (body && body.error) || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return body;
  }

  function token() { return localStorage.getItem(TOKEN_KEY); }
  function user() {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  function setSession({ token: t, user: u }) {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  }

  async function login(email, password) {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setSession(data);
    return data.user;
  }

  async function signup(email, password, displayName) {
    const data = await request('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName })
    });
    setSession(data);
    return data.user;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  window.Auth = { request, token, user, login, signup, logout };
})();
