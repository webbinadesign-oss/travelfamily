/* TravelFamily.AI app — Welcome animation, Auth, Home */

/* WebbinaLive — plays the welcome video, keys out the white background in real
   time onto a canvas (true transparency on the dark portal), bakes a subtle
   hologram look, and exposes her voice. */
function WebbinaLive({ active, onEnded }) {
  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const rafRef = React.useRef(0);
  const phaseRef = React.useRef(0);
  const [ready, setReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [raw, setRaw] = React.useState(false); // CORS taint → show animated video without keying
  const [frozen, setFrozen] = React.useState(false); // clip finished -> show calm standing portrait

  React.useEffect(()=>{
    const v = videoRef.current, c = canvasRef.current;
    if(!v || !c) return;
    // MOBILE-SAFE: per-frame 600×600 pixel keying freezes phones. On touch/small
    // devices, skip the canvas entirely and show the static portrait (still speaks via TTS).
    const isMobile = (typeof matchMedia!=='undefined' && matchMedia('(pointer: coarse)').matches) || (typeof innerWidth!=='undefined' && innerWidth <= 820) || (navigator.maxTouchPoints||0) > 0;
    if(isMobile){ try{ v.pause(); }catch(e){} setFailed(true); return; }
    const ctx = c.getContext('2d', { willReadFrequently:true });
    let scratch, sctx, running = true, didSetup = false;

    function setup(){
      if(didSetup) return; didSetup = true;
      const S = 600;                 // processing resolution (square)
      c.width = S; c.height = S;
      scratch = document.createElement('canvas'); scratch.width=S; scratch.height=S;
      sctx = scratch.getContext('2d', { willReadFrequently:true });
      setReady(true);
      loop();
    }

    function loop(){
      if(!running) return;
      rafRef.current = requestAnimationFrame(loop);
      if(v.readyState < 2 || v.videoWidth===0) return;
      const S = c.width;
      sctx.drawImage(v, 0, 0, S, S);
      let frame;
      try { frame = sctx.getImageData(0,0,S,S); } catch(e){ running=false; setRaw(true); return; }
      const d = frame.data;
      phaseRef.current = (phaseRef.current + 1.1) % 1000;
      const ph = phaseRef.current;
      for(let i=0, p=0; i<d.length; i+=4, p++){
        const r=d[i], g=d[i+1], b=d[i+2];
        const mn = r<g?(r<b?r:b):(g<b?g:b);
        const mx = r>g?(r>b?r:b):(g>b?g:b);
        const sat = mx - mn;
        // background = bright + low-saturation. Webbina's body is always warm/saturated,
        // so saturation is the safe discriminator; brightness drives the soft edge.
        let a = 255;
        if(sat <= 16){
          if(mn >= 230) a = 0;
          else if(mn >= 206){ a = 255 - (((mn-206)/24)*255)|0; if(a<0)a=0; }
        }
        if(a===0){ d[i+3]=0; continue; }
        // hologram: drifting scanlines + slight cool tint on kept pixels
        const y = (p / S) | 0;
        const line = ((y + ph) & 3) === 0;
        if(line){ d[i]   = r*0.80|0; d[i+1] = g*0.86|0; d[i+2] = (b*0.92+22)|0; }
        else    { d[i+2] = b+10>255?255:b+10; }
        d[i+3] = a;
      }
      ctx.putImageData(frame, 0, 0);
    }

    function onMeta(){ setup(); }
    function onEnd(){
      // The clip's last frame is pure white; rather than freeze on a keyed video
      // frame, crossfade to the transparent standing portrait as her waiting pose.
      setFrozen(true);
      setTimeout(()=>{ running=false; cancelAnimationFrame(rafRef.current); }, 220);
    }
    function onPlay(){ setFrozen(false); if(!running && didSetup){ running=true; loop(); } }
    function onErr(){ setFailed(true); running=false; cancelAnimationFrame(rafRef.current); }
    v.addEventListener('loadeddata', onMeta);
    v.addEventListener('ended', onEnd);
    v.addEventListener('play', onPlay);
    v.addEventListener('error', onErr);
    if(v.readyState>=2) onMeta();

    // If the video can't load (e.g. shared offline file), fall back to the
    // standing portrait so Webbina always appears.
    const failTimer = setTimeout(()=>{ if(v.readyState < 2) setFailed(true); }, 4500);

    // try to play (muted first so autoplay is allowed)
    v.muted = true;
    const pr = v.play(); if(pr && pr.catch) pr.catch(()=>{});

    return ()=>{ running=false; cancelAnimationFrame(rafRef.current); clearTimeout(failTimer); v.removeEventListener('loadeddata', onMeta); v.removeEventListener('ended', onEnd); v.removeEventListener('play', onPlay); v.removeEventListener('error', onErr); };
  }, []);

  // pause processing when not active (saves CPU)
  React.useEffect(()=>{
    const v = videoRef.current; if(!v) return;
    if(active){ const pr=v.play(); if(pr&&pr.catch) pr.catch(()=>{}); }
    else { v.pause(); }
  }, [active]);

  return (
    <div className="live-stage">
      <video ref={videoRef} src={(window.WEBBINA_API ? window.WEBBINA_API.replace(/\/+$/,'')+'/media/webbina-intro.mp4' : 'assets/webbina-intro.mp4')} muted playsInline preload="auto" crossOrigin="anonymous"
        onError={()=>setFailed(true)}
        onEnded={()=>{ onEnded&&onEnded(); }}
        className="live-rawvideo" style={{ opacity: raw&&!frozen?1:0, display: raw?'block':'none' }} />
      <canvas ref={canvasRef} className="live-canvas" style={{ opacity: ready&&!failed&&!frozen&&!raw?1:0 }} />
      <img className="emerge-img waiting-portrait" src="assets/webbina-stand.png" alt="Webbina" style={{ opacity: (frozen||failed)&&!raw?1:0 }} />
    </div>
  );
}

function WelcomeScreen({ go }) {
  const [phase, setPhase] = React.useState(0); // 0 portal, 1 emerged, 2 greeting
  const [sound, setSound] = React.useState(false);
  const [waiting, setWaiting] = React.useState(false); // clip finished — Webbina awaits a reply
  const videoElRef = React.useRef(null);

  React.useEffect(()=>{
    const t1=setTimeout(()=>setPhase(1), 500);
    const t2=setTimeout(()=>setPhase(2), 1700);
    return ()=>{ clearTimeout(t1); clearTimeout(t2); };
  },[]);

  // grab the <video> WebbinaLive created so we can drive its audio
  React.useEffect(()=>{
    videoElRef.current = document.querySelector('.welcome .live-stage video');
  });

  function toggleSound(){
    const v = videoElRef.current || document.querySelector('.welcome .live-stage video');
    const greeting = "Bonjour ! Je suis Webbina, votre conseillère de voyage en famille. Dites-moi simplement où vous rêvez de partir, et je m'occupe de tout.";
    // If the intro video has a usable audio track, play it; otherwise speak via TTS.
    const canUseVideo = v && v.readyState >= 2 && !v.error;
    if(canUseVideo){
      if(v.muted || v.ended){ v.muted=false; v.currentTime=0; const pr=v.play(); if(pr&&pr.catch) pr.catch(()=>{}); setSound(true); setWaiting(false); }
      else { v.muted=true; setSound(false); }
      return;
    }
    // Fallback: Webbina speaks via Google TTS (works even without the video).
    if(typeof Voice!=='undefined'){
      if(sound){ Voice.cancel(); setSound(false); return; }
      setSound(true); setWaiting(false);
      Voice.speak(greeting, { emotion:'happy', onend:()=>{ setSound(false); setWaiting(true); } });
    }
  }

  return (
    <div className={`welcome phase-${phase} ${waiting?'is-waiting':''}`} onClick={()=>{ if(!sound) toggleSound(); }}>
      <div className="welcome-sky"></div>
      <div className="particles">{Array.from({length:14}).map((_,i)=><span key={i} style={{ left:`${(i*7+5)%100}%`, animationDelay:`${(i%7)*0.5}s`, animationDuration:`${5+(i%5)}s` }}></span>)}</div>

      <div className="portal">
        <div className="portal-glow"></div>
        <div className="portal-ring r1"></div>
        <div className="portal-ring r2"></div>
        <div className="portal-ring r3"></div>
      </div>

      {/* Webbina — alive (real video, background removed), plays once then waits */}
      <div className="emerge-wrap">
        <div className="emerge-enter">
          <WebbinaLive active={true} onEnded={()=>{ setWaiting(true); setSound(false); }} />
        </div>
        <div className="emerge-base"></div>
      </div>

      {/* sound affordance */}
      <button className="sound-toggle" onClick={(e)=>{ e.stopPropagation(); toggleSound(); }} aria-label="Écouter Webbina">
        <Icon n={sound?'mic':'phone'} size={18} />
        <span>{sound ? 'Webbina parle…' : (waiting?'Réécouter':'Écouter Webbina')}</span>
        {!sound && <span className="sound-ping"></span>}
      </button>

      <div className="welcome-copy">
        <div className="brandmark welcome-brand"><img src="assets/logo-mark.png" alt="" /><span className="wm">Travel<b>Family</b>.AI</span></div>
        <div className="greet-bubble">
          <b>Bonjour, je suis Webbina.</b>
          <span>Où souhaitez-vous partir aujourd'hui&nbsp;? ✨</span>
          {waiting && <span className="listening"><span className="listening-dots"><i></i><i></i><i></i></span>Webbina vous écoute…</span>}
        </div>
        <button className="btn btn--cta btn--lg" onClick={(e)=>{ e.stopPropagation(); try{ localStorage.setItem('tf_intro_seen','1'); }catch(err){} go('auth'); }} style={{ width:'100%', marginTop:18 }}>
          Créer mon compte <Icon n="arrowRight" size={20} />
        </button>
        <button className="welcome-link" onClick={(e)=>{ e.stopPropagation(); try{ localStorage.setItem('tf_intro_seen','1'); }catch(err){} go('auth'); }}>J'ai déjà un compte</button>
      </div>
    </div>
  );
}

function AuthScreen({ go }) {
  const auth = (typeof window.useWebbinaAuth !== 'undefined') ? window.useWebbinaAuth() : { ready:true, authEnabled:false, user:null };
  const [mode, setMode] = React.useState('signin'); // signin | signup
  const [email, setEmail] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);

  // Already logged in → go straight home.
  React.useEffect(()=>{ if(auth && auth.user){ go('home'); } }, [auth && auth.user]);

  async function submit(e){
    e.preventDefault();
    if(!window.WebbinaAuth || !auth.authEnabled){
      // Auth not configured (no backend/anon key) — let the demo continue.
      go('home'); return;
    }
    setBusy(true); setMsg(null);
    try {
      if(mode==='signup'){
        const r = await window.WebbinaAuth.signUp(email.trim(), pw);
        if(!r.session){ setMsg({ ok:true, text:'Compte créé ! Connectez-vous maintenant.' }); setMode('signin'); setBusy(false); return; }
      } else {
        await window.WebbinaAuth.signIn(email.trim(), pw);
      }
      go('home');
    } catch(err){
      setMsg({ ok:false, text: (err && err.message) || 'Échec de la connexion.' });
      setBusy(false);
    }
  }

  const providers=[['Google','#fff','#1F2937','globe'],['Apple','#0B1220','#fff','star'],['Facebook','#1877F2','#fff','users']];
  return (
    <div className="screen" style={{ minHeight:'100%', display:'flex', flexDirection:'column', background:'var(--grad-sky)' }}>
      <div style={{ padding:'18px 18px 0' }}>
        <button className="icon-btn" onClick={()=>go('welcome')} aria-label="Retour"><Icon n="arrowLeft" size={22} /></button>
      </div>
      <div style={{ flex:1, padding:'10px 24px 30px', display:'flex', flexDirection:'column', justifyContent:'center' }}>
        <div style={{ textAlign:'center', marginBottom:22 }}>
          <Avatar size={78} ring style={{ margin:'0 auto' }} />
          <h2 style={{ fontSize:25, marginTop:14 }}>{mode==='signup'?'Créer mon compte':'Heureuse de vous revoir !'}</h2>
          <p className="muted" style={{ fontSize:15, marginTop:6 }}>Vos passeports, préférences et voyages vous attendent.</p>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {providers.map(([n,bg,fg,ic])=>(
            <button key={n} className="btn" onClick={()=>setMsg({ok:false,text:`La connexion ${n} sera activée prochainement. Utilisez votre e-mail pour l'instant.`})} style={{ background:bg, color:fg, border:'1.5px solid var(--border-strong)', justifyContent:'center', minHeight:54 }}>
              <Icon n={ic} size={19} /> Continuer avec {n}
            </button>
          ))}
        </div>
        <div className="row gap3" style={{ margin:'18px 0' }}>
          <div style={{ flex:1, height:1, background:'var(--border)' }}></div><span className="micro">ou par e-mail</span><div style={{ flex:1, height:1, background:'var(--border)' }}></div>
        </div>
        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div className="field"><input className="input" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="votre@email.fr" /></div>
          <div className="field"><input className="input" type="password" required minLength={6} value={pw} onChange={e=>setPw(e.target.value)} placeholder="Mot de passe (6 caractères min)" /></div>
          {msg && <div className="micro" style={{ padding:'9px 12px', borderRadius:10, background: msg.ok?'var(--success-bg)':'var(--warning-bg)', color: msg.ok?'var(--success)':'var(--warning)' }}>{msg.text}</div>}
          {!auth.authEnabled && auth.ready && <div className="micro" style={{ color:'var(--text-muted)' }}>Mode démo — la connexion réelle s'active dès que le backend est relié.</div>}
          <button className="btn btn--primary btn--block" type="submit" disabled={busy}>{busy?'…':(mode==='signin'?'Se connecter':"S'inscrire")} <Icon n="arrowRight" size={18} /></button>
        </form>
        <button className="welcome-link" style={{ marginTop:14 }} onClick={()=>{ setMode(mode==='signin'?'signup':'signin'); setMsg(null); }}>
          {mode==='signin' ? "Pas encore de compte ? Créer un compte" : "J'ai déjà un compte"}
        </button>
        <p className="micro" style={{ textAlign:'center', marginTop:12 }}>En continuant, vous acceptez nos conditions et notre politique de confidentialité.</p>
      </div>
    </div>
  );
}

function Carousel({ children, auto=true, interval=4200 }){
  const ref = React.useRef(null);
  const [idx, setIdx] = React.useState(0);
  const [n, setN] = React.useState(0);
  const pausedRef = React.useRef(false);
  const resumeT = React.useRef(0);

  React.useEffect(()=>{ const el=ref.current; if(el) setN(el.children.length); }, [children]);

  const tweenRef = React.useRef(0);
  const targetFor = React.useCallback((el, child)=>{
    // center the card in the viewport; side-padding lets the first/last card center too
    const raw = (child.offsetLeft - el.offsetLeft) - (el.clientWidth - child.clientWidth)/2;
    return Math.max(0, Math.min(el.scrollWidth - el.clientWidth, raw));
  }, []);
  const scrollToIdx = React.useCallback((i)=>{
    const el = ref.current; if(!el || !el.children.length) return;
    const len = el.children.length;
    const c = ((i % len) + len) % len;
    const child = el.children[c];
    if(!child) return;
    const to = targetFor(el, child);
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    cancelAnimationFrame(tweenRef.current);
    if(reduce){ el.scrollLeft = to; return; }
    // rAF tween — native smooth scrollTo is unreliable across engines, so we
    // drive scrollLeft directly over ~360ms with an ease-out curve.
    const from = el.scrollLeft, dist = to - from, t0 = performance.now(), dur = 360;
    const step = (now)=>{
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.scrollLeft = from + dist * e;
      if(p < 1) tweenRef.current = requestAnimationFrame(step);
    };
    tweenRef.current = requestAnimationFrame(step);
  }, []);
  React.useEffect(()=>()=>cancelAnimationFrame(tweenRef.current), []);

  React.useEffect(()=>{
    const el = ref.current; if(!el) return;
    let raf=0;
    const onScroll=()=>{ cancelAnimationFrame(raf); raf=requestAnimationFrame(()=>{
      // active = card whose centre is closest to the viewport centre
      const mid = el.scrollLeft + el.clientWidth/2;
      let bi=0, bd=Infinity;
      for(let i=0;i<el.children.length;i++){
        const ch=el.children[i];
        const cc=(ch.offsetLeft-el.offsetLeft)+ch.clientWidth/2;
        const d=Math.abs(cc-mid);
        if(d<bd){ bd=d; bi=i; }
      }
      setIdx(bi);
    }); };
    el.addEventListener('scroll', onScroll, { passive:true });
    return ()=>{ el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);

  // globe-like focus handled in render via cloneElement (React-owned, survives re-renders)

  const pause=()=>{ pausedRef.current=true; clearTimeout(resumeT.current); };
  const resumeLater=()=>{ clearTimeout(resumeT.current); resumeT.current=setTimeout(()=>{ pausedRef.current=false; }, 6000); };
  React.useEffect(()=>()=>clearTimeout(resumeT.current), []);

  React.useEffect(()=>{
    if(!auto) return;
    const t=setInterval(()=>{
      if(pausedRef.current) return;
      const el=ref.current; if(!el) return;
      const len=el.children.length; if(len<=1) return;
      scrollToIdx((idx+1)%len);
    }, interval);
    return ()=>clearInterval(t);
  }, [auto, interval, idx, scrollToIdx]);

  return (
    <div className="carousel"
      onMouseEnter={pause} onMouseLeave={()=>{ pausedRef.current=false; }}
      onTouchStart={pause} onTouchEnd={resumeLater}>
      <button className="carousel-arrow carousel-arrow--prev" disabled={n<=1} aria-label="Précédent"
        onClick={()=>{ pause(); resumeLater(); scrollToIdx(idx-1); }}><Icon n="chevronLeft" size={20} /></button>
      <div className="hscroll" ref={ref}>
        {React.Children.map(children, (ch,i)=>{
          if(!React.isValidElement(ch)) return ch;
          const cls = ((ch.props.className||'') + (i===idx?' is-center':'')).trim();
          return React.cloneElement(ch, { className: cls });
        })}
      </div>
      <button className="carousel-arrow carousel-arrow--next" disabled={n<=1} aria-label="Suivant"
        onClick={()=>{ pause(); resumeLater(); scrollToIdx(idx+1); }}><Icon n="chevronRight" size={20} /></button>
      {n>1 && (
        <div className="carousel-dots">
          {Array.from({length:n}).map((_,i)=>(
            <button key={i} className={`carousel-dot ${i===idx?'is-active':''}`} aria-label={`Élément ${i+1}`}
              onClick={()=>{ pause(); resumeLater(); scrollToIdx(i); }}></button>
          ))}
        </div>
      )}
    </div>
  );
}

function BonPlanDuJour({ go, openChat }) {
  const [state, setState] = React.useState('loading'); // loading|live|empty
  const [deals, setDeals] = React.useState([]);
  const ORIGINS = [
    { code:'CDG', label:'Paris CDG' }, { code:'ORY', label:'Paris Orly' },
    { code:'MPL', label:'Montpellier' }, { code:'BCN', label:'Barcelone' },
    { code:'MRS', label:'Marseille' }, { code:'LYS', label:'Lyon' },
    { code:'NCE', label:'Nice' }, { code:'TLS', label:'Toulouse' },
    { code:'BOD', label:'Bordeaux' }, { code:'NTE', label:'Nantes' },
    { code:'GVA', label:'Genève' }, { code:'BRU', label:'Bruxelles' },
    { code:'CRL', label:'Charleroi' }, { code:'BSL', label:'Bâle-Mulhouse' },
    { code:'LUX', label:'Luxembourg' },
  ];
  const [origin, setOrigin] = React.useState(()=>{ try{ return localStorage.getItem('tf_deal_origin')||'CDG'; }catch(e){ return 'CDG'; } });

  React.useEffect(()=>{
    let cancelled=false;
    if(!window.WebbinaBackend || !window.WebbinaBackend.deals){ setState('empty'); return; }
    setState('loading');
    (async()=>{
      const live = await window.WebbinaBackend.isLive();
      if(!live){ if(!cancelled) setState('empty'); return; }
      const d = await window.WebbinaBackend.deals(origin, 8);
      if(cancelled) return;
      if(d && d.length){ setDeals(d); setState('live'); } else setState('empty');
    })();
    return ()=>{ cancelled=true; };
  }, [origin]);

  function changeOrigin(code){
    setOrigin(code);
    try{ localStorage.setItem('tf_deal_origin', code); }catch(e){}
  }

  if(state==='empty') return null;

  function openDeal(deal){
    const known = (TF.DESTINATIONS||[]).find(x=>x.iata===deal.iata);
    const base = known || {
      id:'deal-'+deal.iata, iata:deal.iata, name:deal.destination, country:deal.country,
      img:'photo-beach.jpg', tag:'Bon plan du moment', rating:4.6, kid:'Famille',
      price:deal.pricePerPax, nights:7,
      desc:`Une superbe idée au départ de ${originLabel} : j'ai trouvé un vol à partir de ${deal.pricePerPax} € par personne pour ${deal.destination}. Composons votre séjour ensemble !`,
    };
    go('detail', { ...base, _dealOrigin:origin, _dealDates:{ dep:deal.departureDate, ret:deal.returnDate } });
  }
  const fmtDate=(s)=>{ try{ return new Date(s).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}); }catch(e){ return s; } };
  const originLabel = (ORIGINS.find(o=>o.code===origin)||{}).label || origin;

  return (
    <div style={{ padding:'22px 0 2px' }}>
      <div className="row between" style={{ padding:'0 18px', marginBottom:4, alignItems:'center' }}>
        <span className="bonplan-badge"><Icon n="zap" size={13} />Bon plan du jour</span>
        {state==='live' && <span className="micro" style={{ color:'var(--success)', fontWeight:700 }}><Icon n="check" size={12} /> Prix réels</span>}
      </div>

      {/* departure airport selector */}
      <div style={{ padding:'8px 18px 0' }}>
        <label className="bonplan-origin">
          <Icon n="plane" size={15} />
          <span className="micro" style={{ whiteSpace:'nowrap' }}>Au départ de</span>
          <select value={origin} onChange={e=>changeOrigin(e.target.value)} aria-label="Aéroport de départ">
            {ORIGINS.map(o=><option key={o.code} value={o.code}>{o.label} ({o.code})</option>)}
          </select>
        </label>
      </div>

      <div style={{ padding:'0 18px' }}>
        <div className="webbina-reco" style={{ margin:'10px 0 12px' }}>
          <LivingWebbina size={30} state="idle" expr="enthusiastic" />
          <div className="micro" style={{ lineHeight:1.5, color:'var(--text-2)' }}>Vous ne savez pas encore où aller&nbsp;? Voici les meilleures affaires que je trouve en ce moment au départ de <b>{originLabel}</b>. ✨</div>
        </div>
      </div>
      {state==='loading' && <div className="micro" style={{ padding:'0 18px 8px', color:'var(--text-muted)' }}>Je scanne les vrais prix au départ de {originLabel}… 🔎</div>}
      {state==='live' && (
        <React.Fragment>
          <Carousel>
            {deals.map((d,i)=>(
              <button key={d.iata+i} className={`bonplan-card ${d.hot?'is-hot':''}`} onClick={()=>openDeal(d)}>
                {d.hot && <span className="bonplan-disc"><Icon n="zap" size={11} />Top prix</span>}
                <div className="bonplan-top">
                  <span className="bonplan-dest">{d.destination}</span>
                  <span className="bonplan-country">{d.country}</span>
                </div>
                <span className="bonplan-type"><Icon n="plane" size={12} /> Vol aller seul</span>
                <div className="bonplan-mid">
                  <span className="micro"><Icon n="calendar" size={12} /> Départ {fmtDate(d.departureDate)}</span>
                  <span className="micro">{d.stops===0?'Direct':d.stops+' escale'+(d.stops>1?'s':'')}</span>
                </div>
                <div className="bonplan-bot">
                  <div>
                    <b className="bonplan-price">{d.pricePerPax} €</b>
                    <span className="micro" style={{ display:'block', marginTop:1 }}>le vol aller / pers.</span>
                  </div>
                  <span className="bonplan-go"><Icon n="arrowRight" size={16} /></span>
                </div>
              </button>
            ))}
          </Carousel>
          <div className="micro" style={{ padding:'4px 18px 0', color:'var(--text-muted)', lineHeight:1.45 }}>
            <Icon n="info" size={11} /> Prix réels constatés à l'instant via nos partenaires. Ils peuvent évoluer et ne sont garantis qu'au moment de la réservation.
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

function HomeScreen({ go, openChat, openParcours, openReserver, favs, toggleFav }) {
  return (
    <div className="screen">
      <div style={{ padding:'14px 18px 0' }}>
        <div className="row between">
          <div className="row gap3">
            <LivingWebbina size={50} state="idle" expr="happy" />
            <div>
              <div className="micro">{(window.WebbinaAuth && window.WebbinaAuth.getEmail && window.WebbinaAuth.getEmail()) ? 'Bonjour 👋' : 'Bienvenue 👋'}</div>
              <b style={{ fontFamily:'var(--font-display)', fontSize:18 }}>{(window.WebbinaAuth && window.WebbinaAuth.getEmail && window.WebbinaAuth.getEmail()) ? (window.WebbinaAuth.getEmail().split('@')[0]) : 'Votre voyage commence ici'}</b>
            </div>
          </div>
          <div className="row gap2" style={{ alignItems:'center' }}>
            <ThemeToggle />
            <button className="icon-btn" aria-label="Notifications" onClick={()=>go('formalites')}><Icon n="bell" size={22} /><span className="dot"></span></button>
          </div>
        </div>

        <div style={{ margin:'20px 0 6px' }}>
          <h2 style={{ fontSize:27, lineHeight:1.15 }}>Où partons-nous<br/>en famille&nbsp;?</h2>
        </div>
        <button className="ai-search" onClick={()=>openChat('home')} style={{ width:'100%', marginTop:14, cursor:'pointer' }}>
          <Icon n="sparkles" cls="spark" size={22} />
          <span style={{ flex:1, textAlign:'left', color:'var(--text-muted)', fontWeight:500 }}>Dites-moi votre rêve de vacances…</span>
          <span className="btn btn--primary btn--icon" style={{ minHeight:42, width:42 }}><Icon n="mic" size={18} /></span>
        </button>
      </div>

      <GlobeParcours openParcours={openParcours} />

      <div className="home-sep"></div>

      <ReserverHub openReserver={openReserver} openChat={openChat} />

      <div className="home-sep"></div>

      <BonPlanDuJour go={go} openChat={openChat} />

      <div className="home-sep"></div>

      {typeof SponsoredRow!=='undefined' && <SponsoredRow limit={2} onPremium={()=>go('premium')} />}

      <div className="home-sep"></div>

      <div style={{ padding:'18px 0 6px' }}>
        <div className="row between" style={{ padding:'0 18px', marginBottom:12 }}>
          <div>
            <div className="res-eyebrow"><Icon n="heart" size={13} />Pour vous</div>
            <h3 style={{ fontSize:19, marginTop:6 }}>Inspirations</h3>
          </div>
          <span className="micro" style={{ color:'var(--ocean-700)', fontWeight:700, alignSelf:'flex-end' }}>Tout voir</span>
        </div>
        <Carousel>
          {TF.DESTINATIONS.map(d=>(
            <div key={d.id} style={{ width:230, flex:'none' }}>
              <DestCard d={d} onOpen={()=>go('detail', d)} fav={favs.includes(d.id)} onFav={toggleFav} />
            </div>
          ))}
        </Carousel>
      </div>

      <div style={{ padding:'10px 18px 20px' }}>
        <button className="card card--pad" style={{ background:'var(--grad-premium)', color:'#fff', border:'none', width:'100%', textAlign:'left' }} onClick={()=>go('premium')}>
          <div className="row between" style={{ alignItems:'flex-start' }}>
            <div style={{ flex:1 }}>
              <span className="badge badge--premium" style={{ marginBottom:8 }}><Icon n="crown" size={13} />Premium</span>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:18, marginTop:8 }}>Webbina Premium · 4,99 €/mois</div>
              <div style={{ fontSize:13.5, opacity:.85, marginTop:4, lineHeight:1.45 }}>Cagnotte doublée · commission réduite · bons plans exclusifs · alerte baisse de prix · zéro pub.</div>
            </div>
            <Icon n="chevronRight" size={22} />
          </div>
        </button>
      </div>
    </div>
  );
}

const PARCOURS_INTAKE = {
  '01': { needDest:true, needDates:true,
    title:'Vos dates et votre destination', sub:'Dites-moi où et quand, j\'optimise chaque réservation.',
    expr:'happy' },
  '02': { needDest:false, needDates:true,
    title:'Vos dates de voyage', sub:'Je vous dénicherai les meilleures destinations pour ces dates.',
    expr:'enthusiastic' },
  '03': { needDest:true, needDates:false,
    title:'Votre destination', sub:'Je trouverai la meilleure période — saison idéale et meilleurs prix.',
    expr:'focused' },
  '04': { needDest:false, needDates:false,
    title:'Laissez-moi vous surprendre', sub:'Je vais vous dénicher une pépite. Quelques questions et c\'est parti !',
    expr:'surprised' },
};
const POPULAR_DEST = ['Bali','Lisbonne','Barcelone','Sicile','Marrakech','Rome','Crète','Madère'];
const PERIOD_OPTS = ['Juillet','Août','Toussaint','Noël','Février (ski)','Avril','Je précise…'];

function ParcoursIntakeScreen({ parcours, go, openChat }) {
  const cfg = PARCOURS_INTAKE[parcours] || PARCOURS_INTAKE['04'];
  const [dest, setDest] = React.useState('');
  const [period, setPeriod] = React.useState('');
  const [exact, setExact] = React.useState('');

  const periodValue = period==='Je précise…' ? exact : period;
  const ready = (!cfg.needDest || dest.trim()) && (!cfg.needDates || periodValue.trim());

  function launch(){
    // Build a natural first message that seeds Webbina with the known criteria.
    const bits=[];
    if(cfg.needDest && dest.trim()) bits.push(`je veux partir à ${dest.trim()}`);
    if(cfg.needDates && periodValue.trim()) bits.push(`pour ${periodValue.trim()}`);
    let seed;
    if(parcours==='02') seed = `J'ai mes dates (${periodValue.trim()}) mais pas encore de destination. Trouve-moi les meilleures idées de voyage en famille pour ces dates.`;
    else if(parcours==='03') seed = `Je veux aller à ${dest.trim()} mais je suis flexible sur les dates. Quelle est la meilleure période (météo et prix) pour y partir en famille ?`;
    else if(parcours==='04') seed = `Fais-moi rêver ! Surprends-moi avec une pépite de voyage en famille. Pose-moi les questions nécessaires.`;
    else seed = `Bonjour Webbina, ${bits.join(' ')} en famille. Aide-moi à tout organiser au meilleur prix.`;
    openChat(parcours, seed);
  }

  return (
    <div className="screen" style={{ minHeight:'100%', display:'flex', flexDirection:'column' }}>
      <div className="sub-head">
        <button className="icon-btn" onClick={()=>go('home')} aria-label="Retour"><Icon n="arrowLeft" size={22} /></button>
        <div style={{ flex:1 }}><b style={{ fontFamily:'var(--font-display)', fontSize:17 }}>Composer mon voyage</b></div>
      </div>

      <div style={{ flex:1, padding:'18px', display:'flex', flexDirection:'column', gap:18 }}>
        <div style={{ textAlign:'center' }}>
          <LivingWebbina size={84} state="idle" expr={cfg.expr} style={{ margin:'0 auto' }} />
          <h2 style={{ fontSize:23, marginTop:12 }}>{cfg.title}</h2>
          <p className="micro" style={{ marginTop:6, lineHeight:1.5, maxWidth:'36ch', marginInline:'auto' }}>{cfg.sub}</p>
        </div>

        {cfg.needDest && (
          <div>
            <div className="intake-label"><Icon n="mapPin" size={15} />Destination</div>
            <input className="input" placeholder="Où rêvez-vous d'aller ?" value={dest} onChange={e=>setDest(e.target.value)} />
            <div className="row wrap gap2" style={{ marginTop:10 }}>
              {POPULAR_DEST.map(d=><button key={d} className={`chip ${dest===d?'chip--active':''}`} onClick={()=>setDest(d)}>{d}</button>)}
            </div>
          </div>
        )}

        {cfg.needDates && (
          <div>
            <div className="intake-label"><Icon n="calendar" size={15} />Vos dates</div>
            <div className="row wrap gap2">
              {PERIOD_OPTS.map(p=><button key={p} className={`chip ${period===p?'chip--active':''}`} onClick={()=>setPeriod(p)}>{p}</button>)}
            </div>
            {period==='Je précise…' && (
              <input className="input" style={{ marginTop:10 }} placeholder="Ex. du 12 au 19 juillet 2026" value={exact} onChange={e=>setExact(e.target.value)} />
            )}
          </div>
        )}

        {!cfg.needDest && !cfg.needDates && (
          <div className="ai-note" style={{ background:'var(--surface)', border:'1px solid var(--border)' }}>
            <Icon n="sparkles" size={20} style={{ color:'var(--gold)' }} />
            <div className="micro" style={{ lineHeight:1.5 }}>Je vais vous poser quelques questions (qui voyage, vos envies…) puis je composerai une surprise sur-mesure dans votre budget. ✨</div>
          </div>
        )}
      </div>

      <div className="answer-dock">
        <button className="btn btn--primary btn--block" disabled={!ready} onClick={launch}>
          Continuer avec Webbina <Icon n="arrowRight" size={18} />
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { WelcomeScreen, AuthScreen, HomeScreen, ParcoursIntakeScreen });
