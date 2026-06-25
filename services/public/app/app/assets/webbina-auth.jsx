/* ============================================================================
   WEBBINA AUTH — real Supabase Auth (email + password) for the Console.
   - Bootstraps from the backend's public /api/config (URL + anon key).
   - Loads supabase-js on demand (ESM CDN), persists the session.
   - Exposes window.WebbinaAuth (singleton) + useWebbinaAuth() hook +
     window.webbinaAuthHeaders() for transports to authorize memory calls.
   ========================================================================== */
(function () {
  const listeners = new Set();
  const state = {
    ready: false,        // init finished
    authEnabled: false,  // backend has SUPABASE_URL + anon key
    client: null,        // supabase-js client
    session: null,
    user: null,
    error: null,
  };

  function notify() { listeners.forEach((fn) => { try { fn(snapshot()); } catch {} }); }
  function snapshot() {
    return {
      ready: state.ready, authEnabled: state.authEnabled,
      user: state.user, session: state.session, error: state.error,
    };
  }

  async function loadSupabase() {
    // Prefer the UMD global loaded via <script> in the HTML (most reliable).
    if (window.supabase && window.supabase.createClient) return window.supabase.createClient;
    // Fallback: dynamic ESM import (may fail under some CSP/script contexts).
    try {
      const mod = await import('https://esm.sh/@supabase/supabase-js@2.45.4');
      return mod.createClient;
    } catch (e) { return null; }
  }

  const WebbinaAuth = {
    subscribe(fn) { listeners.add(fn); fn(snapshot()); return () => listeners.delete(fn); },
    getToken() { return state.session?.access_token || null; },
    getUserId() { return state.user?.id || null; },
    getEmail() { return state.user?.email || null; },
    isEnabled() { return state.authEnabled; },

    async init() {
      if (state.authEnabled && state.client) return snapshot();   // already on
      if (state._initing) return snapshot();                       // avoid concurrent
      state._initing = true;
      try {
        const api = (window.WEBBINA_API || '').replace(/\/+$/, '');
        let cfg = null;
        try { cfg = await (await fetch(`${api}/api/config`, { cache: 'no-store' })).json(); } catch {}
        if (!cfg || !cfg.authEnabled || !cfg.supabaseUrl || !cfg.supabaseAnonKey) {
          // Backend not ready (cold start) or auth off — mark ready but DON'T
          // latch permanently; a later init() retry can still turn it on.
          state.ready = true; state.authEnabled = false; notify(); return snapshot();
        }
        const createClient = await loadSupabase();
        if (!createClient) { state.ready = true; state.authEnabled = false; state.error = 'sdk'; notify(); return snapshot(); }

        state.client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          auth: { persistSession: true, autoRefreshToken: true, storageKey: 'webbina-auth' },
        });
        state.authEnabled = true;
        state.error = null;

        // getSession can reject on a flaky network — never let it lock init.
        try {
          const { data } = await state.client.auth.getSession();
          state.session = data?.session || null;
          state.user = state.session?.user || null;
          if (state.user) window.WEBBINA_USER_ID = state.user.id;
        } catch { state.session = null; state.user = null; }

        state.client.auth.onAuthStateChange((_evt, session) => {
          state.session = session || null;
          state.user = session?.user || null;
          window.WEBBINA_USER_ID = state.user?.id || null;
          notify();
        });

        state.ready = true; notify(); return snapshot();
      } catch (e) {
        // Any unexpected failure: stay retry-able, don't crash the UI.
        state.ready = true; state.error = String(e); notify(); return snapshot();
      } finally {
        state._initing = false;   // ALWAYS release the lock
      }
    },

    async signIn(email, password) {
      if (!state.client) throw new Error('Auth indisponible');
      const { data, error } = await state.client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },
    async signUp(email, password) {
      if (!state.client) throw new Error('Auth indisponible');
      const { data, error } = await state.client.auth.signUp({ email, password });
      if (error) throw error;
      return data;
    },
    async signOut() {
      if (state.client) await state.client.auth.signOut();
      window.WEBBINA_USER_ID = null;
    },
  };

  // Convenience for transports: Authorization header when logged in.
  window.webbinaAuthHeaders = function () {
    const t = WebbinaAuth.getToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  window.WebbinaAuth = WebbinaAuth;

  /* React hook + UI ---------------------------------------------------------- */
  if (typeof React !== 'undefined') {
    const { useState, useEffect } = React;

    window.useWebbinaAuth = function () {
      const [snap, setSnap] = useState(() => ({ ready: false, authEnabled: false, user: null }));
      useEffect(() => {
        const unsub = WebbinaAuth.subscribe(setSnap);
        let tries = 0;
        let timer = null;
        const attempt = async () => {
          const s = await WebbinaAuth.init();
          // If the backend was cold/unreachable, retry a few times (Render wake-up).
          if (!s.authEnabled && tries < 6) {
            tries++;
            timer = setTimeout(attempt, 2500);
          }
        };
        attempt();
        return () => { unsub(); if (timer) clearTimeout(timer); };
      }, []);
      return snap;
    };

    /* Header button + login modal. */
    window.AuthButton = function AuthButton() {
      const snap = window.useWebbinaAuth();
      const [open, setOpen] = useState(false);
      const [mode, setMode] = useState('signin'); // signin | signup
      const [email, setEmail] = useState('');
      const [pw, setPw] = useState('');
      const [busy, setBusy] = useState(false);
      const [msg, setMsg] = useState(null);

      if (!snap.ready) return null;
      if (!snap.authEnabled) {
        return <div className="auth-chip auth-off" title="Auth non configurée (ajoutez SUPABASE_ANON_KEY au backend)">Auth désactivée</div>;
      }

      async function submit(e) {
        e.preventDefault(); setBusy(true); setMsg(null);
        try {
          if (mode === 'signup') {
            const r = await WebbinaAuth.signUp(email.trim(), pw);
            if (!r.session) { setMsg({ ok: true, text: 'Compte créé. Vérifiez votre email si une confirmation est demandée, puis connectez-vous.' }); setMode('signin'); setBusy(false); return; }
          } else {
            await WebbinaAuth.signIn(email.trim(), pw);
          }
          // reload so Webbina greets with the freshly-loaded memory
          window.location.reload();
        } catch (err) {
          setMsg({ ok: false, text: err?.message || 'Échec de la connexion.' });
          setBusy(false);
        }
      }

      if (snap.user) {
        return (
          <div className="auth-wrap">
            <button className="auth-chip auth-in" onClick={() => setOpen(o => !o)}>
              <span className="auth-avatar">{(snap.user.email || '?')[0].toUpperCase()}</span>
              <span className="auth-email">{snap.user.email}</span>
            </button>
            {open && (
              <div className="auth-pop">
                <b>Connectée</b>
                <p>{snap.user.email}</p>
                <button className="auth-out" onClick={async () => { await WebbinaAuth.signOut(); window.location.reload(); }}>Se déconnecter</button>
              </div>
            )}
          </div>
        );
      }

      return (
        <div className="auth-wrap">
          <button className="auth-chip auth-cta" onClick={() => setOpen(true)}>Se connecter</button>
          {open && (
            <div className="auth-modal-bg" onClick={() => setOpen(false)}>
              <form className="auth-modal" onClick={e => e.stopPropagation()} onSubmit={submit}>
                <div className="auth-modal-head">
                  <img src="assets/webbina-happy.png" alt="" />
                  <div>
                    <b>{mode === 'signin' ? 'Bon retour parmi nous' : 'Créer votre compte'}</b>
                    <span>Webbina se souviendra de vos préférences de voyage.</span>
                  </div>
                </div>
                <label>Email<input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@exemple.com" /></label>
                <label>Mot de passe<input type="password" required minLength={6} value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" /></label>
                {msg && <div className={`auth-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
                <button className="auth-submit" disabled={busy} type="submit">{busy ? '…' : (mode === 'signin' ? 'Se connecter' : "S'inscrire")}</button>
                <div className="auth-switch">
                  {mode === 'signin'
                    ? <span>Pas encore de compte ? <button type="button" onClick={() => { setMode('signup'); setMsg(null); }}>Créer un compte</button></span>
                    : <span>Déjà un compte ? <button type="button" onClick={() => { setMode('signin'); setMsg(null); }}>Se connecter</button></span>}
                </div>
              </form>
            </div>
          )}
        </div>
      );
    };
  }
})();
