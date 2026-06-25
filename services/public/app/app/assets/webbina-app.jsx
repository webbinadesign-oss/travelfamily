/* ============================================================================
   Architecture view + the root WebbinaConsoleApp (Console ↔ Architecture tabs).
   ========================================================================== */
function ArchitectureView() {
  const layers = [
    { k: 'avatar', title: 'Zone Avatar', icon: 'camera', color: 'turq',
      desc: 'Rendu interchangeable, piloté par l\'émotion + l\'état.',
      items: ['Vidéo / Image (actif)', 'Live2D', 'Avatar 3D (three.js / VRM)', 'Unreal Engine (Pixel Streaming)', 'NVIDIA ACE (Audio2Face)'] },
    { k: 'core', title: 'Webbina Core', icon: 'sparkles', color: 'coral',
      desc: 'Le cœur : émotions, états, hook useWebbina, registre des rendus.',
      items: ['Émotions (6)', 'États (idle/listening/thinking/speaking)', 'Streaming des réponses', 'Événements normalisés'] },
    { k: 'transport', title: 'Transports', icon: 'mic', color: 'ocean',
      desc: 'Comment Webbina parle — texte + voix, adaptateurs interchangeables.',
      items: ['Démo scripté', 'Démo Mémoire', 'ElevenLabs SDK (agent vocal)', 'OpenAI (cerveau, /api/chat)'] },
    { k: 'memory', title: 'Webbina Memory', icon: 'briefcase', color: 'turq',
      desc: 'Elle se souvient : profil, voyageurs, passeports, préférences, historique. Contexte récupéré à chaque nouvelle conversation.',
      items: ['7 tables Supabase + RLS', 'Résumé auto des préférences', 'Greeting contextuel', '/api/memory/:id/context'] },
    { k: 'services', title: 'Services backend', icon: 'globe', color: 'gold',
      desc: 'Dossier /services — la clé reste côté serveur.',
      items: ['OpenAI', 'ElevenLabs', 'Amadeus', 'Google Maps', 'OpenWeather', 'Supabase'] },
  ];
  return (
    <div className="arch">
      <div className="arch-head">
        <span className="arch-eyebrow">Architecture</span>
        <h2>Webbina au centre de l'expérience</h2>
        <p>Une conseillère vivante : chaque couche se branche sur elle par une couture stable. On remplace un moteur d'avatar ou un fournisseur sans toucher à l'interface.</p>
      </div>

      <div className="arch-flow">
        {layers.map((l, i) => (
          <React.Fragment key={l.k}>
            <div className={`arch-card a-${l.color}`}>
              <div className="arch-ic"><WIcon n={l.icon} size={22} /></div>
              <b>{l.title}</b>
              <p>{l.desc}</p>
              <ul>{l.items.map((it) => <li key={it}>{it}</li>)}</ul>
            </div>
            {i < layers.length - 1 && <div className="arch-link"><WIcon n="chevronDown" size={20} /></div>}
          </React.Fragment>
        ))}
      </div>

      <div className="arch-note">
        <img src="assets/webbina-reassuring.png" alt="" />
        <div>
          <b>Connexion ElevenLabs — agent <code>{WEBBINA_AGENT_ID}</code></b>
          <p>Le navigateur demande une <b>URL signée</b> à <code>/api/voice/agent-url</code>, puis ouvre le WebSocket de l'agent. La clé API ne quitte jamais le serveur. L'adaptateur <code>LiveTransport</code> est déjà câblé sur cette route.</p>
        </div>
      </div>
    </div>
  );
}

function ConnexionPanel() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState((typeof window !== 'undefined' && window.WEBBINA_API) || '');
  const [health, setHealth] = useState(null); // null | 'checking' | object | 'error'
  const isLocal = /localhost|127\.0\.0\.1/.test(url || '');

  async function test() {
    setHealth('checking');
    try {
      const base = String(url).trim().replace(/\/+$/, '');
      const r = await fetch(`${base}/api/health`);
      if (!r.ok) throw new Error('http ' + r.status);
      setHealth(await r.json());
    } catch (e) { setHealth('error'); }
  }
  function connect() {
    const clean = window.WebbinaConfig.setApi(url);
    // reload so every transport picks up the new backend address
    window.location.reload();
    return clean;
  }

  return (
    <div className="cx-wrap">
      <button className={`cx-btn ${isLocal ? '' : 'cx-on'}`} onClick={() => setOpen(o => !o)} title="Connexion backend">
        <WIcon n="globe" size={15} />
        <span>{isLocal ? 'Local' : 'En ligne'}</span>
      </button>
      {open && (
        <div className="cx-pop">
          <b>Connexion au backend</b>
          <p>Collez l'adresse de votre backend <code>/services</code> déployé, puis testez la connexion.</p>
          <input className="cx-input" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://votre-backend.onrender.com" />
          <div className="cx-row">
            <button className="cx-test" onClick={test}>Tester</button>
            <button className="cx-connect" onClick={connect}>Connecter</button>
          </div>
          {health === 'checking' && <div className="cx-status">Vérification…</div>}
          {health === 'error' && <div className="cx-status cx-err">Injoignable — vérifiez l'URL et que le backend tourne.</div>}
          {health && typeof health === 'object' && (
            <div className="cx-status cx-ok">
              ✅ Backend en ligne · intégrations actives&nbsp;:
              <div className="cx-ints">
                {Object.entries(health.integrations || {}).map(([k, v]) => (
                  <span key={k} className={v ? 'on' : ''}>{k}</span>
                ))}
              </div>
            </div>
          )}
          <div className="cx-hint">Astuce&nbsp;: après « Connecter », choisissez le transport <b>ElevenLabs + OpenAI</b> dans la conversation.</div>
        </div>
      )}
    </div>
  );
}

function WebbinaConsoleApp() {
  const [tab, setTab] = useState('console');         // console | architecture
  const [transportId, setTransportId] = useState('demo');
  const [rendererId, setRendererId] = useState('video');
  const wb = useWebbina(transportId);
  const auth = (typeof useWebbinaAuth !== 'undefined') ? useWebbinaAuth() : { user: null };
  const switchedRef = React.useRef(false);

  // When the user logs in, switch to the live transport ONCE so Webbina greets
  // them with their stored memory ("vous voyagez habituellement en Premium…").
  React.useEffect(() => {
    if (auth && auth.user && !switchedRef.current) {
      switchedRef.current = true;
      setTransportId('live');
    }
    if (auth && !auth.user) switchedRef.current = false; // reset on logout
  }, [auth && auth.user]);

  return (
    <div className="wc-shell">
      <header className="wc-header">
        <div className="brandmark"><img src="assets/logo-mark.png" alt="" /><span className="wm">Travel<b>Family</b>.AI</span></div>
        <nav className="wc-tabs">
          <button className={tab === 'console' ? 'on' : ''} onClick={() => setTab('console')}>Console</button>
          <button className={tab === 'architecture' ? 'on' : ''} onClick={() => setTab('architecture')}>Architecture</button>
        </nav>
        <div className="wc-head-right">
          {typeof AuthButton !== 'undefined' && <AuthButton />}
          <ConnexionPanel />
          <div className="wc-agent"><span className="agent-dot" />Agent <code>{WEBBINA_AGENT_ID.slice(0, 14)}…</code></div>
        </div>
      </header>

      {tab === 'console' ? (
        <main className="wc-main">
          <section className="wc-stage-col">
            <AvatarStage emotion={wb.emotion} state={wb.state} audioLevel={wb.audioLevel} rendererId={rendererId} onRenderer={setRendererId} onContext={wb.setContext} />
          </section>
          <section className="wc-convo-col">
            <ConversationPanel wb={wb} transportId={transportId} onTransport={setTransportId} />
          </section>
        </main>
      ) : (
        <main className="wc-main wc-main--arch"><ArchitectureView /></main>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('app')).render(<WebbinaConsoleApp />);
