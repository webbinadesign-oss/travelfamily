/* TravelFamily.AI prototype — screens */
const { useState:useStateS, useEffect:useEffectS, useRef:useRefS } = React;

/* ============ HOME ============ */
function HomeScreen({ go, openChat, favs, toggleFav }) {
  return (
    <div className="screen">
      <div style={{ padding:'14px 18px 0' }}>
        <div className="row between">
          <div className="row gap3">
            <Avatar size={46} />
            <div>
              <div className="micro">Bonjour 👋</div>
              <b style={{ fontFamily:'var(--font-display)', fontSize:18 }}>Famille Martin</b>
            </div>
          </div>
          <button className="icon-btn" aria-label="Notifications"><Icon n="bell" size={22} /><span className="dot"></span></button>
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

      <div style={{ padding:'24px 18px 6px' }}>
        <div className="row between" style={{ marginBottom:12 }}>
          <h3 style={{ fontSize:19 }}>Par où commencer&nbsp;?</h3>
        </div>
        <div className="grid" style={{ gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {PARCOURS.map(p=><ParcoursCard key={p.id} p={p} onClick={()=>openChat(p.id)} />)}
        </div>
      </div>

      <div style={{ padding:'22px 0 6px' }}>
        <div className="row between" style={{ padding:'0 18px', marginBottom:12 }}>
          <h3 style={{ fontSize:19 }}>Inspirations pour vous</h3>
          <span className="micro" style={{ color:'var(--ocean-700)', fontWeight:700 }}>Tout voir</span>
        </div>
        <div className="hscroll">
          {DESTINATIONS.map(d=>(
            <div key={d.id} style={{ width:230, flex:'none' }}>
              <DestCard d={d} onOpen={()=>go('detail', d)} fav={favs.includes(d.id)} onFav={toggleFav} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding:'10px 18px 20px' }}>
        <div className="card card--pad" style={{ background:'var(--grad-premium)', color:'#fff', border:'none' }}>
          <div className="row between">
            <div>
              <span className="badge badge--premium" style={{ marginBottom:8 }}><Icon n="crown" size={13} />Premium</span>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:18, marginTop:8 }}>Conseiller humain dédié</div>
              <div style={{ fontSize:14, opacity:.85, marginTop:4 }}>Un expert vérifie chaque voyage avec vous.</div>
            </div>
            <Icon n="chevronRight" size={22} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ CHAT (Webbina) ============ */
const CHAT_SCRIPTS = {
  home: [
    { who:'ai', t:'Bonjour&nbsp;! Je suis Webbina, votre experte voyage famille. 🌍 Racontez-moi : qui part, et qu\'avez-vous envie de vivre&nbsp;?' },
  ],
  '01': [{ who:'ai', t:'Parfait, vous avez déjà tout en tête&nbsp;! Dites-moi votre destination et vos dates, je m\'occupe d\'optimiser chaque détail. 😊' }],
  '02': [{ who:'ai', t:'Génial, on a les dates&nbsp;! Laissez-moi vous proposer des destinations qui feront briller les yeux de toute la famille. ✨' }],
  '03': [{ who:'ai', t:'Vous êtes flexible&nbsp;? C\'est mon moment préféré&nbsp;: je vais trouver la meilleure période pour partir au meilleur prix. 🗓️' }],
  '04': [{ who:'ai', t:'Oh, j\'adore&nbsp;! Fermez les yeux… 🪄 Donnez-moi juste une ambiance et un budget, et je vous invente un voyage sur-mesure.' }],
};
const SUGGEST = ['☀️ Au soleil', '👨‍👩‍👧‍👦 2 adultes, 3 enfants', '💶 Budget 3000 €', '✈️ En août'];

function ChatScreen({ ctx, go, favs, toggleFav }) {
  const [msgs, setMsgs] = useStateS(CHAT_SCRIPTS[ctx] || CHAT_SCRIPTS.home);
  const [typing, setTyping] = useStateS(false);
  const [done, setDone] = useStateS(false);
  const [input, setInput] = useStateS('');
  const scroller = useRefS(null);
  useEffectS(()=>{ if(scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }, [msgs, typing]);

  function send(text) {
    if(!text.trim()) return;
    setMsgs(m=>[...m, { who:'user', t:text }]); setInput('');
    setTyping(true);
    setTimeout(()=>{ setTyping(false);
      setMsgs(m=>[...m, { who:'sys', t:'Webbina analyse 1 240 offres en direct…' }]);
      setTyping(true);
      setTimeout(()=>{ setTyping(false);
        setMsgs(m=>[...m, { who:'ai', t:'Super, c\'est noté&nbsp;! 🎉 J\'ai trouvé <b>12 destinations ensoleillées</b> parfaites pour 5 personnes en août, toutes sous 3000&nbsp;€. Envie de les voir&nbsp;?' }]);
        setDone(true);
      }, 1400);
    }, 1300);
  }

  return (
    <div className="screen chat">
      <div className="chat-head">
        <button className="icon-btn" onClick={()=>go('home')} aria-label="Retour"><Icon n="arrowLeft" size={22} /></button>
        <Avatar size={40} ring />
        <div style={{ flex:1 }}>
          <b style={{ fontFamily:'var(--font-display)', fontSize:16 }}>Webbina</b>
          <div className="micro row gap2" style={{ alignItems:'center' }}><span className="online-dot"></span>En ligne · répond en direct</div>
        </div>
        <button className="icon-btn" aria-label="Options"><Icon n="phone" size={20} /></button>
      </div>

      <div className="chat-body" ref={scroller}>
        {msgs.map((m,i)=>(
          m.who==='ai' ? <MsgAI key={i}><span dangerouslySetInnerHTML={{__html:m.t}} /></MsgAI>
          : m.who==='user' ? <MsgUser key={i}>{m.t}</MsgUser>
          : <MsgSystem key={i}><Icon n="sparkles" size={14} style={{marginRight:5}} />{m.t}</MsgSystem>
        ))}
        {typing && <Typing />}
        {done && (
          <div style={{ marginTop:6 }}>
            <button className="btn btn--cta btn--block" onClick={()=>go('results')}><Icon n="compass" size={20} />Voir les 12 destinations<Icon n="arrowRight" size={20} /></button>
          </div>
        )}
      </div>

      {!done && (
        <div className="quick-suggest" style={{ padding:'10px 14px 0', flexWrap:'nowrap', overflowX:'auto' }}>
          {SUGGEST.map((s,i)=><button key={i} className="chip" style={{ flex:'none' }} onClick={()=>send(s)}>{s}</button>)}
        </div>
      )}

      <div className="chat-input">
        <div className="ai-search" style={{ borderRadius:'var(--r-lg)', boxShadow:'none', flex:1 }}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') send(input); }} placeholder="Écrivez à Webbina…" />
          <button className="btn btn--accent btn--icon" style={{ minHeight:44, width:44 }} onClick={()=>send(input)} aria-label="Envoyer"><Icon n="send" size={18} /></button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { HomeScreen, ChatScreen });
