/* ============================================================================
   WEBBINA LIVE CLIENT (plain JS — usable from the mobile Prototype).
   Talks to the deployed /services backend: real OpenAI brain (streamed),
   plus memory greeting when a user id/token is available. Degrades cleanly:
   isLive() tells the UI whether the backend is reachable so it can fall back
   to the scripted demo.
   ========================================================================== */
(function () {
  function api() { return (window.WEBBINA_API || '').replace(/\/+$/, ''); }

  function authHeaders() {
    try { if (typeof window.webbinaAuthHeaders === 'function') return window.webbinaAuthHeaders(); } catch (e) {}
    return {};
  }
  function uid() {
    try { if (window.WebbinaAuth && window.WebbinaAuth.getUserId()) return window.WebbinaAuth.getUserId(); } catch (e) {}
    return window.WEBBINA_USER_ID || null;
  }

  var _live = null; // cached health probe (per page load)

  var WebbinaLive = {
    /** Has a backend URL been configured at all? */
    configured: function () { return !!api(); },

    /** Probe /api/health once; resolves true if the backend answers. */
    isLive: async function () {
      if (_live !== null) return _live;
      if (!api()) { _live = false; return false; }
      try {
        var r = await fetch(api() + '/api/health', { cache: 'no-store' });
        _live = r.ok;
      } catch (e) { _live = false; }
      return _live;
    },

    /** Fire-and-forget wake-up ping — re-warms a slept Render dyno. */
    wake: function () {
      try { if (api()) fetch(api() + '/api/health', { cache: 'no-store' }).catch(function () {}); } catch (e) {}
    },

    /** Personalised greeting for the logged-in user, or null. */
    greeting: async function () {
      var id = uid(); if (!id || !api()) return null;
      try {
        var r = await fetch(api() + '/api/memory/' + id + '/greeting', { headers: authHeaders(), cache: 'no-store' });
        if (!r.ok) return null;
        var g = await r.json();
        return g && g.greeting ? g : null;
      } catch (e) { return null; }
    },

    /**
     * Stream a reply from the real OpenAI brain.
     * @param messages [{role:'user'|'assistant', content}]
     * @param onToken (text) => void   incremental tokens for live display
     * @returns full reply text (or throws on failure)
     */
    chat: async function (messages, onToken) {
      if (!api()) throw new Error('no_backend');
      // Abort-based timeouts so a stalled Render dyno fails fast into the retry
      // path instead of hanging forever ("ça ne répond plus"):
      //  • headersMs  — time allowed to get the first response (covers cold start)
      //  • stallMs    — max gap between two tokens once streaming has started
      var headersMs = 38000, stallMs = 22000;
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var timer = null;
      var arm = function (ms) {
        if (timer) clearTimeout(timer);
        if (ctrl) timer = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, ms);
      };
      var disarm = function () { if (timer) { clearTimeout(timer); timer = null; } };
      arm(headersMs);
      var res;
      try {
        res = await fetch(api() + '/api/chat', {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
          body: JSON.stringify({ messages: messages, stream: true }),
          signal: ctrl ? ctrl.signal : undefined,
        });
      } catch (e) {
        disarm();
        throw new Error(e && e.name === 'AbortError' ? 'chat_timeout' : 'chat_network');
      }
      if (!res.ok || !res.body) { disarm(); throw new Error('chat_' + res.status); }
      var reader = res.body.getReader();
      var dec = new TextDecoder();
      var buf = '', full = '';
      try {
        for (;;) {
          arm(stallMs);
          var chunk = await reader.read();
          if (chunk.done) break;
          buf += dec.decode(chunk.value, { stream: true });
          var lines = buf.split('\n'); buf = lines.pop() || '';
          for (var i = 0; i < lines.length; i++) {
            var s = lines[i].trim();
            if (s.indexOf('data:') !== 0) continue;
            var payload = s.slice(5).trim();
            if (payload === '[DONE]') continue;
            try { var j = JSON.parse(payload); if (j.token) { full += j.token; if (onToken) onToken(j.token); } } catch (e) {}
          }
        }
      } catch (e) {
        disarm();
        // If we already streamed something usable, keep it instead of failing.
        if (full) return full;
        throw new Error(e && e.name === 'AbortError' ? 'chat_stalled' : 'chat_stream');
      }
      disarm();
      return full;
    },

    /** Persist a turn + push detected preferences (logged-in users only). */
    remember: async function (userText, assistantText) {
      var id = uid(); if (!id || !api()) return;
      var headers = Object.assign({ 'Content-Type': 'application/json' }, authHeaders());
      try {
        await fetch(api() + '/api/memory/' + id + '/conversation', {
          method: 'POST', headers,
          body: JSON.stringify({ entries: [
            { kind: 'message', role: 'user', content: userText },
            { kind: 'message', role: 'assistant', content: assistantText },
          ] }),
        });
      } catch (e) {}
    },

    /**
     * Real flight search via the backend (Duffel).
     * @param q {origin, destination, departureDate, adults, children?, returnDate?, maxResults?}
     * @returns { items: FlightOffer[], provider } or throws.
     */
    searchFlights: async function (q) {
      if (!api()) throw new Error('no_backend');
      var p = new URLSearchParams();
      p.set('origin', q.origin); p.set('destination', q.destination);
      p.set('departureDate', q.departureDate); p.set('adults', String(q.adults || 2));
      if (q.children) p.set('children', String(q.children));
      if (q.returnDate) p.set('returnDate', q.returnDate);
      p.set('maxResults', String(q.maxResults || 5));
      var r = await fetch(api() + '/api/flights/search?' + p.toString(), { headers: authHeaders(), cache: 'no-store' });
      if (!r.ok) { var e = await r.json().catch(function(){return {};}); throw new Error((e.error && e.error.code) || ('flights_' + r.status)); }
      return await r.json();
    },

    /** Validate trip timing (J+1, connections, hotel nights) — backend engine. */
    coherence: async function (input) {
      if (!api()) throw new Error('no_backend');
      var r = await fetch(api() + '/api/coherence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!r.ok) throw new Error('coherence_' + r.status);
      return await r.json();
    },

    /** Transcribe a recorded audio Blob to text via backend Whisper (works on iPhone). */
    transcribe: async function (blob) {
      if (!api()) throw new Error('no_backend');
      var r = await fetch(api() + '/api/voice/stt', {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'audio/mp4' },
        body: blob,
      });
      if (!r.ok) throw new Error('stt_' + r.status);
      var j = await r.json();
      return (j && j.text) || '';
    },

    /** Transparent price breakdown (base + Webbina fee) from the backend. */
    quote: async function (category, base, pax) {
      if (!api()) return null;
      try {
        var r = await fetch(api() + '/api/booking/quote', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: category, base: base, pax: pax || 1 }),
        });
        if (!r.ok) return null;
        return await r.json();
      } catch (e) { return null; }
    },

    /** Create a Stripe PaymentIntent (amount computed server-side, incl. fee). */
    paymentIntent: async function (category, base, pax, label) {
      if (!api()) throw new Error('no_backend');
      var r = await fetch(api() + '/api/booking/intent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: category, base: base, pax: pax || 1, label: label || category }),
      });
      if (!r.ok) { var e = await r.json().catch(function () { return {}; }); throw new Error((e.error && e.error.code) || ('intent_' + r.status)); }
      return await r.json(); // { clientSecret, publishableKey, breakdown }
    },

    /** Is real Stripe payment enabled on the backend? Cached config. */
    _cfg: null,
    config: async function () {
      if (this._cfg) return this._cfg;
      if (!api()) return {};
      try { this._cfg = await (await fetch(api() + '/api/config', { cache: 'no-store' })).json(); }
      catch (e) { this._cfg = {}; }
      return this._cfg;
    },

    /** "Bon plan du jour" — best current deals to family destinations. */
    deals: async function (origin, limit) {
      if (!api()) return null;
      try {
        var p = new URLSearchParams();
        if (origin) p.set('origin', origin);
        if (limit) p.set('limit', String(limit));
        var r = await fetch(api() + '/api/deals?' + p.toString(), { cache: 'no-store' });
        if (!r.ok) return null;
        var j = await r.json();
        return (j && j.items) || [];
      } catch (e) { return null; }
    },

    /** Travelpayouts Data API — real cached fares for a route (cheapest first). */
    tpPrices: async function (q) {
      if (!api()) return null;
      try {
        var p = new URLSearchParams();
        p.set('origin', q.origin); p.set('destination', q.destination);
        if (q.departureDate) p.set('departureDate', q.departureDate);
        if (q.returnDate) p.set('returnDate', q.returnDate);
        if (q.oneWay) p.set('oneWay', 'true');
        if (q.limit) p.set('limit', String(q.limit));
        var r = await fetch(api() + '/api/tp/prices?' + p.toString(), { cache: 'no-store' });
        if (!r.ok) return null;
        var j = await r.json();
        return (j && j.fares) || [];
      } catch (e) { return null; }
    },

    /** Travelpayouts Data API — cheapest upcoming DATES for a route ("bonnes dates"). */
    tpBestDates: async function (origin, destination, limit) {
      if (!api()) return null;
      try {
        var p = new URLSearchParams();
        p.set('origin', origin); p.set('destination', destination);
        if (limit) p.set('limit', String(limit));
        var r = await fetch(api() + '/api/tp/best-dates?' + p.toString(), { cache: 'no-store' });
        if (!r.ok) return null;
        var j = await r.json();
        return (j && j.dates) || [];
      } catch (e) { return null; }
    },

    /** Assemble a full trip (flight + hotel + activities) into one package. */
    buildPackage: async function (input) {
      if (!api()) throw new Error('no_backend');
      var r = await fetch(api() + '/api/package', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!r.ok) { var e = await r.json().catch(function () { return {}; }); throw new Error((e.error && e.error.code) || ('package_' + r.status)); }
      return await r.json();
    },

    /**
     * Real hotel search via the backend (Duffel Stays, by coordinates).
     * @param q {lat, lng, checkInDate, checkOutDate, adults, children?, radiusKm?}
     */
    searchHotels: async function (q) {
      if (!api()) throw new Error('no_backend');
      var p = new URLSearchParams();
      p.set('lat', String(q.lat)); p.set('lng', String(q.lng));
      p.set('checkInDate', q.checkInDate); p.set('checkOutDate', q.checkOutDate);
      p.set('adults', String(q.adults || 2));
      if (q.children) p.set('children', String(q.children));
      if (q.radiusKm) p.set('radiusKm', String(q.radiusKm));
      var r = await fetch(api() + '/api/flights/hotels?' + p.toString(), { headers: authHeaders(), cache: 'no-store' });
      if (!r.ok) { var e = await r.json().catch(function(){return {};}); throw new Error((e.error && e.error.code) || ('hotels_' + r.status)); }
      return await r.json();
    },

    /** Real weather + 5-day forecast for coordinates (OpenWeather). */
    weather: async function (lat, lng) {
      if (!api()) throw new Error('no_backend');
      var p = new URLSearchParams({ lat: String(lat), lng: String(lng), lang: 'fr', units: 'metric' });
      var r = await fetch(api() + '/api/weather?' + p.toString(), { cache: 'no-store' });
      if (!r.ok) throw new Error('weather_' + r.status);
      return await r.json();
    },

    /** Registered passports for the logged-in user (memory). */
    passports: async function () {
      var id = uid(); if (!id || !api()) return null;
      try {
        var r = await fetch(api() + '/api/memory/' + id + '/passports', { headers: authHeaders(), cache: 'no-store' });
        if (!r.ok) return null;
        var j = await r.json();
        return (j && j.items) || [];
      } catch (e) { return null; }
    },

    /** Real loyalty state (tier, cagnotte, progress) computed from saved_trips.
        Returns null when logged out or backend unavailable → app falls back to demo. */
    loyalty: async function () {
      var id = uid(); if (!id || !api()) return null;
      try {
        var plan = (window.TF && TF.plan && TF.plan() === 'premium') ? 'premium' : 'free';
        var r = await fetch(api() + '/api/loyalty/' + id + '?plan=' + plan, { headers: authHeaders(), cache: 'no-store' });
        if (!r.ok) return null;
        return await r.json();
      } catch (e) { return null; }
    },

    /** Open a SAV ticket from inside the app (attaches the user if logged in). */
    support: async function (message, subject, email) {
      if (!api()) throw new Error('no_backend');
      var headers = Object.assign({ 'Content-Type': 'application/json' }, authHeaders());
      var body = { message: message };
      if (subject) body.subject = subject;
      if (email) body.email = email;
      var r = await fetch(api() + '/api/support', { method: 'POST', headers: headers, body: JSON.stringify(body) });
      if (!r.ok) throw new Error('ticket_failed');
      return await r.json();
    },

    /** Issue a real flight order (Duffel). offerId = the selected live offer id;
        passengers = [{givenName, familyName, bornOn?, gender?, email?, phoneNumber?}].
        In Duffel TEST mode this books on the test balance (no real money). */
    createFlightOrder: async function (offerId, passengers) {
      if (!api()) throw new Error('no_backend');
      var headers = Object.assign({ 'Content-Type': 'application/json' }, authHeaders());
      var r = await fetch(api() + '/api/flights/order', {
        method: 'POST', headers: headers,
        body: JSON.stringify({ offerId: offerId, passengers: passengers || [] }),
      });
      if (!r.ok) throw new Error('order_failed');
      return await r.json();
    },

    /** Price-watch (Premium alerte baisse de prix). */
    getWatches: async function () {
      var id = uid(); if (!id || !api()) return null;
      try {
        var r = await fetch(api() + '/api/watch/' + id, { headers: authHeaders(), cache: 'no-store' });
        if (!r.ok) return null;
        return (await r.json()).items || [];
      } catch (e) { return null; }
    },
    addWatch: async function (origin, destination, departDate) {
      var id = uid(); if (!id || !api()) throw new Error('no_account');
      var headers = Object.assign({ 'Content-Type': 'application/json' }, authHeaders());
      var body = { origin: origin, destination: destination };
      if (departDate) body.departDate = departDate;
      var r = await fetch(api() + '/api/watch/' + id, { method: 'POST', headers: headers, body: JSON.stringify(body) });
      if (!r.ok) throw new Error('watch_failed');
      return await r.json();
    },
    removeWatch: async function (watchId) {
      var id = uid(); if (!id || !api()) return;
      try { await fetch(api() + '/api/watch/' + id + '/' + watchId, { method: 'DELETE', headers: authHeaders() }); } catch (e) {}
    },

    /** Formalités réelles (Gemini) pour une nationalité → destination. */
    formalities: async function (nationality, destination, residence) {
      if (!api()) return null;
      try {
        var p = new URLSearchParams({ nationality: nationality, destination: destination });
        if (residence) p.set('residence', residence);
        var r = await fetch(api() + '/api/formalities?' + p.toString(), { cache: 'no-store' });
        if (!r.ok) return null;
        return await r.json();
      } catch (e) { return null; }
    },

    /** Itinéraire porte-à-porte pour rejoindre le 1er transport (Google Routes). */
    itineraryToHub: async function (origin, hub, opts) {
      if (!api()) return null;
      try {
        var p = new URLSearchParams({ origin: origin, hub: hub });
        opts = opts || {};
        if (opts.family) p.set('family', '1');
        if (opts.budget) p.set('budget', '1');
        if (opts.pax) p.set('pax', String(opts.pax));
        var r = await fetch(api() + '/api/itinerary/to-hub?' + p.toString(), { cache: 'no-store' });
        if (!r.ok) return null;
        return await r.json();
      } catch (e) { return null; }
    },

    /** Dernier km : aéroport/gare d'arrivée → hôtel/destination. */
    itineraryFromHub: async function (hub, destination, opts) {
      if (!api()) return null;
      try {
        var p = new URLSearchParams({ hub: hub, destination: destination });
        opts = opts || {};
        if (opts.family) p.set('family', '1');
        if (opts.budget) p.set('budget', '1');
        if (opts.pax) p.set('pax', String(opts.pax));
        var r = await fetch(api() + '/api/itinerary/from-hub?' + p.toString(), { cache: 'no-store' });
        if (!r.ok) return null;
        return await r.json();
      } catch (e) { return null; }
    },

    /** Itinéraire complet porte-à-porte (départ + arrivée) en une fois. */
    itineraryFull: async function (q) {
      if (!api() || !q) return null;
      try {
        var p = new URLSearchParams({ origin: q.origin, departHub: q.departHub, arriveHub: q.arriveHub, destination: q.destination });
        if (q.family) p.set('family', '1');
        if (q.budget) p.set('budget', '1');
        if (q.pax) p.set('pax', String(q.pax));
        var r = await fetch(api() + '/api/itinerary/full?' + p.toString(), { cache: 'no-store' });
        if (!r.ok) return null;
        return await r.json();
      } catch (e) { return null; }
    },

    /** Carnet de route multi-villes : Webbina génère un road trip complet
        (jour par jour, comparaison hôtels, vol le moins cher, voiture, budget). */
    planRoadtrip: async function (input) {
      if (!api() || !input) return null;
      try {
        var headers = Object.assign({ 'Content-Type': 'application/json' }, authHeaders());
        var r = await fetch(api() + '/api/roadtrip/plan', { method: 'POST', headers: headers, body: JSON.stringify(input) });
        if (!r.ok) return null;
        return await r.json();
      } catch (e) { return null; }
    },

    /** Suggestion d'itinéraire (villes + à voir, sans prix) — pour construire/éditer. */
    suggestRoadtrip: async function (input) {
      if (!api() || !input) return null;
      var ctrl = new AbortController();
      var timer = setTimeout(function(){ ctrl.abort(); }, 40000);
      try {
        var headers = Object.assign({ 'Content-Type': 'application/json' }, authHeaders());
        var r = await fetch(api() + '/api/roadtrip/suggest', { method: 'POST', headers: headers, body: JSON.stringify(input), signal: ctrl.signal });
        clearTimeout(timer);
        if (!r.ok) return { error: 'server' };
        return (await r.json()).stops || [];
      } catch (e) { clearTimeout(timer); return { error: (e && e.name==='AbortError')?'timeout':'network' }; }
    },

    /** Plusieurs itinéraires complets à COMPARER avant réservation. */
    planRoadtripOptions: async function (input) {
      if (!api() || !input) return null;
      var self = this;
      async function attempt(ms){
        var ctrl = new AbortController();
        var timer = setTimeout(function(){ ctrl.abort(); }, ms);
        try {
          var headers = Object.assign({ 'Content-Type': 'application/json' }, authHeaders());
          var r = await fetch(api() + '/api/roadtrip/options', { method: 'POST', headers: headers, body: JSON.stringify(input), signal: ctrl.signal });
          clearTimeout(timer);
          if (!r.ok) return { error: 'server', status: r.status };
          return (await r.json()).options || [];
        } catch (e) {
          clearTimeout(timer);
          return { error: (e && e.name === 'AbortError') ? 'timeout' : 'network' };
        }
      }
      // First try; if the server was asleep (timeout/network), retry once — it's now warm.
      var res = await attempt(70000);
      if (res && res.error && (res.error === 'timeout' || res.error === 'network')) {
        res = await attempt(90000);
      }
      return res;
    },

    /** Wake the backend (Render free tier sleeps). Call on screen mount. */
    warm: function () {
      if (!api()) return;
      try { fetch(api() + '/api/health', { cache: 'no-store' }).catch(function(){}); } catch (e) {}
    },

    /** Grille de prix par dates (type Google Flights) — 1 appel, tarifs réels. */
    priceGrid: async function (origin, destination, month, opts) {
      if (!api()) return null;
      var ctrl = new AbortController();
      var timer = setTimeout(function(){ ctrl.abort(); }, 25000);
      try {
        opts = opts || {};
        var p = new URLSearchParams({ origin: origin, destination: destination, month: month });
        if (opts.returnMonth) p.set('returnMonth', opts.returnMonth);
        if (opts.pax) p.set('pax', String(opts.pax));
        var r = await fetch(api() + '/api/flights/pricegrid?' + p.toString(), { cache: 'no-store', signal: ctrl.signal });
        clearTimeout(timer);
        if (!r.ok) return null;
        return await r.json();
      } catch (e) { clearTimeout(timer); return null; }
    },

    /** Annulation d'une commande Duffel (devis du remboursement puis confirmation). */
    cancelQuote: async function (orderId) {
      if (!api()) throw new Error('no_backend');
      var headers = Object.assign({ 'Content-Type': 'application/json' }, authHeaders());
      var r = await fetch(api() + '/api/flights/order/' + orderId + '/cancel-quote', { method: 'POST', headers: headers, body: '{}' });
      if (!r.ok) throw new Error('quote_failed');
      return await r.json();
    },
    cancelConfirm: async function (cancellationId) {
      if (!api()) throw new Error('no_backend');
      var headers = Object.assign({ 'Content-Type': 'application/json' }, authHeaders());
      var r = await fetch(api() + '/api/flights/order/cancel-confirm', { method: 'POST', headers: headers, body: JSON.stringify({ cancellationId: cancellationId }) });
      if (!r.ok) throw new Error('confirm_failed');
      return await r.json();
    },

    /** Modification (rebooking) d'une commande Duffel : devis nouvelle date puis confirmation. */
    changeQuote: async function (orderId, departureDate) {
      if (!api()) throw new Error('no_backend');
      var headers = Object.assign({ 'Content-Type': 'application/json' }, authHeaders());
      var r = await fetch(api() + '/api/flights/order/' + orderId + '/change-quote', { method: 'POST', headers: headers, body: JSON.stringify({ departureDate: departureDate }) });
      if (!r.ok) throw new Error('change_quote_failed');
      return await r.json();
    },
    changeConfirm: async function (changeOfferId) {
      if (!api()) throw new Error('no_backend');
      var headers = Object.assign({ 'Content-Type': 'application/json' }, authHeaders());
      var r = await fetch(api() + '/api/flights/order/change-confirm', { method: 'POST', headers: headers, body: JSON.stringify({ changeOfferId: changeOfferId }) });
      if (!r.ok) throw new Error('change_confirm_failed');
      return await r.json();
    },

    /** Add/register a passport for the logged-in user (private, RLS-protected). */
    addPassport: async function (p) {
      var id = uid(); if (!id || !api()) throw new Error('no_account');
      var headers = Object.assign({ 'Content-Type': 'application/json' }, authHeaders());
      var r = await fetch(api() + '/api/memory/' + id + '/passports', {
        method: 'POST', headers, body: JSON.stringify(p),
      });
      if (!r.ok) { var e = await r.json().catch(function () { return {}; }); throw new Error((e.error && e.error.code) || ('passport_' + r.status)); }
      return await r.json();
    },

    /** Registered travelers for the logged-in user (memory). */
    travelers: async function () {
      var id = uid(); if (!id || !api()) return null;
      try {
        var r = await fetch(api() + '/api/memory/' + id + '/travelers', { headers: authHeaders(), cache: 'no-store' });
        if (!r.ok) return null;
        var j = await r.json();
        return (j && j.items) || [];
      } catch (e) { return null; }
    },

    /** Real places search near coordinates (Google Places) — used for activities. */
    searchActivities: async function (query, lat, lng, radiusKm) {
      if (!api()) throw new Error('no_backend');
      var p = new URLSearchParams({ query: query, language: 'fr' });
      if (lat != null && lng != null) { p.set('lat', String(lat)); p.set('lng', String(lng)); }
      if (radiusKm) p.set('radiusKm', String(radiusKm));
      var r = await fetch(api() + '/api/places/search?' + p.toString(), { cache: 'no-store' });
      if (!r.ok) throw new Error('places_' + r.status);
      var j = await r.json();
      return (j && j.items) || [];
    },

    /** Premium ElevenLabs/Google voice (backend TTS). Returns true if it played. */
    _audio: null,
    speak: async function (text, emotion, opts) {
      opts = opts || {};
      if (!api()) return false;
      try {
        var r = await fetch(api() + '/api/voice/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text, emotion: emotion || 'happy' }),
        });
        if (!r.ok) return false;
        var blob = await r.blob();
        if (!blob || blob.size < 200) return false; // empty/invalid audio
        this.stop();
        var url = URL.createObjectURL(blob);
        var a = new Audio(url);
        this._audio = a;
        var done = function () { try { URL.revokeObjectURL(url); } catch (e) {} if (opts.onprogress) opts.onprogress(1); if (opts.onend) opts.onend(); };
        a.onended = done;
        a.onerror = done;
        if (opts.onprogress) {
          a.ontimeupdate = function () {
            var d = a.duration; if (d && isFinite(d) && d > 0) opts.onprogress(Math.min(1, a.currentTime / d));
          };
        }
        if (opts.onstart) opts.onstart();
        await a.play();
        return true;
      } catch (e) { return false; }
    },
    stop: function () { if (this._audio) { try { this._audio.pause(); } catch (e) {} this._audio = null; } },
  };

  // Pre-warm the backend as soon as the app boots (Render free tier sleeps).
  // By the time the user finishes the intro, the server is awake → no cold-start
  // error on the first message.
  try {
    if (WebbinaLive.configured()) {
      fetch(api() + '/api/health', { cache: 'no-store' }).catch(function () {});
    }
  } catch (e) {}

  window.WebbinaBackend = WebbinaLive;
})();
