/* TravelFamily.AI app — Dashboard, Travel memory, Gamification, Profil */

function DashboardScreen({ go }) {
  return (
    <div className="screen">
      <div style={{ padding:'16px 18px 0' }}>
        <div className="row between">
          <h2 style={{ fontSize:26 }}>Mes voyages</h2>
          <button className="icon-btn" onClick={()=>go('badges')} aria-label="Récompenses"><Icon n="star" size={22} style={{ color:'var(--gold)' }} /></button>
        </div>
      </div>

      {/* next trip */}
      <div style={{ padding:'16px 18px 8px' }}>
        <div className="micro sec-cap">Prochain départ</div>
        <div className="card" style={{ overflow:'hidden' }}>
          <div className="detail-hero" style={{ backgroundImage:'url(assets/photo-beach.jpg)', height:175, borderRadius:0 }}>
            <div className="detail-hero-cap">
              <Badge tone="coral" icon="plane">Dans 34 jours</Badge>
              <h3 style={{ color:'#fff', fontSize:23, marginTop:6 }}>Bali, Indonésie</h3>
              <div className="micro" style={{ color:'#fff', opacity:.9 }}>12 – 26 juillet 2026 · Famille Martin</div>
            </div>
          </div>
          <div className="trip-progress">
            {[['check','Réservé',true],['shield','Formalités',false],['briefcase','Valise',false]].map((s,i)=>(
              <div key={i} className="tp-step" onClick={()=> s[0]==='shield' && go('formalites')}>
                <div className="tp-ic" style={{ background: s[2]?'var(--success)':'var(--slate-100)', color: s[2]?'#fff':'var(--text-muted)' }}><Icon n={s[2]?'check':s[0]} size={16} /></div>
                <span className="micro" style={{ fontWeight:600, color: s[2]?'var(--success)':'var(--text-2)' }}>{s[1]}</span>
              </div>
            ))}
          </div>
          <div style={{ padding:'0 14px 14px', display:'flex', gap:8 }}>
            <button className="btn btn--secondary btn--sm" style={{ flex:1 }} onClick={()=>go('detail', TF.DESTINATIONS[0])}><Icon n="compass" size={16} />Itinéraire</button>
            <button className="btn btn--secondary btn--sm" style={{ flex:1 }} onClick={()=>go('formalites')}><Icon n="shield" size={16} />Formalités</button>
            <button className="btn btn--primary btn--sm" style={{ flex:1 }}><Icon n="briefcase" size={16} />Carnet</button>
          </div>
        </div>
      </div>

      {/* travel memory */}
      <div style={{ padding:'8px 18px' }}>
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
          <button className="btn btn--ghost btn--sm" style={{ marginTop:6, alignSelf:'flex-start' }}><Icon n="plus" size={16} />Ajouter un document</button>
        </div>
      </div>

      {/* history / quotes */}
      <div style={{ padding:'8px 18px 20px' }}>
        <div className="micro sec-cap">Historique &amp; devis</div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[['photo-mountain.jpg','Road trip Alpes','Réservé · août 2025','green'],['photo-street.jpg','Week-end Lisbonne','Devis en cours','orange'],['photo-sunset.jpg','Sicile en famille','Idée sauvegardée',null]].map((p,i)=>(
            <div key={i} className="card" style={{ display:'flex', gap:12, padding:10, alignItems:'center' }} onClick={()=>go('detail', TF.DESTINATIONS[1])}>
              <div style={{ width:56, height:56, borderRadius:'var(--r-md)', backgroundImage:`url(assets/${p[0]})`, backgroundSize:'cover', flex:'none' }}></div>
              <div style={{ flex:1 }}><b style={{ fontFamily:'var(--font-display)', fontSize:15 }}>{p[1]}</b><div className="micro row gap2" style={{ alignItems:'center', marginTop:2 }}>{p[3] && <StatusDot status={p[3]} size={8} />}{p[2]}</div></div>
              <Icon n="chevronRight" size={18} style={{ color:'var(--text-muted)' }} />
            </div>
          ))}
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
        <span className="badge badge--premium" style={{ marginTop:6 }}><Icon n="crown" size={13} />Membre Premium</span>
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
