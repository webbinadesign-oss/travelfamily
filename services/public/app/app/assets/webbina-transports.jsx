/* ============================================================================
   WEBBINA TRANSPORTS — how Webbina talks (text + voice), swappable adapters.
   Every transport emits the SAME normalized events so the UI never changes:
     onState(state)            idle|listening|thinking|speaking
     onEmotion(emotion)
     onUserMessage(text)       (e.g. a voice transcript)
     onAgentStart()
     onAgentChunk(text)        streamed token(s) for dynamic display
     onAgentDone({suggestions, action})
     onAudioLevel(0..1)        drives avatar mouth/pulse
     onError(code, message)
     onStatus(connected:boolean, label)
   ========================================================================== */

class WebbinaTransport {
  constructor(handlers = {}) { this.h = handlers; this.connected = false; }
  emit(name, ...args) { const fn = this.h[name]; if (fn) fn(...args); }
  async connect() { this.connected = true; this.emit('onStatus', true, this.label); }
  async disconnect() { this.connected = false; this.emit('onStatus', false, this.label); }
  async sendText(_text) { throw new Error('not implemented'); }
  async startVoice() { throw new Error('voice not implemented'); }
  async stopVoice() {}
  get id() { return 'base'; }
  get label() { return 'Base'; }
  get mode() { return 'none'; }
}

/* ── 1) Scripted demo transport — works with zero backend ─────────────────── */
const DEMO_BRAIN = [
  { re: /(plage|soleil|mer|chaud|baln)/, emotion: 'enthusiastic',
    reply: "Le soleil, j'adore&nbsp;! 🌞 Pour une plage en famille, je pense tout de suite à Bali, la Sicile ou l'Algarve. Vous préférez rester en Europe ou partir plus loin&nbsp;?",
    suggestions: ['Rester en Europe', 'Partir plus loin', 'Peu importe'] },
  { re: /(budget|prix|cher|coûte|économ|€|euro)/, emotion: 'reassuring',
    reply: "On reste dans votre budget, promis. 💶 Donnez-moi votre enveloppe totale et je compose le meilleur équilibre entre vols, hôtel et activités.",
    suggestions: ['Environ 2000 €', 'Environ 3000 €', 'Flexible'] },
  { re: /(enfant|famille|bébé|ado|kids|petit)/, emotion: 'reassuring',
    reply: "Avec des enfants, je privilégie les vols directs, les hôtels avec club kids et un rythme doux. 👨‍👩‍👧 Quel âge ont-ils&nbsp;?",
    suggestions: ['0–5 ans', '6–11 ans', 'Ados'] },
  { re: /(visa|passeport|formalit|papier|document)/, emotion: 'focused',
    reply: "Je vérifie ça tout de suite&nbsp;: visa, validité des passeports, vaccins et conseils officiels. ✅ Pour quelle destination&nbsp;?",
    suggestions: ['Bali', 'Maroc', 'Canada'] },
  { re: /(montagne|nature|rando|lac|vert)/, emotion: 'happy',
    reply: "La nature, quelle belle idée pour se ressourcer en famille&nbsp;! 🏔️ Les Alpes, les Dolomites ou la Norvège vous tentent&nbsp;?",
    suggestions: ['Les Alpes', 'Les Dolomites', 'La Norvège'] },
  { re: /(quand|date|mois|été|hiver|août|juillet|vacances)/, emotion: 'focused',
    reply: "Parfait, les dates m'aident à viser le meilleur prix. 🗓️ Vous partez plutôt cet été, à la Toussaint, ou vous êtes flexible&nbsp;?",
    suggestions: ['Cet été', 'À la Toussaint', 'Flexible'] },
];
const DEMO_DEFAULT = {
  emotion: 'happy',
  reply: "Avec plaisir&nbsp;! Racontez-moi votre famille et l'ambiance que vous cherchez, et je vous compose un voyage sur-mesure. ✨",
  suggestions: ['Du soleil ☀️', 'De la nature 🌿', 'Petit budget 💶'],
};

class ScriptedTransport extends WebbinaTransport {
  get id() { return 'demo'; }
  get label() { return 'Démo (scripté)'; }
  get mode() { return 'text+voice (simulé)'; }

  async connect() {
    await super.connect();
    // Greeting
    this._respondWith({
      emotion: 'happy',
      reply: "Bonjour, je suis <b>Webbina</b>, votre conseillère de voyage. 🌍 Où rêvez-vous de partir en famille&nbsp;?",
      suggestions: ['Du soleil ☀️', 'Une aventure 🎒', 'Surprenez-moi ✨'],
    }, 350);
  }

  _match(text) {
    for (const item of DEMO_BRAIN) if (item.re.test(text.toLowerCase())) return item;
    return DEMO_DEFAULT;
  }

  async sendText(text) {
    this.emit('onUserMessage', text);
    const answer = this._match(text);
    this.emit('onState', 'thinking');
    this.emit('onEmotion', 'focused');
    setTimeout(() => this._respondWith(answer, 0), 700 + Math.random() * 500);
  }

  _respondWith(answer, delay) {
    setTimeout(() => {
      this.emit('onEmotion', answer.emotion);
      this.emit('onState', 'speaking');
      this.emit('onAgentStart');
      // stream word by word for dynamic display + fake audio level
      const words = answer.reply.split(' ');
      let i = 0;
      const audio = setInterval(() => this.emit('onAudioLevel', 0.35 + Math.random() * 0.65), 90);
      const tick = setInterval(() => {
        this.emit('onAgentChunk', (i === 0 ? '' : ' ') + words[i]);
        if (++i >= words.length) {
          clearInterval(tick); clearInterval(audio);
          this.emit('onAudioLevel', 0);
          this.emit('onAgentDone', { suggestions: answer.suggestions || [] });
          this.emit('onState', 'idle');
        }
      }, 55);
    }, delay);
  }

  async startVoice() {
    this.emit('onState', 'listening');
    this.emit('onStatus', true, 'Micro actif (démo)');
    const phrases = ['On aimerait du soleil en août', 'On a un budget de 3000 euros', 'On part avec deux enfants'];
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    this._voiceTimer = setTimeout(() => this.sendText(phrase), 1800);
  }
  async stopVoice() { clearTimeout(this._voiceTimer); this.emit('onState', 'idle'); }
}

/* ── 1b) Memory demo — a RETURNING user, greeted with recalled context ─────
   Showcases Webbina Memory without a backend: she opens with the personalised
   line and adapts her first suggestions. Mirrors GET /api/memory/:id/greeting. */
const DEMO_MEMORY = {
  profile: { preferredCabin: 'Premium', homeCity: 'Marseille', typicalBudget: 3200, currency: 'EUR' },
  travelers: '4 voyageurs habituels (vous, Camille, et 2 enfants)',
  lastTrip: 'Lisbonne, en octobre dernier',
  greeting:
    'Bonjour, vous voyagez habituellement en classe <b>Premium</b> au départ de <b>Marseille</b>. ' +
    'Souhaitez-vous que je recherche des options similaires&nbsp;?',
};
class MemoryDemoTransport extends ScriptedTransport {
  get id() { return 'memory'; }
  get label() { return 'Démo Mémoire'; }
  get mode() { return 'mémoire (simulée)'; }

  async connect() {
    this.connected = true;
    this.emit('onStatus', true, 'Profil reconnu · Webbina Memory');
    this.emit('onEmotion', 'reassuring');
    // Brief "recalling" beat, then the personalised greeting.
    this.emit('onState', 'thinking');
    setTimeout(() => {
      this._respondWith({
        emotion: 'happy',
        reply: DEMO_MEMORY.greeting,
        suggestions: ['Oui, des options similaires ✨', 'Changer de critères', 'Voir mes voyages'],
      }, 0);
    }, 900);
  }

  async sendText(text) {
    this.emit('onUserMessage', text);
    const t = text.toLowerCase();
    if (/(similaire|oui|premium|repart)/.test(t)) {
      this.emit('onState', 'thinking'); this.emit('onEmotion', 'focused');
      setTimeout(() => this._respondWith({
        emotion: 'enthusiastic',
        reply: `Parfait&nbsp;! Je relance une recherche en <b>Premium au départ de Marseille</b>, ` +
               `pour votre budget habituel d'environ <b>3200&nbsp;€</b>. 🌍 Une destination soleil comme la dernière fois&nbsp;?`,
        suggestions: ['Oui, du soleil ☀️', 'Plutôt une ville 🏛️', 'Surprends-moi ✨'],
      }, 0), 800);
      return;
    }
    if (/(voyage|historique|lisbonne)/.test(t)) {
      this.emit('onState', 'thinking');
      setTimeout(() => this._respondWith({
        emotion: 'happy',
        reply: `Votre dernier voyage était <b>${DEMO_MEMORY.lastTrip}</b>, avec ${DEMO_MEMORY.travelers}. ` +
               `Voulez-vous repartir sur une ambiance similaire&nbsp;?`,
        suggestions: ['Oui, similaire', 'Non, autre chose'],
      }, 0), 700);
      return;
    }
    // fall back to the scripted brain for everything else
    super.sendText(text);
  }
}

/* ── 2) Live transport — ElevenLabs agent (voice) + OpenAI (text) via /services
   Wired to the backend in /services. Text uses POST /api/chat (SSE stream);
   voice opens the agent WebSocket via a signed URL from /api/voice/agent-url.
   Falls back with a clear error if the backend isn't running.                 */
class LiveTransport extends WebbinaTransport {
  constructor(handlers, opts = {}) {
    super(handlers);
    this.api = opts.api || WEBBINA_API;
    this.userId = opts.userId || (typeof window !== 'undefined' && window.WEBBINA_USER_ID) || null;
    this.history = [];
    this.convo = null; // ElevenLabs SDK Conversation instance
  }
  get id() { return 'live'; }
  get label() { return 'ElevenLabs + OpenAI'; }
  get mode() { return 'live (backend requis)'; }

  /** Auth header (Bearer token) when the user is logged in. */
  _authHeaders() {
    try { return (typeof window.webbinaAuthHeaders === 'function') ? window.webbinaAuthHeaders() : {}; }
    catch { return {}; }
  }

  /** Fetch the personalised memory greeting, if a user is known + backend up. */
  async _fetchGreeting() {
    // Prefer the authenticated user id over any preset id.
    const authId = (typeof window !== 'undefined' && window.WebbinaAuth) ? window.WebbinaAuth.getUserId() : null;
    const uid = authId || this.userId;
    if (!uid) return null;
    this.userId = uid;
    try {
      const r = await fetch(`${this.api}/api/memory/${uid}/greeting`, { headers: this._authHeaders() });
      if (!r.ok) return null;
      const g = await r.json();
      return g && g.greeting ? g : null;
    } catch { return null; }
  }

  async connect() {
    // Probe backend health so the UI can show a truthful status.
    try {
      const r = await fetch(`${this.api}/api/health`, { method: 'GET' });
      if (!r.ok) throw new Error('health ' + r.status);
      const h = await r.json();
      this.connected = true;
      this.emit('onStatus', true, 'Backend connecté');
      this.emit('onEmotion', 'reassuring');
      this.emit('onAgentStart');
      // Webbina recalls the user (Memory module) and greets with context.
      const mem = await this._fetchGreeting();
      const hello = mem?.greeting
        || 'Bonjour, je suis Webbina, connectée en direct. Comment puis-je vous aider à voyager ?';
      this.emit('onAgentChunk', hello);
      const suggestions = mem?.returning
        ? ['Oui, des options similaires', 'Changer de critères', 'Voir mes voyages']
        : ['Du soleil ☀️', 'Un city-trip 🏛️', 'Formalités 🛂'];
      this.emit('onAgentDone', { suggestions, health: h, memory: mem || undefined });
      this.emit('onEmotion', mem?.returning ? 'happy' : 'happy');
      this.emit('onState', 'idle');
    } catch (e) {
      this.connected = false;
      this.emit('onStatus', false, 'Backend hors-ligne');
      this.emit('onError', 'backend_unreachable',
        `Backend introuvable sur ${this.api}. Démarrez /services (npm run dev) ou basculez en mode Démo.`);
    }
  }

  async sendText(text) {
    this.emit('onUserMessage', text);
    this.history.push({ role: 'user', content: text });
    this.emit('onState', 'thinking');
    this.emit('onEmotion', 'focused');
    try {
      const res = await fetch(`${this.api}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: this.history, stream: true }),
      });
      if (!res.ok || !res.body) throw new Error('chat ' + res.status);

      this.emit('onState', 'speaking');
      this.emit('onAgentStart');
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '', full = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop() || '';
        for (const line of lines) {
          const s = line.trim();
          if (!s.startsWith('data:')) continue;
          const payload = s.slice(5).trim();
          if (payload === '[DONE]') continue;
          try { const j = JSON.parse(payload); if (j.token) { full += j.token; this.emit('onAgentChunk', j.token); } } catch {}
        }
      }
      this.history.push({ role: 'assistant', content: full });
      this.emit('onEmotion', deriveEmotion(full));
      this.emit('onAgentDone', { suggestions: [] });
      this.emit('onState', 'idle');
      // Persist this exchange + any detected preferences (logged-in users only).
      this._persistTurn(text, full);
    } catch (e) {
      this.emit('onError', 'chat_failed', 'La réponse en direct a échoué — vérifiez le backend /services.');
      this.emit('onState', 'idle');
    }
  }

  /** Current authenticated user id (or preset), or null. */
  _uid() {
    const authId = (typeof window !== 'undefined' && window.WebbinaAuth) ? window.WebbinaAuth.getUserId() : null;
    return authId || this.userId || null;
  }

  /** Fire-and-forget: store the exchange + extracted prefs. Never blocks the UI. */
  async _persistTurn(userText, assistantText) {
    const uid = this._uid();
    if (!uid) return; // anonymous → nothing to remember
    const headers = { 'Content-Type': 'application/json', ...this._authHeaders() };

    // 1) Append the conversation memory (user + assistant turns).
    try {
      await fetch(`${this.api}/api/memory/${uid}/conversation`, {
        method: 'POST', headers,
        body: JSON.stringify({ entries: [
          { kind: 'message', role: 'user', content: userText },
          { kind: 'message', role: 'assistant', content: assistantText, emotion: deriveEmotion(assistantText) },
        ] }),
      });
    } catch {}

    // 2) Extract durable preferences from the user's words → update profile.
    const patch = extractPreferences(userText);
    if (patch && Object.keys(patch).length) {
      try {
        await fetch(`${this.api}/api/memory/${uid}/profile`, {
          method: 'PUT', headers, body: JSON.stringify(patch),
        });
      } catch {}
    }
  }

  /* Opens the ElevenLabs Conversational AI agent via a signed URL (key stays
     server-side), using the official @elevenlabs/client SDK loaded on demand. */
  async startVoice() {
    this.emit('onState', 'listening');
    try {
      const r = await fetch(`${this.api}/api/voice/agent-url`);
      if (!r.ok) throw new Error('agent-url ' + r.status);
      const { signedUrl } = await r.json();

      // Load the SDK on demand (ESM from CDN). No bundler required.
      const mod = await loadElevenLabsSDK();
      if (!mod || !mod.Conversation) {
        throw new Error('sdk_unavailable');
      }

      // Real-time voice session. Events are normalized into our transport API.
      this.convo = await mod.Conversation.startSession({
        signedUrl,
        onConnect: () => this.emit('onStatus', true, 'Agent vocal connecté'),
        onDisconnect: () => { this.emit('onStatus', this.connected, 'Agent vocal terminé'); this.emit('onState', 'idle'); },
        onError: (msg) => this.emit('onError', 'voice_error', String(msg)),
        onModeChange: ({ mode }) =>
          this.emit('onState', mode === 'speaking' ? 'speaking' : 'listening'),
        onMessage: ({ message, source }) => {
          if (source === 'user') { this.emit('onUserMessage', message); }
          else {
            this.emit('onAgentStart');
            this.emit('onAgentChunk', message);
            this.emit('onEmotion', deriveEmotion(message));
            this.emit('onAgentDone', { suggestions: [] });
          }
        },
        // Drive the avatar mouth/pulse from the live output volume.
        onAudio: (level) => this.emit('onAudioLevel', typeof level === 'number' ? level : 0.6),
      });
    } catch (e) {
      const offline = String(e && e.message);
      this.emit('onError', 'voice_unavailable',
        offline === 'sdk_unavailable'
          ? 'SDK ElevenLabs indisponible (hors-ligne). La voix nécessite une connexion + le backend.'
          : 'Connexion vocale indisponible — le backend doit fournir une URL signée ElevenLabs.');
      this.emit('onState', 'idle');
    }
  }
  async stopVoice() {
    try { await this.convo?.endSession?.(); } catch {}
    this.convo = null;
    this.emit('onState', 'idle');
  }
}

/* Lazy ESM loader for the ElevenLabs browser SDK. Cached after first load.
   Tries several CDNs/versions so a single bad URL never breaks the voice. */
let _elevenSDK;
function loadElevenLabsSDK() {
  if (_elevenSDK !== undefined) return _elevenSDK;
  _elevenSDK = (async () => {
    const sources = [
      'https://esm.sh/@elevenlabs/client@0.3.0',
      'https://cdn.jsdelivr.net/npm/@elevenlabs/client@0.3.0/+esm',
      'https://esm.sh/@elevenlabs/client',
      'https://cdn.jsdelivr.net/npm/@elevenlabs/client/+esm',
    ];
    for (const url of sources) {
      try {
        const importer = (typeof window !== 'undefined' && window.__webbinaImport)
          ? window.__webbinaImport            // native import() from a plain <script>
          : (u) => import(/* webpackIgnore: true */ u);
        const mod = await importer(url);
        if (mod && mod.Conversation) return mod;
      } catch (e) { /* try next source */ }
    }
    return null;
  })();
  return _elevenSDK;
}

/* Detect durable travel preferences from a user's sentence (FR).
   Returns a partial profile patch, or {} if nothing reliable found. */
function extractPreferences(text) {
  const t = (text || '').toLowerCase();
  const patch = {};
  // Cabin class
  if (/premium/.test(t)) patch.preferredCabin = 'PREMIUM_ECONOMY';
  else if (/business|affaires/.test(t)) patch.preferredCabin = 'BUSINESS';
  else if (/first class|premiere classe|1ere classe/.test(t)) patch.preferredCabin = 'FIRST';
  else if (/economique|\beco\b|\beco\b/.test(t)) patch.preferredCabin = 'ECONOMY';
  // Home city / airport (common FR departure cities)
  const cities = { marseille:'MRS', paris:'PAR', lyon:'LYS', nice:'NCE', toulouse:'TLS', bordeaux:'BOD', nantes:'NTE', lille:'LIL', geneve:'GVA', bruxelles:'BRU' };
  for (const [name, iata] of Object.entries(cities)) {
    if (new RegExp(`\\b${name}\\b`).test(t)) {
      patch.homeCity = name.charAt(0).toUpperCase() + name.slice(1);
      patch.homeAirport = iata; break;
    }
  }
  // Typical budget (e.g. "3000 euros", "budget de 2500 eur")
  const m = t.match(/(\d[\d\s]{2,6})\s*(euros?|eur|\u20ac)\b/);
  if (m) {
    const amount = parseInt(m[1].replace(/\s/g, ''), 10);
    if (amount >= 100 && amount <= 100000) { patch.typicalBudget = amount; patch.budgetCurrency = 'EUR'; }
  }
  return patch;
}

const WEBBINA_TRANSPORTS = [
  { id: 'demo', label: 'Démo (scripté)', icon: 'sparkles', make: (h) => new ScriptedTransport(h) },
  { id: 'memory', label: 'Démo Mémoire', icon: 'briefcase', make: (h) => new MemoryDemoTransport(h) },
  { id: 'live', label: 'ElevenLabs + OpenAI', icon: 'mic', make: (h) => new LiveTransport(h) },
];
function getTransportDef(id) { return WEBBINA_TRANSPORTS.find(t => t.id === id) || WEBBINA_TRANSPORTS[0]; }

Object.assign(window, { WebbinaTransport, ScriptedTransport, MemoryDemoTransport, LiveTransport, WEBBINA_TRANSPORTS, getTransportDef });
