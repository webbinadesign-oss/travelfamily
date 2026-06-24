/* TravelFamily.AI app — Dashboard, Travel memory, Gamification, Profil */

function DashboardScreen({ go, openChat }) {
  // Real trips aren't persisted yet → show a clean, inviting empty state for a
  // genuine UX test (no fake "Famille Martin / Bali" pre-filled trip).
  const name = (window.WebbinaAuth && window.WebbinaAuth.getEmail && window.WebbinaAuth.getEmail())
    ? window.WebbinaAuth.getEmail().split('@')[0] : null;
  return (
    <div className="screen">
      <div style={{ padding:'16px 18px 0' }}>
        <div className="row between">
          <h2 style={{ fontSize:26 }}>Mes voyages</h2>
          <button className="icon-btn" onClick={()=>go('badges')} aria-label="Récompenses"><Icon n="star" size={22} style={{ color:'var(--gold)' }} /></button>
        </div>
        {name && <div className="micro" style={{ marginTop:2, textTransform:'capitalize' }}>Bonjour {name} 👋</div>}
      </div>

      {/* empty state — no trip yet */}
      <div style={{ padding:'18px' }}>
        <div className="card card--pad" style={{ textAlign:'center' }}>
          <LivingWebbina size={72} state="idle" expr="happy" style={{ margin:'0 auto 6px' }} />
          <h3 style={{ fontSize:19, marginTop:6 }}>Aucun voyage pour l'instant</h3>
          <p className="micro" style={{ marginTop:6, lineHeight:1.5, maxWidth:'34ch', marginInline:'auto' }}>Dites-moi où vous rêvez d'aller, et je compose votre prochain séjour en famille — vols, hébergement et activités, dans votre budget.</p>
          <button className="btn btn--primary btn--block" style={{ marginTop:14 }} onClick={()=> openChat ? openChat('home') : go('chat')}><Icon n="sparkles" size={17} />Planifier avec Webbina</button>
        </div>
      </div>

      {/* travel memory (real, from account when available) */}
      <div style={{ padding:'0 18px 8px' }}>
        <div className="micro sec-cap">Mémoire voyage</div>
        <div className="card card--pad" style={{ display:'flex', flexDirection:'column', gap:2 }}>
          {TF.MEMORY.map((m,i)=>(
            <div key={i} className="row gap3" style={{ padding:'11px 0', borderBottom: i<TF.MEMORY.length-1?'1px dashed var(--border)':'none' }}>
              <div className="mem-ic"><Icon n={m.ic} size={18} /></div>
              <div style={{ flex:1 }}><b style={{ fontFamily:'var(--font-display)', fontSize:14.5 }}>{m.label}</b></div>
              <div className="row gap2" style={{ alignItems:'center' }}>
                {m.status && <StatusDot status={m.status} size={9} />}
                <span className="micro" style={{ fontWeight:600, color:'var(--text)' }}>{m.value}</span>
              </div>
            </div>
          ))}
          <button className="btn btn--ghost btn--sm" style={{ marginTop:6, alignSelf:'flex-start' }} onClick={()=>go('formalites')}><Icon n="plus" size={16} />Ajouter un document</button>
        </div>
      </div>
    </div>
  );
}

/* ---- Gamification ---- */
function BadgesScreen({ go }) {
  const earned = TF.BADGES.filter(b=>b.earned).length;
  return (
    <div className="screen" style={{ paddingBottom:30 }}>
      <div className="sub-head">
        <button className="icon-btn" onClick={()=>go('dashboard')} aria-label="Retour"><Icon n="arrowLeft" size={22} /></button>
        <div style={{ flex:1 }}><b style={{ fontFamily:'var(--font-display)', fontSize:17 }}>Récompenses</b><div className="micro">{earned}/{TF.BADGES.length} badges débloqués</div></div>
      </div>
      <div style={{ padding:'16px 16px 0' }}>
        <div className="card card--pad" style={{ background:'var(--grad-premium)', color:'#fff', border:'none', textAlign:'center' }}>
          <Avatar size={64} ring expr="enthusiastic" style={{ margin:'0 auto 6px' }} />
          <div style={{ fontFamily:'var(--font-hand)', fontSize:24, color:'var(--gold)' }}>Famille Voyageuse</div>
          <div className="display" style={{ fontSize:44, color:'#fff' }}>3</div>
          <div className="micro" style={{ color:'rgba(255,255,255,.75)' }}>pays explorés ensemble</div>
        </div>
        <div className="grid" style={{ gridTemplateColumns:'1fr 1fr', gap:12, marginTop:16 }}>
          {TF.BADGES.map(b=>(
            <div key={b.id} className={`badge-card ${b.earned?'earned':''}`}>
              <div className="badge-medal" style={{ background: b.earned?`var(--${b.color}-50)`:'var(--slate-100)', color: b.earned?`var(--${b.color}-700)`:'var(--text-muted)' }}>
                <Icon n={b.ic} size={30} />
                {b.earned && <span className="medal-star"><Icon n="check" size={13} /></span>}
              </div>
              <b style={{ fontFamily:'var(--font-display)', fontSize:15, marginTop:10 }}>{b.name}</b>
              <div className="micro" style={{ textAlign:'center' }}>{b.desc}</div>
              {!b.earned && b.progress!=null && (
                <div style={{ width:'100%', marginTop:8 }}>
                  <div style={{ height:6, borderRadius:99, background:'var(--slate-100)', overflow:'hidden' }}><div style={{ width:`${b.progress}%`, height:'100%', background:`var(--${b.color})` }}></div></div>
                  <div className="micro" style={{ textAlign:'center', marginTop:4 }}>{b.progress}%</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---- Profil ---- */
function ProfilScreen({ go }) {
  const [simple, setSimple] = React.useState(false);
  const [voice, setVoice] = React.useState(true);
  const Toggle = ({ on, set }) => (
    <button onClick={()=>set(!on)} className="tf-toggle" style={{ background: on?'var(--ocean)':'var(--slate-200)' }} aria-pressed={on}>
      <span style={{ left: on?23:3 }}></span>
    </button>
  );
  return (
    <div className="screen">
      <div style={{ padding:'18px 18px 0', textAlign:'center' }}>
        <Avatar size={84} ring style={{ margin:'0 auto' }} />
        <h3 style={{ marginTop:12, fontSize:22 }}>{(window.WebbinaAuth && window.WebbinaAuth.getEmail && window.WebbinaAuth.getEmail()) ? window.WebbinaAuth.getEmail().split('@')[0] : 'Mon profil'}</h3>
        <span className="badge" style={{ marginTop:6, background:'var(--surface-sunk)', color:'var(--text-2)' }}><Icon n="user" size={13} />Compte gratuit</span>
      </div>
      <div style={{ padding:'22px 18px 20px' }}>
        <div className="card card--pad">
          <h4 style={{ fontSize:17, marginBottom:6 }}>Confort de lecture</h4>
          <p className="micro" style={{ marginBottom:8 }}>Pensé pour que chacun lise et navigue sans effort.</p>
          {[['Texte agrandi','Plus gros, plus lisible pour tous', simple, setSimple],['Lecture vocale de Webbina','Elle lit ses réponses à voix haute', voice, setVoice]].map((r,i)=>(
            <div key={i} className="row between" style={{ padding:'12px 0', borderBottom: i===0?'1px solid var(--border)':'none' }}>
              <div style={{ flex:1, paddingRight:14 }}><b style={{ fontFamily:'var(--font-display)', fontSize:15 }}>{r[0]}</b><div className="micro">{r[1]}</div></div>
              <Toggle on={r[2]} set={r[3]} />
            </div>
          ))}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:2, marginTop:16 }}>
          {[['star','Mes récompenses','badges'],['briefcase','Mémoire voyage','dashboard'],['users','Ma famille & enfants',null],['wallet','Moyens de paiement',null],['shield','Données & confidentialité',null],['phone','Aide & conseiller humain',null]].map((r,i)=>(
            <button key={i} className="row gap3 card profil-row" onClick={()=> r[2] && go(r[2])}>
              <div className="mem-ic"><Icon n={r[0]} size={20} /></div>
              <b style={{ flex:1, textAlign:'left', fontFamily:'var(--font-display)', fontSize:15 }}>{r[1]}</b>
              <Icon n="chevronRight" size={18} style={{ color:'var(--text-muted)' }} />
            </button>
          ))}
        </div>
        <button className="btn btn--ghost btn--block" style={{ marginTop:16, color:'var(--coral-700)' }} onClick={()=>go('welcome')}>Se déconnecter</button>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardScreen, BadgesScreen, ProfilScreen });
