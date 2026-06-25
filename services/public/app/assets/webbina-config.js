/* ============================================================================
   WEBBINA RUNTIME CONFIG — loaded FIRST, before every other script.
   Lets a non-developer connect the deployed backend WITHOUT editing code:
   the backend URL + (optional) user id are read from localStorage, which the
   "Connexion" panel in the Console writes. No secrets here — only the public
   address of your own /services backend.
   ----------------------------------------------------------------------------
   Priority for the API URL:
     1. ?api=... in the page URL (handy for a one-off test)
     2. localStorage 'webbina_api'  (set via the Connexion panel)
     3. http://localhost:8787       (default, when you run it on your machine)
   ========================================================================== */
(function () {
  function read(key) {
    try { return window.localStorage.getItem(key) || ''; } catch (e) { return ''; }
  }
  var params = new URLSearchParams(window.location.search);
  var fromUrl = params.get('api');
  if (fromUrl) { try { window.localStorage.setItem('webbina_api', fromUrl.replace(/\/+$/, '')); } catch (e) {} }

  // Default backend = the deployed production API, so a SHARED demo file works
  // out of the box on any phone (no localStorage needed). Can still be overridden
  // via ?api=... or the Connexion panel.
  var DEFAULT_API = 'https://travelfamily-1.onrender.com';
  var api = (fromUrl || read('webbina_api') || DEFAULT_API).replace(/\/+$/, '');
  window.WEBBINA_API = api;

  var uid = read('webbina_user_id');
  if (uid) window.WEBBINA_USER_ID = uid;

  // Travelpayouts affiliate marker (public — earns commission on partner bookings).
  window.WEBBINA_TP_MARKER = '741019';

  // Tiny helper the Connexion panel uses to save + apply a new backend URL.
  window.WebbinaConfig = {
    get api() { return window.WEBBINA_API; },
    setApi: function (url) {
      var clean = String(url || '').trim().replace(/\/+$/, '');
      try { window.localStorage.setItem('webbina_api', clean); } catch (e) {}
      window.WEBBINA_API = clean;
      return clean;
    },
    setUserId: function (id) {
      try { window.localStorage.setItem('webbina_user_id', String(id || '')); } catch (e) {}
      window.WEBBINA_USER_ID = id || undefined;
    },
    clear: function () {
      try { window.localStorage.removeItem('webbina_api'); window.localStorage.removeItem('webbina_user_id'); } catch (e) {}
    },
  };

  // ── Babel-safe dynamic ESM importer ───────────────────────────────────────
  // The transport code is transpiled by Babel, which rewrites a dynamic
  // import() into require() (undefined in the browser). Defining the importer
  // HERE — in a plain <script>, NOT type="text/babel" — keeps a real native
  // import(). The app calls window.__webbinaImport(url) to load the EL SDK.
  window.__webbinaImport = function (url) { return import(url); };
})();
