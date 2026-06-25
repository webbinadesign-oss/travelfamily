/* TravelFamily.AI app — shared components → window */
const { useState, useEffect, useRef } = React;

function Icon({ n, size=22, sw=1.75, cls, style }) {
  return <span style={{ display:'inline-flex', alignItems:'center', ...style }}
    dangerouslySetInnerHTML={{ __html: tfIcon(n, { size, sw, cls }) }} />;
}
function Avatar({ size=40, ring=false, alive=false, expr='happy', style }) {
  const cls = 'wb-avatar' + (ring||alive ? ' wb-avatar--live' : '') + (alive ? ' wb-avatar--think' : '');
  return <img src={`assets/webbina-${expr}.png`} alt="Webbina" className={cls}
    style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover',
      boxShadow: ring ? '0 0 0 4px var(--turq-100)' : 'var(--sh-xs)',
      border:'2px solid #fff', flex:'none', ...style }} />;
}
function Badge({ tone='ocean', icon, children, style }) {
  return <span className={`badge badge--${tone}`} style={style}>{icon && <Icon n={icon} size={13} />}{children}</span>;
}

/* destination card */
function DestCard({ d, onOpen, fav, onFav, showMatch }) {
  return (
    <div className="dest-card" onClick={onOpen}>
      <div className="photo" style={{ backgroundImage:`url(assets/${d.img})`, aspectRatio:'4/3' }}>
        <span className="ribbon"><Badge tone={d.ribbon[1]} icon="star">{d.ribbon[0]}</Badge></span>
        <button className="fav" onClick={(e)=>{ e.stopPropagation(); onFav&&onFav(d.id); }}
          style={{ color: fav?'#fff':'var(--coral)', background: fav?'var(--coral)':'rgba(255,255,255,.92)' }}>
          <Icon n="heart" size={18} />
        </button>
        {showMatch && <span style={{ position:'absolute', left:14, bottom:48, zIndex:2 }}><span className="badge" style={{ background:'rgba(21,163,74,.92)', color:'#fff' }}><Icon n="sparkles" size={13} />{d.match}% pour vous</span></span>}
        <div className="cap"><b style={{ fontFamily:'var(--font-display)', fontSize:19 }}>{d.name}, {d.country}</b></div>
      </div>
      <div className="body">
        <div className="row gap3 micro" style={{ flexWrap:'wrap' }}>
          {d.meta.map(([i,t],k)=><span key={k} className="row gap2" style={{ alignItems:'center' }}><Icon n={i} size={14} />{t}</span>)}
        </div>
        <div className="row between" style={{ marginTop:10 }}>
          <b style={{ fontFamily:'var(--font-display)', fontSize:16 }}><span className="micro" style={{ fontWeight:600, color:'var(--ocean-700)' }}>Vol </span>dès {d.price} €<span className="micro" style={{ fontWeight:500 }}> /pers.</span></b>
          <span className="row gap2 micro" style={{ color:'var(--gold-700)', fontWeight:700 }}><Icon n="star" size={14} />{String(d.rating).replace('.',',')}</span>
        </div>
      </div>
    </div>
  );
}

/* chat bubbles */
function MsgAI({ children, anim, expr='happy' }) {
  return <div className="msg-row" style={anim?{animation:'fadeUp .35s ease both'}:null}><Avatar size={34} expr={expr} /><div className="bubble bubble--ai">{children}</div></div>;
}
function MsgUser({ children }) {
  return <div className="msg-row msg-row--user" style={{animation:'fadeUp .3s ease both'}}><div className="bubble bubble--user">{children}</div></div>;
}
function MsgSystem({ children }) {
  return <div style={{ textAlign:'center', animation:'fadeUp .3s ease both' }}><span className="bubble bubble--system" style={{ display:'inline-flex', alignItems:'center', gap:6 }}>{children}</span></div>;
}
function Typing({ expr='focused' }) {
  return <div className="msg-row"><Avatar size={34} alive expr={expr} /><div className="bubble bubble--ai typing" style={{ padding:'12px 16px' }}><span></span><span></span><span></span></div></div>;
}

/* ---- conversation controls ---- */
function Stepper({ value, set, min=0, max=9, suffix }) {
  const label = (n)=> suffix ? `${n} ${suffix}${n>1?'s':''}` : n;
  return (
    <div className="row gap4" style={{ justifyContent:'center', padding:'4px 0' }}>
      <button className="step-btn" onClick={()=>set(Math.max(min,value-1))} disabled={value<=min} aria-label="Moins"><Icon n="x" size={18} style={{transform:'rotate(45deg)'}} /></button>
      <div style={{ minWidth:120, textAlign:'center' }}>
        <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:38, lineHeight:1, color:'var(--ocean)' }}>{value}</div>
        <div className="micro">{suffix?`${suffix}${value>1?'s':''}`:''}</div>
      </div>
      <button className="step-btn" onClick={()=>set(Math.min(max,value+1))} disabled={value>=max} aria-label="Plus"><Icon n="plus" size={18} /></button>
    </div>
  );
}

function Slider({ value, set, min, max, step, unit }) {
  const pct = ((value-min)/(max-min))*100;
  return (
    <div style={{ padding:'8px 4px' }}>
      <div style={{ textAlign:'center', fontFamily:'var(--font-display)', fontWeight:800, fontSize:32, color:'var(--ocean)', marginBottom:14 }}>
        {value.toLocaleString('fr-FR')} {unit}{value>=max?'+':''}
      </div>
      <div style={{ position:'relative', height:30 }}>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e=>set(Number(e.target.value))} className="tf-range" style={{ '--pct':pct+'%' }} />
      </div>
      <div className="row between micro" style={{ marginTop:2 }}><span>{min.toLocaleString('fr-FR')} {unit}</span><span>{max.toLocaleString('fr-FR')} {unit}+</span></div>
    </div>
  );
}

function ChipPick({ options, multi, value, set }) {
  const arr = multi ? value : [value];
  const toggle = (o) => {
    if(multi){ set(arr.includes(o) ? arr.filter(x=>x!==o) : [...arr, o]); }
    else set(o);
  };
  return (
    <div className="row wrap gap2" style={{ justifyContent:'center' }}>
      {options.map(o=>(
        <button key={o} className={`chip ${arr.includes(o)?'chip--active':''}`} onClick={()=>toggle(o)} style={{ fontSize:15 }}>
          {arr.includes(o) && <Icon n="check" size={15} />}{o}
        </button>
      ))}
    </div>
  );
}

/* traffic-light pill */
function StatusDot({ status, size=12 }) {
  const map={ green:'var(--success)', orange:'var(--warning)', red:'var(--error)' };
  return <span style={{ width:size, height:size, borderRadius:'50%', background:map[status], flex:'none', boxShadow:`0 0 0 4px color-mix(in srgb, ${map[status]} 22%, transparent)` }}></span>;
}

/* connector logo chip */
function Connector({ name }) {
  return <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontFamily:'var(--font-display)', fontWeight:700, fontSize:12.5,
    color:'var(--text-2)', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-pill)', padding:'6px 12px' }}>
    <span style={{ width:7, height:7, borderRadius:'50%', background:'var(--turq)' }}></span>{name}</span>;
}

/* ===== Voice — Webbina speaks her messages in French (Web Speech API) ===== */
const Voice = {
  enabled: (function(){ try{ return (localStorage.getItem('tf_voice')||'on')==='on'; }catch(e){ return true; } })(),
  voice: null,
  _subs: new Set(),
  supported: typeof window!=='undefined' && 'speechSynthesis' in window,
  pick(){
    if(!this.supported) return;
    const vs = speechSynthesis.getVoices()||[];
    const fr = vs.filter(v=>/^fr(-|_)/i.test(v.lang) || v.lang==='fr-FR' || /français|france/i.test(v.name));
    const prefer = fr.find(v=>/Audrey|Am[ée]lie|Marie|Virginie|Julie|Th?omas?|Google fran|femme|female/i.test(v.name))
                 || fr.find(v=>/fr-FR/i.test(v.lang)) || fr[0];
    this.voice = prefer || null;
  },
  clean(text){
    return String(text)
      .replace(/<[^>]+>/g,' ')
      .replace(/&nbsp;/g,' ').replace(/&amp;/g,'et').replace(/&[a-z]+;/g,' ')
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu,'')
      .replace(/[\u2605\u2606\u2730\u2735\u272F\u2729]/g,'')   // ★ ☆ etc.
      .replace(/\*\*?/g,'').replace(/[_#`>~|]/g,'')            // markdown marks
      .replace(/\s[-–—•·]\s/g,', ')                            // bullets/dashes → pause
      .replace(/\(\s*\)/g,'')                                  // empty parens left over
      .replace(/€/g,' euros').replace(/£/g,' livres').replace(/\$/g,' dollars')
      .replace(/\s+/g,' ').replace(/\s+([.,!?])/g,'$1').trim();
  },
  speak(text, opts={}){
    if(!this.enabled){ opts.onend&&opts.onend(); return; }
    const tt=this.clean(text);
    if(!tt){ opts.onend&&opts.onend(); return; }
    // INTERRUPT mode: a new message cancels whatever is playing, so we never get
    // two Webbinas at once. A session token ignores late callbacks from the old one.
    this.cancel();
    const sess = (this._session = (this._session||0) + 1);
    const guard = (fn)=>{ return (arg)=>{ if(sess===this._session && fn) try{ fn(arg); }catch(e){} }; };
    this._speakOne(tt, { emotion:opts.emotion, sess, onstart:guard(opts.onstart), onprogress:guard(opts.onprogress), onend:guard(opts.onend) });
  },
  _speakOne(text, opts={}){
    const sess = opts.sess;
    // Prefer the premium Google/ElevenLabs voice via backend; fall back to browser ONLY
    // if the backend fails BEFORE any audio played — never overlap the two.
    if(window.WebbinaBackend && typeof window.WebbinaBackend.speak==='function'){
      this._cancelBrowser();
      window.WebbinaBackend.speak(text, opts.emotion||'happy', {
        onstart: opts.onstart,
        onprogress: opts.onprogress,
        onend: opts.onend,
      }).then(ok=>{ if(!ok && sess===this._session) this._speakBrowser(text, opts); })
        .catch(()=>{ if(sess===this._session) this._speakBrowser(text, opts); });
      return;
    }
    this._speakBrowser(text, opts);
  },
  _speakBrowser(text, opts={}){
    if(!this.supported || !this.enabled){ opts.onend&&opts.onend(); return; }
    try{
      speechSynthesis.cancel();
      this._stopKeepAlive();
      const t=this.clean(text);
      if(!t){ opts.onend&&opts.onend(); return; }
      // Split into short sentence chunks: Chrome cuts long utterances mid-phrase.
      const chunks = (t.match(/[^.!?…]+[.!?…]*/g) || [t])
        .map(s=>s.trim()).filter(Boolean);
      let i=0, started=false;
      const speakNext=()=>{
        if(i>=chunks.length){ this._stopKeepAlive(); opts.onend&&opts.onend(); return; }
        const u=new SpeechSynthesisUtterance(chunks[i]);
        if(this.voice) u.voice=this.voice;
        u.lang='fr-FR'; u.rate=0.97; u.pitch=1.06; u.volume=1;
        u.onstart=()=>{ if(!started){ started=true; opts.onstart&&opts.onstart(); } };
        u.onend=()=>{ i++; speakNext(); };
        u.onerror=()=>{ i++; speakNext(); };
        speechSynthesis.speak(u);
      };
      // Keep-alive: Chrome silently pauses long speech; nudge it back.
      this._startKeepAlive();
      speakNext();
    }catch(e){ this._stopKeepAlive(); opts.onend&&opts.onend(); }
  },
  _startKeepAlive(){ this._stopKeepAlive(); try{ this._ka=setInterval(()=>{ try{ if(speechSynthesis.speaking && !speechSynthesis.paused){ speechSynthesis.resume(); } }catch(e){} }, 8000); }catch(e){} },
  _stopKeepAlive(){ if(this._ka){ clearInterval(this._ka); this._ka=null; } },
  _cancelBrowser(){ this._stopKeepAlive(); if(this.supported){ try{ speechSynthesis.cancel(); }catch(e){} } },
  cancel(){ this._session=(this._session||0)+1; this._queue=[]; this._draining=false; this._cancelBrowser(); try{ if(window.WebbinaBackend && window.WebbinaBackend.stop) window.WebbinaBackend.stop(); }catch(e){} },
  setEnabled(v){ this.enabled=!!v; try{ localStorage.setItem('tf_voice', v?'on':'off'); }catch(e){} if(!v) this.cancel(); this._subs.forEach(fn=>fn(this.enabled)); },
  toggle(){ this.setEnabled(!this.enabled); return this.enabled; },
  subscribe(fn){ this._subs.add(fn); return ()=>this._subs.delete(fn); },
};
if(Voice.supported){ Voice.pick(); speechSynthesis.onvoiceschanged=()=>Voice.pick(); }

/* small speaker toggle that reflects global voice state */
function VoiceToggle({ compact }) {
  const [on, setOn] = React.useState(Voice.enabled);
  React.useEffect(()=>Voice.subscribe(setOn), []);
  if(!Voice.supported) return null;
  return (
    <button className={`voice-toggle ${on?'on':''}`} onClick={(e)=>{ e.stopPropagation(); Voice.toggle(); }}
      aria-label={on?'Couper la voix de Webbina':'Activer la voix de Webbina'} title={on?'Voix activée':'Voix coupée'}>
      <Icon n={on?'mic':'phone'} size={compact?16:18} />
      {!compact && <span>{on?'Voix ON':'Voix OFF'}</span>}
    </button>
  );
}

/* tap-to-hear button: Webbina reads a specific piece of advice aloud */
function SpeakBtn({ text, label }) {
  const [speaking, setSpeaking] = React.useState(false);
  if(!Voice.supported) return null;
  function go(e){
    e.stopPropagation();
    if(speaking){ Voice.cancel(); setSpeaking(false); return; }
    const wasEnabled=Voice.enabled; if(!wasEnabled) Voice.enabled=true;   // allow one-shot even if globally off
    setSpeaking(true);
    Voice.speak(text, { onend:()=>{ setSpeaking(false); Voice.enabled=wasEnabled; } });
  }
  return (
    <button className={`speak-btn ${speaking?'on':''}`} onClick={go} aria-label="Écouter Webbina">
      <Icon n={speaking?'mic':'phone'} size={14} />{label||(speaking?'…':'Écouter')}
    </button>
  );
}

/* day/night toggle — lives inside the app header (no longer a floating pill) */
function ThemeToggle({ compact }){
  const get=()=> (document.documentElement.getAttribute('data-theme')==='dark'?'dark':'light');
  const [theme,setTheme]=React.useState(get());
  const flip=()=>{ const d=get()==='dark'?'light':'dark'; document.documentElement.setAttribute('data-theme',d); try{ localStorage.setItem('tf_theme',d); }catch(e){} setTheme(d); };
  const dark=theme==='dark';
  return (
    <button className="icon-btn" onClick={flip} aria-label={dark?'Passer en mode jour':'Passer en mode nuit'} title={dark?'Mode jour':'Mode nuit'}>
      <Icon n={dark?'sun':'moon'} size={22} />
    </button>
  );
}

Object.assign(window, { Icon, Avatar, Badge, DestCard, MsgAI, MsgUser, MsgSystem, Typing, Stepper, Slider, ChipPick, StatusDot, Connector, Voice, VoiceToggle, SpeakBtn, ThemeToggle });
