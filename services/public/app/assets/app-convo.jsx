/* TravelFamily.AI app — Conversational onboarding (no forms, just chat) */

const CONVO_INTRO = {
  home: 'Bonjour&nbsp;! Je suis Webbina, votre experte voyage famille. 🌍 Racontez-moi votre projet, je m\'occupe du reste.',
  '01': 'Parfait, vous avez déjà tout en tête&nbsp;! 😊 Laissez-moi quelques détails et j\'optimise chaque réservation.',
  '02': 'Génial, on a les dates&nbsp;! ✨ Je vais vous proposer des destinations qui feront briller les yeux de toute la famille.',
  '03': 'Vous êtes flexible&nbsp;? C\'est mon moment préféré&nbsp;: je trouve la meilleure période au meilleur prix. 🗓️',
  '04': 'Oh j\'adore&nbsp;! 🪄 Donnez-moi juste une ambiance et un budget, et je vous invente un voyage sur-mesure.',
};

function answerLabel(qid, val) {
  if(qid==='adults') return `${val} adulte${val>1?'s':''}`;
  if(qid==='kids') return val===0 ? 'Sans enfant' : `${val} enfant${val>1?'s':''}`;
  if(qid==='ages') return val.length? val.join(', ') : 'Je passe';
  if(qid==='budget') return `${val.toLocaleString('fr-FR')} € au total`;
  if(qid==='from') return `Départ de ${val}`;
  if(qid==='duration') return val;
  if(qid==='vibe') return val.length? val.join(' · ') : 'Surprise-moi';
  if(qid==='musts') return val.length? val.join(' · ') : 'Aucun incontournable';
  return Array.isArray(val) ? val.join(', ') : String(val);
}

function webbinaOpener(ctx){
  if(ctx==='sav') return savOpener(null);
  if(ctx && ctx!=='home' && CONVO_INTRO[ctx]) return CONVO_INTRO[ctx];
  const h = new Date().getHours();
  const hi = (h>=6 && h<18) ? 'Bonjour' : 'Bonsoir';
  const openers = [
    `${hi}&nbsp;! Je suis Webbina, votre conseillère voyage en famille. 🌍 Racontez-moi votre prochaine aventure&nbsp;!`,
    `${hi}&nbsp;! Ravie de vous voir. ✨ Dites-moi ce qui vous ferait rêver pour ce voyage en famille.`,
    `${hi}&nbsp;! Alors, on part où cette fois&nbsp;? 🧳 Racontez-moi, je m'occupe de tout.`,
  ];
  return openers[Math.floor(Math.random()*openers.length)];
}

/* Ouverture du mode SAV — ancrée sur la réservation réelle si fournie.
   Webbina oriente vers LE prestataire exact, sans inventer de lien générique. */
function savOpener(seed){
  const bk = seed && seed.booking;
  if(bk){
    const who = bk.providerName || 'votre prestataire';
    const ref = bk.ref ? ` (dossier <b>${bk.ref}</b>)` : '';
    return `Je suis là pour vous aider sur votre réservation <b>${who}</b>${ref}. Dites-moi ce qui se passe — modification, annulation, retard&nbsp;? Je vous indique la marche exacte et le bon contact <b>${who}</b>, jamais un numéro au hasard.`;
  }
  return 'Je suis là pour vous aider. 💛 De quelle réservation s\'agit-il, ou quelle est votre question&nbsp;? Pour un souci sur un vol ou un hôtel, je vous orienterai vers <b>le prestataire exact</b> de votre dossier.';
}

function ConversationScreen({ ctx, seed, go }) {
  const QS = TF.QUESTIONS;
  const _restored = (window.__TF_CONVO && window.__TF_CONVO.ctx===ctx && (window.__TF_CONVO.msgs||[]).length>1);
  const [msgs, setMsgs] = React.useState(()=> _restored ? window.__TF_CONVO.msgs : [{ who:'ai', t: ctx==='sav' ? savOpener(seed) : webbinaOpener(ctx), expr: ctx==='sav'?'reassuring':(ctx==='04'?'surprised':'happy') }]);
  const [step, setStep] = React.useState(-1);      // -1 = intro pending
  const [typing, setTyping] = React.useState(false);
  const [phase, setPhase] = React.useState('idle'); // idle | ask | searching | done
  const [answers, setAnswers] = React.useState({});
  const [draft, setDraft] = React.useState(null);
  const [speaking, setSpeaking] = React.useState(false);
  const [speakProg, setSpeakProg] = React.useState(0);   // 0..1 audio progress
  const [speakText, setSpeakText] = React.useState('');  // the line being spoken
  const [speakExpr, setSpeakExpr] = React.useState('happy');
  const scroller = React.useRef(null);
  const spokenRef = React.useRef(_restored ? (window.__TF_CONVO.msgs.length-1) : -1);
  // ── Free-text live chat (real Webbina via backend) ──
  const [liveOn, setLiveOn] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const histRef = React.useRef(_restored ? (window.__TF_CONVO.hist||[]).slice() : []); // {role, content} for the real brain
  const recRef = React.useRef(null);

  React.useEffect(()=>{ if(window.WebbinaBackend){ try{ window.WebbinaBackend.wake&&window.WebbinaBackend.wake(); }catch(e){} window.WebbinaBackend.isLive().then(setLiveOn); } }, []);

  // Voice input (speech-to-text) — lets the user actually TALK to Webbina.
  // Primary: browser SpeechRecognition (free, instant, works on Chrome/Android & iOS Safari 14.5+).
  // Fallback: record audio → backend transcription (when a key is configured).
  const webSpeechOK = (typeof window!=='undefined') && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const recordOK = (typeof navigator!=='undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof MediaRecorder!=='undefined');
  const speechOK = webSpeechOK || recordOK;
  async function toggleMic(){
    if(listening){
      try{ recRef.current && (recRef.current.stop ? recRef.current.stop() : recRef.current.abort && recRef.current.abort()); }catch(e){}
      return;
    }
    try{ Voice.cancel(); }catch(e){}
    // ── Primary path: browser speech recognition ──
    if(webSpeechOK){
      try{
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        const rec = new SR();
        rec.lang='fr-FR'; rec.interimResults=true; rec.continuous=false; rec.maxAlternatives=1;
        let finalText='';
        rec.onresult=(ev)=>{ let t=''; for(let i=ev.resultIndex;i<ev.results.length;i++){ t+=ev.results[i][0].transcript; if(ev.results[i].isFinal) finalText+=ev.results[i][0].transcript; } setInput(finalText||t); };
        rec.onerror=()=>{ setListening(false); };
        rec.onend=()=>{ setListening(false); const t=(finalText||'').trim(); if(t){ sendFreeText(t); setInput(''); } };
        recRef.current=rec; rec.start(); setListening(true);
        return;
      }catch(e){ /* fall through to recorder */ }
    }
    // ── Fallback path: record audio → backend transcription ──
    if(!recordOK){ return; }
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      const mime = ['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/ogg','audio/mp4'].find(m=>{ try{ return MediaRecorder.isTypeSupported(m); }catch(e){ return false; } }) || '';
      const rec = mime ? new MediaRecorder(stream, { mimeType:mime }) : new MediaRecorder(stream);
      const chunks=[];
      rec.ondataavailable=(e)=>{ if(e.data && e.data.size) chunks.push(e.data); };
      rec.onstop=async ()=>{
        try{ stream.getTracks().forEach(t=>t.stop()); }catch(e){}
        setListening(false);
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/mp4' });
        if(!blob.size) return;
        setSending(true); setTyping(true);
        try{
          const text = await window.WebbinaBackend.transcribe(blob);
          setTyping(false); setSending(false);
          const t=(text||'').trim();
          if(t){ sendFreeText(t); }
          else { setMsgs(m=>[...m, { who:'sys', t:'Je n’ai pas bien saisi — vous pouvez réessayer ou m’écrire. ✍️' }]); }
        }catch(e){ setTyping(false); setSending(false); }
      };
      recRef.current=rec;
      rec.start(); setListening(true);
    }catch(e){ setListening(false); }
  }
  React.useEffect(()=>()=>{ try{ const r=recRef.current; if(r){ if(r.state && r.state!=='inactive') r.stop(); else if(r.abort) r.abort(); } }catch(e){} }, []);

  // If the user is logged in, open with their personalised memory greeting.
  React.useEffect(()=>{
    let cancelled = false;
    if(window.WebbinaBackend && window.WebbinaBackend.greeting){
      window.WebbinaBackend.greeting().then(g=>{
        if(!cancelled && g && g.greeting){
          setMsgs(m=>{
            // replace the very first intro bubble with the memory greeting
            if(m.length && m[0].who==='ai'){
              const copy=m.slice(); copy[0]={ who:'ai', t:g.greeting, expr: g.returning?'happy':'reassuring' }; return copy;
            }
            return m;
          });
        }
      }).catch(()=>{});
    }
    return ()=>{ cancelled=true; };
  }, []);

  async function sendFree(e){
    if(e) e.preventDefault();
    const text = input.trim();
    if(!text || sending) return;
    setInput('');
    sendFreeText(text);
  }

  async function sendFreeText(text){
    text = (text||'').trim();
    if(!text || sending) return;
    setMsgs(m=>[...m, { who:'user', t: text }]);
    histRef.current.push({ role:'user', content:text });
    setSending(true); setTyping(true);
    try {
      let full = '';
      let idx = -1;
      const DEVIS_RE=/§\s*DEVIS\s*([\s\S]*?)\s*§/i;
      const stripDevis=(s)=> s.replace(/§\s*DEVIS[\s\S]*$/i,'').trim();
      await window.WebbinaBackend.chat(histRef.current, (tok)=>{
        full += tok;
        setTyping(false);
        const shown = stripDevis(full);
        setMsgs(m=>{
          const copy=m.slice();
          if(idx<0){ idx=copy.length; copy.push({ who:'ai', t: shown, expr:'happy', streaming:true }); }
          else { copy[idx]={ who:'ai', t: shown, expr:'happy', streaming:true }; }
          return copy;
        });
      });
      const clean = stripDevis(full);
      // mark complete → now the voice may read the whole phrase once
      setMsgs(m=>{ const copy=m.slice(); if(idx>=0 && copy[idx]) copy[idx]={ ...copy[idx], t:clean, streaming:false }; return copy; });
      histRef.current.push({ role:'assistant', content: clean });
      if(window.WebbinaBackend.remember) window.WebbinaBackend.remember(text, clean);
      // Did Webbina decide to compose a full quote? Assemble it (flight + stay + activities).
      let devis=null; const mm=DEVIS_RE.exec(full);
      if(mm){ try{ devis=JSON.parse(mm[1]); }catch(e){ devis=null; } }
      if(devis && devis.iata){ proposeDevis(devis); }
      else { maybeSearchFlights(text); }
    } catch(err) {
      // Transient failure: Render cold start OR Gemini free-tier rate limit (429).
      // Wait, re-check health, and retry up to 2 times with growing backoff — keeps
      // the conversation alive instead of dead-ending after a few messages.
      let recovered=false;
      for(let attempt=0; attempt<2 && !recovered; attempt++){
        try{
          if(attempt===0) setMsgs(m=>[...m, { who:'ai', t:"Je réfléchis, un petit instant… ☕", expr:'reassuring', streaming:false, _wake:true }]);
          await new Promise(r=>setTimeout(r, 3000 + attempt*4000));
          if(window.WebbinaBackend){ try{ window.WebbinaBackend._live=null; await window.WebbinaBackend.isLive(); }catch(e){} }
          let full2=''; let idx2=-1;
          await window.WebbinaBackend.chat(histRef.current, (tok)=>{
            full2+=tok; setTyping(false);
            setMsgs(m=>{ const copy=m.slice().filter(x=>!x._wake);
              if(idx2<0){ idx2=copy.length; copy.push({ who:'ai', t:full2, expr:'happy', streaming:true }); }
              else { copy[idx2]={ who:'ai', t:full2, expr:'happy', streaming:true }; }
              return copy; });
          });
          if(full2.trim()){
            setMsgs(m=>{ const copy=m.slice(); const li=copy.map(x=>x.who).lastIndexOf('ai'); if(li>=0) copy[li]={ ...copy[li], streaming:false }; return copy; });
            histRef.current.push({ role:'assistant', content: full2 });
            if(window.WebbinaBackend.remember) window.WebbinaBackend.remember(text, full2);
            maybeSearchFlights(text);
            recovered=true;
          }
        } catch(err2){ /* try again */ }
      }
      if(!recovered){
        setTyping(false);
        setMsgs(m=>[...m.filter(x=>!x._wake), { who:'ai', t:"Je suis très sollicitée là, tout de suite — laissez-moi quelques secondes et réécrivez-moi votre message. 💙", expr:'reassuring' }]);
      }
    } finally { setSending(false); }
  }

  // Detect a known destination in free text and fetch real flights inline.
  async function maybeSearchFlights(text){
    if(!window.WebbinaBackend) return;
    const low = text.toLowerCase();
    const dest = (TF.DESTINATIONS||[]).find(d=>{
      const n=d.name.toLowerCase(), c=(d.country||'').toLowerCase();
      return low.includes(n) || (c && low.includes(c));
    });
    if(!dest || !dest.iata) return;
    const live = await window.WebbinaBackend.isLive();
    if(!live) return;
    // loading bubble
    const loadId = Date.now()+Math.random();
    setMsgs(m=>[...m, { who:'ai', t:`Je regarde les vols pour <b>${dest.name}</b> en direct… ✈️`, expr:'focused' }]);
    const dep=new Date(); dep.setDate(dep.getDate()+42);
    try{
      const r = await window.WebbinaBackend.searchFlights({ origin:'CDG', destination:dest.iata, departureDate:dep.toISOString().slice(0,10), adults:2, children:2, maxResults:3 });
      const items=(r.items||[]).slice(0,3);
      if(items.length){
        setMsgs(m=>[...m, { who:'flights', dest:dest, items:items }]);
        const best=Math.round(items[0].price&&items[0].price.amount||0);
        setMsgs(m=>[...m, { who:'ai', t:`Voilà&nbsp;! À partir de <b>${best} €</b> par personne pour ${dest.name}. Je peux ouvrir le détail complet quand vous voulez. 💙`, expr:'enthusiastic' }]);
      } else {
        setMsgs(m=>[...m, { who:'ai', t:`Je n'ai pas trouvé de vol pour ${dest.name} sur ces dates de test, mais je peux explorer d'autres dates. 🗓️`, expr:'reassuring' }]);
      }
    }catch(e){
      setMsgs(m=>[...m, { who:'ai', t:`La recherche de vols est momentanément indisponible. Réessayons dans un instant. 😊`, expr:'reassuring' }]);
    }
  }

  // Webbina has gathered enough → assemble a full quote (flight + stay + activities).
  async function proposeDevis(d){
    if(!window.WebbinaBackend || !window.WebbinaBackend.buildPackage) return;
    const known=(TF.DESTINATIONS||[]).find(x=>x.iata===d.iata || (x.name||'').toLowerCase()===(d.dest||'').toLowerCase());
    const adults=Math.max(1, +d.adults||2), children=Math.max(0, +d.children||0);
    const nights=Math.max(1, +d.nights||7), budget=+d.budget||0;
    const dep=new Date(); dep.setDate(dep.getDate()+42);
    const ret=new Date(dep); ret.setDate(ret.getDate()+nights);
    const loadKey=Date.now()+Math.random();
    setMsgs(m=>[...m, { who:'devis', _k:loadKey, loading:true, dest:(d.dest||(known&&known.name)||'votre destination') }]);
    try{
      const p=await window.WebbinaBackend.buildPackage({
        origin:d.origin||'CDG', destinationIata:d.iata, destinationName:d.dest||(known&&known.name)||d.iata,
        lat:known&&known.lat, lng:known&&known.lng,
        departureDate:dep.toISOString().slice(0,10), returnDate:ret.toISOString().slice(0,10),
        adults, children, budget:budget||undefined,
      });
      const destObj=known || { id:'devis-'+d.iata, iata:d.iata, name:d.dest||d.iata, country:(known&&known.country)||'', img:'photo-beach.jpg', rating:4.6, nights };
      setMsgs(m=>m.map(x=> x._k===loadKey ? { who:'devis', _k:loadKey, loading:false, pkg:p, dest:destObj, adults, children, budget } : x));
    }catch(e){
      setMsgs(m=>m.map(x=> x._k===loadKey ? { who:'ai', t:"Je n'ai pas réussi à assembler le devis à l'instant — réessayons dans un moment, ou je peux vous montrer les vols seuls. 💙", expr:'reassuring' } : x));
    }
  }

  React.useEffect(()=>{ const el=scroller.current; if(el) el.scrollTop=el.scrollHeight; }, [msgs, typing, phase]);

  // Webbina speaks each new AI message aloud — only once it's complete
  React.useEffect(()=>{
    const last=msgs.length-1;
    if(last>spokenRef.current){
      const m=msgs[last];
      if(m && m.who==='ai' && !m.streaming){
        spokenRef.current=last;
        const plain=(m.t||'').replace(/<[^>]+>/g,'');
        setSpeaking(true); setSpeakProg(0); setSpeakText(plain); setSpeakExpr(m.expr||'happy');
        Voice.speak(m.t, {
          emotion: m.expr,
          onprogress:(r)=>setSpeakProg(r),
          onend:()=>{ setSpeaking(false); setSpeakProg(1); },
        });
      }
    }
  }, [msgs]);

  // stop any speech when leaving the conversation
  React.useEffect(()=>()=>Voice.cancel(), []);

  // kick off first question — ONLY in offline/demo mode. When the live backend
  // (Gemini) is available, Webbina drives the conversation herself; we don't run
  // the scripted guided flow (which would "talk on its own" over the user).
  React.useEffect(()=>{
    let cancelled=false;
    if(_restored){ setPhase('chat'); return ()=>{ cancelled=true; }; }
    (async()=>{
      let live=false;
      try{ live = window.WebbinaBackend ? await window.WebbinaBackend.isLive() : false; }catch(e){ live=false; }
      if(cancelled) return;
      if(live){
        // Live mode: if a parcours seed is present, auto-send it so Webbina
        // immediately reacts and asks the right funnel questions. Otherwise greet.
        setPhase('chat');
        if(ctx==='sav'){
          // SAV: keep the grounded opener, never auto-send the seed object.
          setMsgs(m=> m.length ? m : [{ who:'ai', t: savOpener(seed), expr:'reassuring' }]);
        } else if(seed && typeof seed==='string'){
          setTimeout(()=>{ if(!cancelled) sendFreeText(seed); }, 350);
        } else {
          setMsgs(m=>{
            if(m.length) return m;
            return [{ who:'ai', t: CONVO_INTRO[ctx]||CONVO_INTRO.home, expr:'happy' }];
          });
        }
      } else {
        // Offline/demo: run the guided scripted funnel.
        ask(0);
      }
    })();
    return ()=>{ cancelled=true; };
  }, []);

  // Persist the conversation so returning to the chat doesn't replay the opener.
  React.useEffect(()=>{ try{ window.__TF_CONVO = { ctx, msgs, hist: histRef.current }; }catch(e){} }, [msgs]);

  function ask(i) {
    setTyping(true);
    setTimeout(()=>{
      setTyping(false);
      const exprMap={adults:'happy',kids:'happy',ages:'focused',budget:'focused',when:'happy',vibe:'enthusiastic'};
      setMsgs(m=>[...m, { who:'ai', t: QS[i].q, expr: exprMap[QS[i].id]||'happy' }]);
      setStep(i);
      const q=QS[i];
      setDraft(q.kind==='stepper' ? q.def : q.kind==='slider' ? q.def : q.kind==='chips-multi' ? [] : null);
      setPhase('ask');
    }, 850);
  }

  function validate() {
    const q=QS[step];
    const val = draft;
    setAnswers(a=>({ ...a, [q.id]: val }));
    setMsgs(m=>[...m, { who:'user', t: answerLabel(q.id, val) }]);
    setPhase('idle');
    if(step < QS.length-1){ setTimeout(()=>ask(step+1), 350); }
    else { setTimeout(runSearch, 500); }
  }

  function runSearch() {
    setPhase('searching');
    setMsgs(m=>[...m, { who:'sys', t:'search' }]);
    setTimeout(()=>{
      setMsgs(m=>[...m, { who:'ai', t:'C\'est tout bon&nbsp;! 🎉 J\'ai comparé <b>1 240 offres en temps réel</b>. Voici les <b>4 destinations</b> qui correspondent le mieux à votre famille — et j\'ai déjà un coup de cœur.', expr:'enthusiastic' }]);
      setPhase('done');
    }, 2600);
  }

  const q = step>=0 ? QS[step] : null;
  const canValidate = phase==='ask' && (q.kind==='chips' ? draft!=null : q.kind.includes('multi') ? true : draft!=null);

  return (
    <div className="screen chat">
      <div className="chat-head">
        <button className="icon-btn" onClick={()=>go('home')} aria-label="Retour"><Icon n="arrowLeft" size={22} /></button>
        <LivingWebbina size={48} ring
          state={speaking?'speaking':(phase==='searching'||typing)?'thinking':'idle'}
          expr={phase==='done'?'enthusiastic':(phase==='searching'||typing)?'focused':'happy'} />
        <div style={{ flex:1 }}>
          <b style={{ fontFamily:'var(--font-display)', fontSize:16 }}>Webbina</b>
          <div className="micro row gap2" style={{ alignItems:'center' }}><span className="online-dot"></span>{speaking?'parle…':'répond en direct'}</div>
        </div>
        <VoiceToggle compact />
        <ConvoProgress step={step} total={QS.length} phase={phase} />
      </div>

      <div className="chat-body" ref={scroller}>
        {(()=>{ const lastAi = (function(){ for(let i=msgs.length-1;i>=0;i--){ if(msgs[i].who==='ai') return i; } return -1; })();
          return (<React.Fragment>
            {lastAi>=0 && (
              <div className="speak-stage">
                <LivingWebbina size={148} ring state={speaking?'speaking':'idle'} expr={speaking?speakExpr:(msgs[lastAi].expr||'happy')} />
                <div className="speak-caption">
                  {speaking
                    ? <React.Fragment><span className="sc-spoken">{speakText.slice(0, Math.ceil(speakText.length*speakProg))}</span><span className="sc-rest">{speakText.slice(Math.ceil(speakText.length*speakProg))}</span></React.Fragment>
                    : <span className="sc-spoken" dangerouslySetInnerHTML={{__html: msgs[lastAi].t}} />}
                </div>
              </div>
            )}
            {msgs.map((m,i)=>(
              i===lastAi ? null   // shown immersively on the stage above (no duplicate bubble)
              : m.who==='ai' ? <MsgAI key={i} anim expr={m.expr}><span dangerouslySetInnerHTML={{__html:m.t}} /></MsgAI>
              : m.who==='user' ? <MsgUser key={i}>{m.t}</MsgUser>
              : m.who==='flights' ? <FlightBubble key={i} dest={m.dest} items={m.items} onOpen={()=>go('detail', m.dest)} />
              : m.who==='devis' ? <DevisBubble key={i} m={m} onBook={()=>book && book({ dest:m.dest, package:m.pkg, flight:{ airline:'Séjour '+(m.dest&&m.dest.name||''), code:'★', price:m.pkg&&m.pkg.pricing?Math.round(m.pkg.pricing.total/((m.adults||0)+(m.children||0)||1)):0, via:(m.pkg&&m.pkg.nights||7)+' nuits', dur:'Vol + hébergement + activités', time:'', _kids:m.children, _adults:m.adults } })} onDetail={()=>go('detail', { ...(m.dest||{}), price:(m.dest&&m.dest.price) || (m.pkg&&m.pkg.pricing?Math.round(m.pkg.pricing.total/((m.adults||0)+(m.children||0)||1)):0), nights:(m.pkg&&m.pkg.nights)||(m.dest&&m.dest.nights)||7, _dealOrigin:(m.pkg&&m.pkg.origin)||'CDG', _pax:(m.adults||0)+(m.children||0), _kids:m.children, _budget:m.budget }) } />
              : <SearchCard key={i} />
            ))}
          </React.Fragment>);
        })()}
        {typing && <Typing expr="focused" />}
        {phase==='done' && (
          <div style={{ marginTop:8 }}>
            <button className="btn btn--cta btn--block" onClick={()=>go('results', answers)}><Icon n="compass" size={20} />Voir mes 4 destinations<Icon n="arrowRight" size={20} /></button>
            <button className="btn btn--secondary btn--block" style={{ marginTop:8 }} onClick={()=>{ try{ const a=answers||{}; window.__TF_RT_PREFILL={ origin:a.from||'', travelers:Math.max(1,(+a.adults||2)+(+a.kids||0)), budget:+a.budget||0 }; }catch(e){} go('roadtrip'); }}><Icon n="route" size={18} />Ou un carnet de route sur mesure</button>
          </div>
        )}
      </div>

      {/* answer dock */}
      {phase==='ask' && (
        <div className="answer-dock" key={step}>
          {q.kind==='stepper' && <Stepper value={draft} set={setDraft} min={q.min} max={q.max} suffix={q.suffix} />}
          {q.kind==='slider' && <Slider value={draft} set={setDraft} min={q.min} max={q.max} step={q.step} unit={q.unit} />}
          {(q.kind==='chips'||q.kind==='chips-multi') && <ChipPick options={q.options} multi={q.kind==='chips-multi'} value={q.kind==='chips-multi'?(draft||[]):draft} set={setDraft} />}
          <button className="btn btn--primary btn--block" style={{ marginTop:14 }} disabled={!canValidate} onClick={validate}>
            {q.kind==='chips-multi' && (!draft||!draft.length) ? 'Passer' : 'Valider'} <Icon n="check" size={18} />
          </button>
        </div>
      )}

      {/* free-text composer: talk to the real Webbina anytime (always available) */}
      <form className="free-dock" onSubmit={sendFree}>
          {speechOK && (
            <button type="button" className={`free-mic ${listening?'on':''}`} onClick={toggleMic} aria-label="Parler à Webbina">
              <Icon n="mic" size={20} />
              {listening && <span className="mic-ping"></span>}
            </button>
          )}
          <input
            value={input}
            onChange={e=>setInput(e.target.value)}
            placeholder={listening ? 'Je vous écoute… (touchez le micro pour stopper)' : (speechOK ? 'Parlez ou écrivez à Webbina…' : 'Écrivez à Webbina…')}
            aria-label="Message à Webbina"
          />
          <button type="submit" className="free-send" disabled={!input.trim()||sending} aria-label="Envoyer">
            <Icon n="send" size={19} />
          </button>
        </form>
    </div>
  );
}

function ConvoProgress({ step, total, phase }) {
  const done = phase==='done' || phase==='searching';
  const cur = done ? total : Math.max(0, step);
  return (
    <div style={{ textAlign:'right', flex:'none' }}>
      <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:13, color:'var(--ocean)' }}>{Math.min(cur, total)}/{total}</div>
      <div style={{ width:46, height:5, borderRadius:99, background:'var(--slate-100)', marginTop:3, overflow:'hidden' }}>
        <div style={{ width:`${(Math.min(cur,total)/total)*100}%`, height:'100%', background:'var(--grad-ocean)', transition:'width .4s' }}></div>
      </div>
    </div>
  );
}

function SearchCard() {
  const [done, setDone] = React.useState({});
  const groups = [['plane','Vols', TF.CONNECTORS.flights],['bed','Hôtels', TF.CONNECTORS.hotels],['compass','Activités', TF.CONNECTORS.activities]];
  React.useEffect(()=>{
    const timers=groups.map((g,i)=>setTimeout(()=>setDone(d=>({...d,[i]:true})), 600+i*650));
    return ()=>timers.forEach(clearTimeout);
  },[]);
  return (
    <div className="search-card">
      <div className="row gap3" style={{ marginBottom:12 }}>
        <Avatar size={32} ring expr="focused" />
        <b style={{ fontFamily:'var(--font-display)', fontSize:14.5 }}>Je compare en temps réel…</b>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {groups.map((g,i)=>(
          <div key={i}>
            <div className="row gap2" style={{ marginBottom:6 }}>
              {done[i] ? <Icon n="check" size={16} style={{ color:'var(--success)' }} /> : <span className="mini-spin"></span>}
              <span style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:13.5 }}>{g[1]}</span>
            </div>
            <div className="row wrap gap2" style={{ opacity: done[i]?1:.45, transition:'opacity .3s' }}>
              {g[2].map(n=><Connector key={n} name={n} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Inline flight results inside the conversation (real Duffel offers). */
const CONVO_AIRLINES = { AF:'Air France', KL:'KLM', LH:'Lufthansa', BA:'British Airways', EK:'Emirates', QR:'Qatar Airways', TK:'Turkish Airlines', EY:'Etihad', SQ:'Singapore Airlines', AA:'American Airlines', UA:'United', IB:'Iberia', TP:'TAP Air Portugal', AZ:'ITA Airways', U2:'easyJet', FR:'Ryanair', VY:'Vueling', LX:'SWISS', SN:'Brussels Airlines' };
function convoIsoHM(iso){ if(!iso) return ''; const m=/PT(?:(\d+)H)?(?:(\d+)M)?/.exec(iso); if(!m) return ''; return ((m[1]?m[1]+' h':'')+(m[2]?' '+m[2]+' min':'')).trim()||'—'; }
function convoHHMM(dt){ try{ return new Date(dt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); }catch(e){ return ''; } }

function FlightBubble({ dest, items, onOpen }) {
  return (
    <div className="flight-bubble">
      <div className="fb-head">
        <Avatar size={30} expr="enthusiastic" />
        <div className="micro" style={{ color:'var(--ocean-700)', fontWeight:700 }}><Icon n="check" size={13} /> Vols réels · Paris → {dest.name}</div>
      </div>
      <div className="fb-list">
        {items.map((o,idx)=>{
          const segs=o.segments||[]; const first=segs[0]||{}; const last=segs[segs.length-1]||{};
          const code=first.carrierCode||'??';
          return (
            <button key={o.id||idx} className={`fb-card ${idx===0?'best':''}`} onClick={onOpen}>
              {idx===0 && <span className="fb-best"><Icon n="sparkles" size={11} />Meilleur choix</span>}
              <div className="row between" style={{ alignItems:'center' }}>
                <div className="row gap2" style={{ alignItems:'center' }}>
                  <span className="fb-logo">{code}</span>
                  <div style={{ textAlign:'left' }}>
                    <b style={{ fontFamily:'var(--font-display)', fontSize:13.5 }}>{CONVO_AIRLINES[code]||code}</b>
                    <div className="micro">{convoHHMM(first.departureAt)} → {convoHHMM(last.arrivalAt)}</div>
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <b style={{ fontFamily:'var(--font-display)', fontSize:16 }}>{Math.round(o.price&&o.price.amount||0)} €</b>
                  <div className="micro">{o.stops===0?'Direct':o.stops+' escale'+(o.stops>1?'s':'')} · {convoIsoHM(o.durationIso)}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <button className="btn btn--secondary btn--block" style={{ marginTop:4 }} onClick={onOpen}>Voir le détail complet<Icon n="arrowRight" size={17} /></button>
    </div>
  );
}

/* Inline full quote (devis) inside the conversation: flight + stay + activities, one price. */
function devisFmt(n){ return Math.round(n||0).toLocaleString('fr-FR'); }
function DevisBubble({ m, onBook, onDetail }){
  if(m.loading){
    return (
      <div className="devis-bubble">
        <div className="fb-head"><Avatar size={30} expr="focused" /><div className="micro" style={{ fontWeight:700 }}>Je compose votre devis pour {m.dest}… ✨</div></div>
        <div className="devis-skel"><span></span><span></span><span></span></div>
      </div>
    );
  }
  const p=m.pkg||{}; const pr=p.pricing||{}; const pax=(m.adults||0)+(m.children||0)||1;
  const fl=p.flight||{}; const ho=p.hotel||{}; const ac=p.activities||{};
  const within = m.budget ? (pr.total||0)<=m.budget : true;
  return (
    <div className="devis-bubble">
      <div className="fb-head"><Avatar size={30} expr="enthusiastic" /><div className="micro" style={{ color:'var(--success)', fontWeight:700 }}><Icon n="check" size={13} /> Devis assemblé · {m.dest&&m.dest.name}</div></div>
      <div className="devis-title">{m.dest&&m.dest.name} · {p.nights||7} nuits · {pax} voyageur{pax>1?'s':''}</div>
      <div className="devis-lines">
        <div className="devis-line"><span className="dl-ic"><Icon n="plane" size={15} /></span><div className="dl-txt"><b>Vol aller-retour</b><span className="micro">{fl.stops===0?'Direct':((fl.stops||0)+' escale'+((fl.stops||0)>1?'s':''))} · {(fl.source||'')==='duffel-live'?'prix réel':'estimation'}</span></div><b className="dl-price">{devisFmt(fl.total)} €</b></div>
        <div className="devis-line"><span className="dl-ic"><Icon n="bed" size={15} /></span><div className="dl-txt"><b>Hébergement</b><span className="micro">{p.nights||7} nuits {ho.estimated?'· estimation':''}</span></div><b className="dl-price">{devisFmt(ho.total)} €</b></div>
        <div className="devis-line"><span className="dl-ic"><Icon n="sparkles" size={15} /></span><div className="dl-txt"><b>Activités</b><span className="micro">{(ac.items&&ac.items.length)||3} expériences famille</span></div><b className="dl-price">{devisFmt(ac.total)} €</b></div>
      </div>
      <div className="devis-total"><span>Total estimé</span><b>{devisFmt(pr.total)} €</b></div>
      {m.budget>0 && <div className="micro" style={{ marginTop:4, color: within?'var(--success)':'var(--warning)', fontWeight:600 }}>{within?<React.Fragment><Icon n="check" size={12} /> Dans votre budget de {devisFmt(m.budget)} €</React.Fragment>:<React.Fragment><Icon n="info" size={12} /> Légèrement au-dessus de {devisFmt(m.budget)} € — je peux ajuster</React.Fragment>}</div>}
      <button className="btn btn--primary btn--block" style={{ marginTop:12 }} onClick={onBook}>Réserver ce séjour · {devisFmt(pr.total)} €<Icon n="arrowRight" size={17} /></button>
      <button className="btn btn--ghost btn--block" style={{ marginTop:6 }} onClick={onDetail}>Voir le détail jour par jour</button>
    </div>
  );
}

Object.assign(window, { ConversationScreen, FlightBubble, DevisBubble });
