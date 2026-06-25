/* TravelFamily.AI prototype — screens B (results, detail, dashboard, profil, favoris) */

/* ============ RESULTS ============ */
function ResultsScreen({ go, favs, toggleFav }) {
  const [filter, setFilter] = React.useState('Tous');
  const filters = ['Tous','☀️ Plage','🏔️ Nature','✈️ Sans avion','💶 -700 €'];
  return (
    <div className="screen">
      <div className="sub-head">
        <button className="icon-btn" onClick={()=>go('chat')} aria-label="Retour"><Icon n="arrowLeft" size={22} /></button>
        <div style={{ flex:1 }}>
          <b style={{ fontFamily:'var(--font-display)', fontSize:17 }}>12 destinations pour vous</b>
          <div className="micro">Soleil · août · 5 pers. · &lt; 3000 €</div>
        </div>
        <button className="icon-btn" aria-label="Filtres"><Icon n="sliders" size={22} /></button>
      </div>
      <div className="quick-suggest" style={{ padding:'12px 16px', flexWrap:'nowrap', overflowX:'auto' }}>
        {filters.map(f=><button key={f} className={`chip ${filter===f?'chip--active':''}`} style={{ flex:'none' }} onClick={()=>setFilter(f)}>{f}</button>)}
      </div>
      <div style={{ padding:'4px 16px 16px', display:'flex', flexDirection:'column', gap:16 }}>
        <div className="row gap3" style={{ background:'var(--ocean-50)', borderRadius:'var(--r-md)', padding:'12px 14px' }}>
          <Avatar size={32} />
          <div className="micro" style={{ color:'var(--ocean-700)' }}><b>Mon coup de cœur&nbsp;:</b> Annecy, si vous voulez éviter l'avion avec les enfants. 💙</div>
        </div>
        {DESTINATIONS.map(d=><DestCard key={d.id} d={d} onOpen={()=>go('detail', d)} fav={favs.includes(d.id)} onFav={toggleFav} />)}
      </div>
    </div>
  );
}

/* ============ DETAIL ============ */
function DetailScreen({ trip, go, favs, toggleFav }) {
  const d = trip || DESTINATIONS[0];
  const fav = favs.includes(d.id);
  return (
    <div className="screen" style={{ paddingBottom:90 }}>
      <div className="detail-hero" style={{ backgroundImage:`url(assets/${d.img})` }}>
        <div className="detail-hero-bar">
          <button className="icon-btn glass" onClick={()=>go('results')} aria-label="Retour"><Icon n="arrowLeft" size={22} /></button>
          <div className="row gap2">
            <button className="icon-btn glass" aria-label="Partager"><Icon n="download" size={20} /></button>
            <button className="icon-btn glass" onClick={()=>toggleFav(d.id)} aria-label="Favori" style={{ color: fav?'var(--coral)':'#fff' }}><Icon n="heart" size={20} /></button>
          </div>
        </div>
        <div className="detail-hero-cap">
          <Badge tone={d.ribbon[1]} icon="star">{d.ribbon[0]}</Badge>
          <h2 style={{ color:'#fff', fontSize:30, marginTop:8 }}>{d.name}</h2>
          <div className="row gap3" style={{ color:'#fff', opacity:.95, marginTop:4, fontSize:14 }}>
            <span className="row gap2"><Icon n="mapPin" size={15} />{d.tag}</span>
            <span className="row gap2"><Icon n="star" size={15} />{String(d.rating).replace('.',',')}</span>
            <span className="row gap2"><Icon n="users" size={15} />{d.kid}</span>
          </div>
        </div>
      </div>

      <div style={{ padding:'18px 16px', display:'flex', flexDirection:'column', gap:16 }}>
        <div className="row gap3" style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'14px 16px', boxShadow:'var(--sh-sm)' }}>
          <Avatar size={38} />
          <div style={{ fontSize:14.5, lineHeight:1.5 }}><b style={{ fontFamily:'var(--font-display)' }}>Pourquoi je la recommande&nbsp;:</b> {d.desc}</div>
        </div>

        {/* budget */}
        <div className="card card--pad">
          <div className="row between" style={{ marginBottom:12 }}>
            <h4 style={{ fontSize:18 }}>Budget estimé</h4>
            <b style={{ fontFamily:'var(--font-display)', fontSize:22 }}>{d.price*5} €</b>
          </div>
          <div style={{ height:14, borderRadius:99, background:'var(--slate-100)', overflow:'hidden' }}><div style={{ width:'68%', height:'100%', background:'var(--grad-ocean)' }}></div></div>
          <div className="row between micro" style={{ marginTop:8 }}><span>pour 5 personnes</span><span style={{ color:'var(--success)', fontWeight:700 }}>dans votre budget ✓</span></div>
          <div className="row wrap gap2" style={{ marginTop:12 }}>
            <Badge tone="ocean" icon="plane">Vols {Math.round(d.price*2.4)} €</Badge>
            <Badge tone="turq" icon="bed">Séjour {Math.round(d.price*2.1)} €</Badge>
            <Badge tone="coral" icon="compass">Activités {Math.round(d.price*0.5)} €</Badge>
          </div>
        </div>

        {/* hébergement */}
        <div>
          <h4 style={{ fontSize:18, marginBottom:10 }}>Hébergement familial</h4>
          <div className="card" style={{ overflow:'hidden', display:'flex', gap:14, padding:12, alignItems:'center' }}>
            <div style={{ width:88, height:88, borderRadius:'var(--r-md)', backgroundImage:'url(assets/photo-hotel.jpg)', backgroundSize:'cover', flex:'none' }}></div>
            <div style={{ flex:1 }}>
              <Badge tone="success" icon="check">Chambre familiale</Badge>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:16, margin:'6px 0 2px' }}>Riad Resort & Spa</div>
              <div className="row gap3 micro"><span className="row gap2"><Icon n="star" size={13} />4,8</span><span className="row gap2"><Icon n="bed" size={13} />4 nuits</span></div>
            </div>
          </div>
        </div>

        {/* activités */}
        <div>
          <h4 style={{ fontSize:18, marginBottom:10 }}>Activités pour les enfants</h4>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {ACTIVITIES.map((a,i)=>(
              <div key={i} className="card" style={{ display:'flex', gap:12, padding:10, alignItems:'center' }}>
                <div style={{ width:64, height:64, borderRadius:'var(--r-md)', backgroundImage:`url(assets/${a.img})`, backgroundSize:'cover', flex:'none' }}></div>
                <div style={{ flex:1 }}>
                  <Badge tone={a.tag[1]} icon="check">{a.tag[0]}</Badge>
                  <div style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:15, margin:'5px 0 3px' }}>{a.name}</div>
                  <div className="row gap3 micro"><span className="row gap2"><Icon n="clock" size={13} />{a.dur}</span><span>{a.age}</span><span className="row gap2" style={{color:'var(--gold-700)'}}><Icon n="star" size={13} />{String(a.rating).replace('.',',')}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="sticky-cta">
        <div><div className="micro">Voyage complet · 5 pers.</div><b style={{ fontFamily:'var(--font-display)', fontSize:20 }}>{d.price*5} €</b></div>
        <button className="btn btn--cta" onClick={()=>go('dashboard')}>Préparer ce voyage<Icon n="arrowRight" size={20} /></button>
      </div>
    </div>
  );
}

/* ============ DASHBOARD (Mes voyages) ============ */
function DashboardScreen({ go }) {
  return (
    <div className="screen">
      <div style={{ padding:'16px 18px 0' }}>
        <h2 style={{ fontSize:26 }}>Mes voyages</h2>
      </div>
      <div style={{ padding:'16px 18px 8px' }}>
        <div className="micro" style={{ fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:10 }}>Prochain départ</div>
        <div className="card" style={{ overflow:'hidden' }}>
          <div className="detail-hero" style={{ backgroundImage:'url(assets/photo-beach.jpg)', height:180, borderRadius:0 }}>
            <div className="detail-hero-cap">
              <Badge tone="coral" icon="plane">Dans 34 jours</Badge>
              <h3 style={{ color:'#fff', fontSize:24, marginTop:6 }}>Bali, Indonésie</h3>
              <div className="micro" style={{ color:'#fff', opacity:.9 }}>12 – 26 juillet 2026 · Famille Martin</div>
            </div>
          </div>
          <div style={{ padding:14, display:'flex', gap:8 }}>
            <button className="btn btn--secondary btn--sm" style={{ flex:1 }}><Icon n="compass" size={16} />Itinéraire</button>
            <button className="btn btn--secondary btn--sm" style={{ flex:1 }}><Icon n="wallet" size={16} />Budget</button>
            <button className="btn btn--primary btn--sm" style={{ flex:1 }}><Icon n="briefcase" size={16} />Carnet</button>
          </div>
        </div>
      </div>

      <div style={{ padding:'8px 18px 8px' }}>
        <div className="micro" style={{ fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:10 }}>Itinéraire · aperçu</div>
        <div className="card card--pad" style={{ display:'flex', flexDirection:'column', gap:2 }}>
          {[['Jour 1','Arrivée à Bali','Détente à Jimbaran','sun'],['Jour 2','Temple d\'Uluwatu','Plage de Padang','mapPin'],['Jour 3','Snorkeling lagon','Adapté aux enfants','compass']].map((s,i)=>(
            <div key={i} className="row gap3" style={{ padding:'10px 0', borderBottom: i<2?'1px dashed var(--border)':'none' }}>
              <div style={{ width:40, height:40, borderRadius:12, background:'var(--ocean-50)', color:'var(--ocean-700)', display:'grid', placeItems:'center', flex:'none' }}><Icon n={s[3]} size={20} /></div>
              <div style={{ flex:1 }}><b style={{ fontFamily:'var(--font-display)', fontSize:15 }}>{s[1]}</b><div className="micro">{s[0]} · {s[2]}</div></div>
              <Icon n="chevronRight" size={18} style={{ color:'var(--text-muted)' }} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding:'8px 18px 20px' }}>
        <div className="micro" style={{ fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:10 }}>Mes projets</div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[['photo-mountain.jpg','Road trip Alpes','Idée · mars 2026'],['photo-street.jpg','Week-end Lisbonne','Devis en cours']].map((p,i)=>(
            <div key={i} className="card" style={{ display:'flex', gap:12, padding:10, alignItems:'center' }} onClick={()=>go('chat')}>
              <div style={{ width:56, height:56, borderRadius:'var(--r-md)', backgroundImage:`url(assets/${p[0]})`, backgroundSize:'cover', flex:'none' }}></div>
              <div style={{ flex:1 }}><b style={{ fontFamily:'var(--font-display)', fontSize:15 }}>{p[1]}</b><div className="micro">{p[2]}</div></div>
              <Icon n="chevronRight" size={18} style={{ color:'var(--text-muted)' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============ FAVORIS ============ */
function FavorisScreen({ go, favs, toggleFav }) {
  const list = DESTINATIONS.filter(d=>favs.includes(d.id));
  return (
    <div className="screen">
      <div style={{ padding:'16px 18px 6px' }}><h2 style={{ fontSize:26 }}>Mes favoris</h2></div>
      {list.length===0 ? (
        <div style={{ padding:'60px 30px', textAlign:'center', color:'var(--text-muted)' }}>
          <Icon n="heart" size={48} /><p style={{ marginTop:14 }}>Touchez le cœur sur une destination pour la retrouver ici.</p>
        </div>
      ) : (
        <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:16 }}>
          {list.map(d=><DestCard key={d.id} d={d} onOpen={()=>go('detail', d)} fav={true} onFav={toggleFav} />)}
        </div>
      )}
    </div>
  );
}

/* ============ PROFIL ============ */
function ProfilScreen() {
  const [simple, setSimple] = React.useState(false);
  const [voice, setVoice] = React.useState(true);
  const Toggle = ({ on, set }) => (
    <button onClick={()=>set(!on)} style={{ width:48, height:28, borderRadius:99, background: on?'var(--ocean)':'var(--slate-200)', position:'relative', border:'none', cursor:'pointer', flex:'none', transition:'background .2s' }}>
      <span style={{ width:22, height:22, borderRadius:'50%', background:'#fff', position:'absolute', top:3, left: on?23:3, transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)' }}></span>
    </button>
  );
  return (
    <div className="screen">
      <div style={{ padding:'18px 18px 0', textAlign:'center' }}>
        <Avatar size={84} style={{ margin:'0 auto' }} />
        <h3 style={{ marginTop:12, fontSize:22 }}>Famille Martin</h3>
        <span className="badge badge--premium" style={{ marginTop:6 }}><Icon n="crown" size={13} />Membre Premium</span>
      </div>
      <div style={{ padding:'22px 18px' }}>
        <div className="card card--pad">
          <h4 style={{ fontSize:17, marginBottom:14 }}>Confort de lecture</h4>
          {[['Texte agrandi','Plus gros, plus lisible pour tous', simple, setSimple],['Lecture vocale de Webbina','Elle lit ses réponses à voix haute', voice, setVoice]].map((r,i)=>(
            <div key={i} className="row between" style={{ padding:'12px 0', borderBottom: i===0?'1px solid var(--border)':'none' }}>
              <div style={{ flex:1, paddingRight:14 }}><b style={{ fontFamily:'var(--font-display)', fontSize:15 }}>{r[0]}</b><div className="micro">{r[1]}</div></div>
              <Toggle on={r[2]} set={r[3]} />
            </div>
          ))}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:2, marginTop:16 }}>
          {[['user','Mon compte'],['users','Ma famille & enfants'],['wallet','Moyens de paiement'],['shield','Données & confidentialité'],['phone','Aide & contact humain']].map((r,i)=>(
            <div key={i} className="row gap3 card" style={{ padding:'14px 16px', alignItems:'center' }}>
              <div style={{ width:38, height:38, borderRadius:11, background:'var(--slate-100)', color:'var(--ocean-700)', display:'grid', placeItems:'center', flex:'none' }}><Icon n={r[0]} size={20} /></div>
              <b style={{ flex:1, fontFamily:'var(--font-display)', fontSize:15 }}>{r[1]}</b>
              <Icon n="chevronRight" size={18} style={{ color:'var(--text-muted)' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ResultsScreen, DetailScreen, DashboardScreen, FavorisScreen, ProfilScreen });
