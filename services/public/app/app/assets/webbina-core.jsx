/* ============================================================================
   WEBBINA CORE — central conversational engine for TravelFamily.AI
   ----------------------------------------------------------------------------
   Webbina sits at the center. Everything plugs into her through two seams:

     1) AVATAR RENDERERS  (how she is shown)   — registry, swappable at runtime
        active:  Video/Image     future: Live2D · 3D · Unreal Engine · NVIDIA ACE
     2) TRANSPORTS        (how she talks)       — text + voice, swappable
        active:  Scripted demo   future: ElevenLabs agent + OpenAI (via /services)

   The UI never talks to a provider directly — it talks to a Transport that emits
   a normalized event stream (state, emotion, message chunks, audio level).
   ========================================================================== */
const { useState, useRef, useEffect, useCallback } = React;

/* Where the backend (services/) lives. Override with window.WEBBINA_API. */
const WEBBINA_API = (typeof window !== 'undefined' && window.WEBBINA_API) || 'http://localhost:8787';
const WEBBINA_AGENT_ID = 'agent_0001kt43rqqte7ks86mzvavmacjs';

/* ── Emotions ─────────────────────────────────────────────────────────────
   The single source of truth mapping an emotion to its avatar image, label,
   accent color and voice expressiveness (style 0..1 for ElevenLabs).          */
const WEBBINA_EMOTIONS = {
  neutral:      { img: 'happy',        label: 'Sereine',      color: 'ocean', style: 0.20 },
  happy:        { img: 'happy',        label: 'Souriante',    color: 'coral', style: 0.55 },
  focused:      { img: 'focused',      label: 'Réflexion',    color: 'ocean', style: 0.25 },
  reassuring:   { img: 'reassuring',   label: 'Rassurante',   color: 'turq',  style: 0.35 },
  surprised:    { img: 'surprised',    label: 'Surprise',     color: 'gold',  style: 0.70 },
  enthusiastic: { img: 'enthusiastic', label: 'Enthousiaste', color: 'coral', style: 0.85 },
  celebrate:    { img: 'enthusiastic', label: 'Célébration',  color: 'gold',  style: 0.95, party: true },
};
const EMOTION_KEYS = Object.keys(WEBBINA_EMOTIONS);

/* ── Context → emotion director ───────────────────────────────────────────
   The 5 product contexts the brief calls out. The app sets a context and
   Webbina's emotion follows automatically (see setContextEmotion in the hook). */
const WEBBINA_CONTEXTS = {
  welcome:      { emotion: 'happy',        label: 'Accueil',      icon: 'sun' },
  searching:    { emotion: 'focused',      label: 'Recherche',    icon: 'search' },
  recommend:    { emotion: 'enthusiastic', label: 'Recommandation', icon: 'sparkles' },
  formalities:  { emotion: 'reassuring',   label: 'Formalités',   icon: 'shield' },
  booked:       { emotion: 'celebrate',    label: 'Réservation',  icon: 'star' },
};
function contextToEmotion(ctx) { return (WEBBINA_CONTEXTS[ctx] || WEBBINA_CONTEXTS.welcome).emotion; }

/* States Webbina can be in during a turn. */
const WEBBINA_STATES = {
  idle:      { label: 'En ligne',     dot: 'var(--success)' },
  listening: { label: 'À l\'écoute',  dot: 'var(--turq)' },
  thinking:  { label: 'Réfléchit…',   dot: 'var(--gold)' },
  speaking:  { label: 'Vous parle',   dot: 'var(--ocean)' },
};

/* Derive an emotion from free text (used by demo + as a fallback). */
function deriveEmotion(text) {
  const t = (text || '').toLowerCase();
  if (/(génial|parfait|incroyable|coup de cœur|youpi|hâte|rêve)/.test(t)) return 'enthusiastic';
  if (/(promis|rassur|tranquille|je m'occupe|ne vous inquiétez|sécuri)/.test(t)) return 'reassuring';
  if (/(analyse|compare|vérifie|cherche|calcul|regarde)/.test(t)) return 'focused';
  if (/(oh|waouh|surpren|étonnant|vraiment\s*\?)/.test(t)) return 'surprised';
  if (/(bonjour|ravie|avec plaisir|super|bienvenue)/.test(t)) return 'happy';
  return 'happy';
}

/* ── Avatar renderer registry ─────────────────────────────────────────────
   A renderer is a React component receiving { state, emotion, audioLevel, size }.
   Register future engines here; the dedicated Avatar Stage swaps between them.  */
const AVATAR_RENDERERS = [];
function registerAvatarRenderer(def) { AVATAR_RENDERERS.push(def); }
function getAvatarRenderer(id) { return AVATAR_RENDERERS.find(r => r.id === id) || AVATAR_RENDERERS[0]; }

/* Active renderer: a LIVING portrait — breathes, blinks, sways, micro-expresses,
   and reacts to Webbina's state. Driven by a single rAF loop writing CSS vars. */
function VideoAvatarRenderer({ emotion, state, audioLevel, size = 240 }) {
  const emo = WEBBINA_EMOTIONS[emotion] || WEBBINA_EMOTIONS.happy;
  const wrapRef = useRef(null);
  const stateRef = useRef(state);
  const audioRef = useRef(0);
  const [confetti, setConfetti] = useState(0);
  stateRef.current = state;
  audioRef.current = audioLevel || 0;

  // One rAF loop for the whole life-system.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let raf;
    const t0 = performance.now();
    let nextBlink = 900 + Math.random() * 2200;
    let blinkUntil = -1;
    let nextMicro = 4000 + Math.random() * 4000;
    let microUntil = -1, microKind = 0;
    let swayX = 0, swayRot = 0, tgtX = 0, tgtRot = 0, reTarget = 0;

    const frame = (now) => {
      const t = now - t0;
      const st = stateRef.current;

      // 1) Breathing — faster when speaking/listening, calm at idle.
      const period = st === 'speaking' ? 1700 : st === 'listening' ? 2100 : 3000;
      const breath = Math.sin((t / period) * Math.PI * 2); // -1..1

      // 2) Head sway — drift toward a new soft target every few seconds.
      if (t > reTarget) {
        tgtX = Math.random() * 2 - 1;
        tgtRot = Math.random() * 2 - 1;
        reTarget = t + 2400 + Math.random() * 2600;
      }
      const ease = st === 'thinking' ? 0.05 : 0.022;
      swayX += (tgtX - swayX) * ease;
      swayRot += (tgtRot - swayRot) * ease;
      // Thinking → a gentle continuous tilt loop layered on top.
      const think = st === 'thinking' ? Math.sin(t / 700) : 0;

      // 3) Blink — quick eyelid shutter; occasional double-blink.
      if (t > nextBlink) {
        blinkUntil = t + 120;
        nextBlink = t + 2200 + Math.random() * 3400;
        if (Math.random() < 0.22) nextBlink = t + 300; // double blink
      }
      const blinking = t < blinkUntil;
      const blink = blinking ? Math.sin(((t - (blinkUntil - 120)) / 120) * Math.PI) : 0; // 0..1..0

      // 4) Micro-expression — a tiny nod or brow-pop now and then (idle only).
      if (st === 'idle' && t > nextMicro) {
        microUntil = t + 620;
        microKind = Math.floor(Math.random() * 2);
        nextMicro = t + 5200 + Math.random() * 5200;
      }
      const micro = t < microUntil ? Math.sin(((t - (microUntil - 620)) / 620) * Math.PI) : 0;

      // 5) Speaking — mouth/energy pulse from live audio level.
      const speak = st === 'speaking' ? audioRef.current : 0;

      // Compose
      const tx = swayX * 4 + (microKind === 1 ? micro * 2 : 0);
      const ty = breath * -2.4 - (microKind === 0 ? micro * 3 : 0) + speak * -1.5;
      const rot = swayRot * 1.6 + think * 1.8 + (microKind === 1 ? micro * 1.5 : 0);
      const sy = 1 + breath * 0.012 + speak * 0.03 - blink * 0.0; // breath scale
      const sx = 1 + speak * 0.012;

      el.style.setProperty('--tx', tx.toFixed(2) + 'px');
      el.style.setProperty('--ty', ty.toFixed(2) + 'px');
      el.style.setProperty('--rot', rot.toFixed(2) + 'deg');
      el.style.setProperty('--sx', sx.toFixed(3));
      el.style.setProperty('--sy', sy.toFixed(3));
      el.style.setProperty('--blink', blink.toFixed(2));
      el.style.setProperty('--speak', speak.toFixed(2));

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Celebration burst when she reaches the "celebrate" emotion.
  useEffect(() => {
    if (emo.party) setConfetti((n) => n + 1);
  }, [emo.party]);

  const speaking = state === 'speaking';
  return (
    <div ref={wrapRef} className={`wv-avatar living state-${state} emo-${emotion}`} style={{ width: size, height: size }}>
      <div className={`wv-aura wv-aura--${emo.color} ${state}`} />
      <div className="wv-ring" />
      <div className="wv-body">
        <img className="wv-portrait" src={`assets/webbina-${emo.img}.png`} alt="Webbina" />
        {/* eyelid shutter for blinking — feathered band over the eye line */}
        <span className="wv-lid" aria-hidden="true" />
      </div>
      {speaking && (
        <div className="wv-wave" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => <span key={i} style={{ animationDelay: `${i * 0.08}s` }} />)}
        </div>
      )}
      {emo.party && (
        <div className="wv-confetti" key={confetti} aria-hidden="true">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} style={{
              left: `${(i * 5.5 + 4) % 100}%`,
              background: ['var(--ocean)', 'var(--turq)', 'var(--coral)', 'var(--gold)'][i % 4],
              animationDelay: `${(i % 6) * 0.12}s`,
              transform: `rotate(${i * 40}deg)`,
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

/* Future renderers: a real "slot" that shows the contract + a graceful fallback. */
function makeSoonRenderer(name, note) {
  return function SoonRenderer({ emotion, size = 240 }) {
    const emo = WEBBINA_EMOTIONS[emotion] || WEBBINA_EMOTIONS.happy;
    return (
      <div className="wv-avatar wv-soon" style={{ width: size, height: size }}>
        <img className="wv-portrait wv-ghost" src={`assets/webbina-${emo.img}.png`} alt="" />
        <div className="wv-soon-badge">
          <b>{name}</b>
          <span>{note}</span>
          <em>Emplacement prêt · &lt;AvatarSlot renderer="{name}" /&gt;</em>
        </div>
      </div>
    );
  };
}

registerAvatarRenderer({ id: 'video',  label: 'Vidéo vivante', icon: 'camera',   status: 'active', Component: VideoAvatarRenderer });
registerAvatarRenderer({ id: 'live2d', label: 'Live2D',        icon: 'sparkles', status: 'soon',   Component: makeSoonRenderer('Live2D', 'Rig 2D animé, lip-sync sur les visèmes audio.') });
registerAvatarRenderer({ id: '3d',     label: 'Avatar 3D',     icon: 'balloon',  status: 'soon',   Component: makeSoonRenderer('Avatar 3D', 'glTF/VRM via three.js, blendshapes d\'émotion.') });
registerAvatarRenderer({ id: 'unreal', label: 'Unreal Engine', icon: 'compass',  status: 'soon',   Component: makeSoonRenderer('Unreal Engine', 'MetaHuman streamé via Pixel Streaming.') });
registerAvatarRenderer({ id: 'ace',    label: 'NVIDIA ACE',    icon: 'star',     status: 'soon',   Component: makeSoonRenderer('NVIDIA ACE', 'Audio2Face + Riva, lip-sync neuronal temps réel.') });

Object.assign(window, {
  WEBBINA_API, WEBBINA_AGENT_ID, WEBBINA_EMOTIONS, EMOTION_KEYS, WEBBINA_STATES,
  WEBBINA_CONTEXTS, contextToEmotion,
  deriveEmotion, AVATAR_RENDERERS, registerAvatarRenderer, getAvatarRenderer,
  VideoAvatarRenderer,
});
