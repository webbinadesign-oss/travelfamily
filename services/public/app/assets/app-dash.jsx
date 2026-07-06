/* TravelFamily.AI app — Dashboard, Travel memory, Gamification, Profil */

function DashboardScreen({ go, openChat }) {
  const name = (window.WebbinaAuth && window.WebbinaAuth.getEmail && window.WebbinaAuth.getEmail())
    ? window.WebbinaAuth.getEmail().split('@')[0] : null;
  const [trips, setTrips] = React.useState([]);
  React.useEffect(()=>{
    let alive=true;
    (async()=>{
      let local=[]; try{ local = JSON.parse(localStorage.getItem('tf_trips_local')||'[]'); }catch(e){}
      let remote=[];
      try{ if(window.WebbinaBackend && WebbinaBackend.getTrips){ const r=await WebbinaBackend.getTrips(); if(r&&r.length) remote=r.map(t=>({ id:t.id, ref:t.ref||'', destination:t.destination||t.title||'', country:t.country||'', total:(t.budget&&t.budget.amount)||0, pax:t.travelersCount||0, createdAt:t.createdAt?new Date(t.createdAt).getTime():0, summary:t.summary||'', remote:true })); } }catch(e){}
      if(!alive) return;
      // local first (richest), then remote not already present by ref
      const seen=new Set(local.map(t=>t.ref));
      setTrips([...local, ...remote.filter(t=>!seen.has(t.ref))]);
    })();
    return ()=>{ alive=false; };
  }, []);
  return (
    <div className="screen">
      <div style={{ padding:'16px 18px 0' }}>
        <div className="row between">
          <h2 style={{ fontSize:26 }}>Mes voyages</h2>
          <button className="icon-btn" onClick={()=>go('badges')} aria-label="Récompenses"><Icon n="star" size={22} style={{ color:'var(--gold)' }} /></button>
        </div>
        {name && <div className="micro" style={{ marginTop:2, textTransform:'capitalize' }}>Bonjour {name} 👋</div>}
      </div>

      <div style={{ padding:'18px' }}>
        {trips.length===0 ? (
          <div className="card card--pad" style={{ textAlign:'center' }}>
            <LivingWebbina size={72} state="idle" expr="happy" style={{ margin:'0 auto 6px' }} />
            <h3 style={{ fontSize:19, marginTop:6 }}>Aucun voyage pour l'instant</h3>
            <p className="micro" style={{ marginTop:6, lineHeight:1.5, maxWidth:'34ch', marginInline:'auto' }}>Dites-moi où vous rêvez d'aller, et je compose votre prochain séjour en famille — vols, hébergement et activités, dans votre budget.</p>
            <button className="btn btn--primary btn--block" style={{ marginTop:14 }} onClick={()=> openChat ? openChat('home') : go('chat')}><Icon n="sparkles" size={17} />Planifier avec Webbina</button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {trips.map((t,i)=>(
              <button key={t.id||i} className="card trip-card" onClick={()=>go('tripdetail', t)}>
                <div className="trip-thumb" style={t.img?{ backgroundImage:`url(assets/${t.img})` }:{ background:'var(--grad-premium)' }}>{!t.img && <Icon n="plane" size={22} />}</div>
                <div style={{ flex:1, textAlign:'left', minWidth:0 }}>
                  <b style={{ fontFamily:'var(--font-display)', fontSize:15.5 }}>{t.destination||'Voyage'}{t.country?', '+t.country:''}</b>
                  <div className="micro" style={{ marginTop:2 }}>{t.pax?`${t.pax} voyageur${t.pax>1?'s':''} · `:''}{Math.round(t.total||0).toLocaleString('fr-FR')} €</div>
                  <span className="trip-badge"><Icon n="check" size={11} /> Réservé{t.paid===false?' (test)':''}</span>
                </div>
                <Icon n="chevronRight" size={20} style={{ color:'var(--text-muted)', flex:'none' }} />
              </button>
            ))}
          </div>
        )}
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
        {typeof PriceWatchCard!=='undefined' && <PriceWatchCard go={go} />}
      </div>
    </div>
  );
}

/* ---- Gestion / annulation d'une réservation ---- */
function ManageBooking({ trip, go }){
  const oid = trip && trip.orderId;
  const [state, setState] = React.useState('idle'); // idle|quoting|quote|confirming|done|error
  const [quote, setQuote] = React.useState(null);
  const [err, setErr] = React.useState('');
  // rebooking (change date)
  const [mode, setMode] = React.useState(''); // '' | 'change'
  const [newDate, setNewDate] = React.useState('');
  const [chState, setChState] = React.useState('idle'); // idle|quoting|quote|confirming|done
  const [chQuote, setChQuote] = React.useState(null);
  const [chErr, setChErr] = React.useState('');
  async function doQuote(){
    setErr(''); setState('quoting');
    try{ const q = await WebbinaBackend.cancelQuote(oid); setQuote(q); setState('quote'); }
    catch(e){ setErr('Impossible de calculer le remboursement pour le moment.'); setState('error'); }
  }
  async function doConfirm(){
    setErr(''); setState('confirming');
    try{
      await WebbinaBackend.cancelConfirm(quote.id);
      try{ const a=JSON.parse(localStorage.getItem('tf_trips_local')||'[]').filter(x=>x.id!==trip.id); localStorage.setItem('tf_trips_local', JSON.stringify(a)); }catch(e){}
      setState('done');
    }catch(e){ setErr('La confirmation a échoué. Réessayez ou contactez l\'aide.'); setState('error'); }
  }
  async function doChangeQuote(){
    if(!newDate) return; setChErr(''); setChState('quoting');
    try{ const q = await WebbinaBackend.changeQuote(oid, newDate); setChQuote(q); setChState('quote'); }
    catch(e){ setChErr('Aucune option pour cette date, ou modification indisponible.'); setChState('idle'); }
  }
  async function doChangeConfirm(){
    setChErr(''); setChState('confirming');
    try{ await WebbinaBackend.changeConfirm(chQuote.changeOfferId); setChState('done'); }
    catch(e){ setChErr('La modification a échoué. Réessayez ou contactez l\'aide.'); setChState('idle'); }
  }
  const cur = (c)=> (c==='EUR'||!c)?'€':c;
  if(state==='done'){
    return <div className="micro" style={{ marginTop:12, color:'var(--success)', lineHeight:1.5 }}><Icon n="check" size={14} /> Annulation confirmée. Le remboursement éventuel est traité par la compagnie sous quelques jours.</div>;
  }
  return (
    <div style={{ marginTop:12 }}>
      {/* Modifier (rebooking) */}
      {oid ? (
        chState==='done' ? (
          <div className="micro" style={{ color:'var(--success)', lineHeight:1.5 }}><Icon n="check" size={14} /> Date modifiée&nbsp;! Votre nouvelle confirmation arrive par e-mail.</div>
        ) : mode==='change' ? (
          <div className="card card--pad" style={{ background:'var(--surface-sunk)' }}>
            <b style={{ fontFamily:'var(--font-display)', fontSize:14 }}>Changer la date du vol</b>
            <input className="watch-in date" type="date" style={{ display:'block', marginTop:8 }} value={newDate} onChange={e=>setNewDate(e.target.value)} />
            {chState==='quote' && chQuote ? (
              <div style={{ marginTop:10 }}>
                <div className="row between"><span className="micro">Différence à payer</span><b style={{ fontFamily:'var(--font-display)' }}>{Math.round(chQuote.changeAmount||0)} {cur(chQuote.currency)}</b></div>
                <p className="micro" style={{ margin:'8px 0', lineHeight:1.5 }}>Nouveau total {Math.round(chQuote.newTotal||0)} {cur(chQuote.currency)}. Selon les conditions du billet.</p>
                <button className="btn btn--primary btn--block" disabled={chState==='confirming'} onClick={doChangeConfirm}>{chState==='confirming'?'Modification…':'Confirmer la nouvelle date'}</button>
                <button className="btn btn--ghost btn--block btn--sm" style={{ marginTop:6 }} onClick={()=>{ setChState('idle'); setChQuote(null); }}>Choisir une autre date</button>
              </div>
            ) : (
              <button className="btn btn--primary btn--block" style={{ marginTop:10 }} disabled={chState==='quoting'||!newDate} onClick={doChangeQuote}>{chState==='quoting'?'Recherche…':'Voir le prix de la modification'}</button>
            )}
            {chErr && <div className="micro" style={{ color:'var(--coral-700,#D43B3B)', marginTop:8 }}>{chErr}</div>}
            <button className="btn btn--ghost btn--block btn--sm" style={{ marginTop:6 }} onClick={()=>setMode('')}>Annuler</button>
          </div>
        ) : (
          <button className="btn btn--secondary btn--block" onClick={()=>setMode('change')}><Icon n="sparkles" size={16} /> Modifier la date du vol</button>
        )
      ) : (
        <button className="btn btn--secondary btn--block" onClick={()=>go('aide')}><Icon n="sparkles" size={16} /> Modifier ma réservation</button>
      )}

      {/* Annuler */}
      {oid ? (
        state==='quote' ? (
          <div className="card card--pad" style={{ marginTop:10, background:'var(--surface-sunk)' }}>
            <div className="row between"><span className="micro">Remboursement estimé</span><b style={{ fontFamily:'var(--font-display)' }}>{Math.round(quote.refundAmount||0)} {cur(quote.currency)}</b></div>
            <p className="micro" style={{ margin:'8px 0', lineHeight:1.5 }}>Selon les conditions du billet. Cette action est définitive.</p>
            <button className="btn btn--block" style={{ background:'var(--coral-50,#FCEBEB)', color:'var(--coral-700,#D43B3B)' }} disabled={state==='confirming'} onClick={doConfirm}>{state==='confirming'?'Annulation…':'Confirmer l\'annulation'}</button>
            <button className="btn btn--ghost btn--block btn--sm" style={{ marginTop:6 }} onClick={()=>setState('idle')}>Garder ma réservation</button>
          </div>
        ) : (
          <button className="btn btn--ghost btn--block" style={{ marginTop:8, color:'var(--coral-700,#D43B3B)' }} disabled={state==='quoting'} onClick={doQuote}>{state==='quoting'?'Calcul du remboursement…':'Annuler ma réservation'}</button>
        )
      ) : (
        <div className="micro" style={{ textAlign:'center', color:'var(--text-muted)', marginTop:8, lineHeight:1.5 }}>Pour annuler, Webbina vous met en relation avec le prestataire (Aide & SAV).</div>
      )}
      {err && <div className="micro" style={{ color:'var(--coral-700,#D43B3B)', marginTop:8 }}>{err}</div>}
    </div>
  );
}

/* ---- Détail d'une réservation ---- */
function TripDetailScreen({ trip, go }){
  const t = trip || {};
  return (
    <div className="screen" style={{ paddingBottom:30 }}>
      <div className="sub-head">
        <button className="icon-btn" onClick={()=>go('dashboard')} aria-label="Retour"><Icon n="arrowLeft" size={22} /></button>
        <div style={{ flex:1 }}><b style={{ fontFamily:'var(--font-display)', fontSize:17 }}>Ma réservation</b></div>
      </div>
      <div className="trip-hero" style={t.img?{ backgroundImage:`url(assets/${t.img})` }:{ background:'var(--grad-premium)' }}>
        <div className="trip-hero-cap">
          <span className="trip-badge"><Icon n="check" size={11} /> Confirmé{t.paid===false?' · test':''}</span>
          <h2 style={{ color:'#fff', fontSize:26, marginTop:6 }}>{t.destination||'Voyage'}</h2>
          {t.country && <div className="micro" style={{ color:'#fff', opacity:.9 }}>{t.country}</div>}
        </div>
      </div>
      <div style={{ padding:'16px 16px' }}>
        <div className="card card--pad">
          <div className="row between"><span className="micro">Référence</span><b style={{ fontFamily:'var(--font-mono,monospace)', fontSize:13 }}>{t.ref||'—'}</b></div>
          <div className="row between" style={{ marginTop:8 }}><span className="micro">Total</span><b style={{ fontFamily:'var(--font-display)' }}>{Math.round(t.total||0).toLocaleString('fr-FR')} €{t.paid===false?' (test)':''}</b></div>
          <div className="row between" style={{ marginTop:8 }}><span className="micro">Voyageurs</span><b>{t.pax||(t.travelers&&t.travelers.length)||'—'}</b></div>
        </div>

        {t.airline && (
          <div className="card card--pad" style={{ marginTop:12 }}>
            <h4 style={{ fontSize:14, marginBottom:8 }}>Vol</h4>
            <div className="row gap3" style={{ alignItems:'center' }}>
              <span className="fb-logo">{t.code||'✈'}</span>
              <div style={{ flex:1 }}><b style={{ fontFamily:'var(--font-display)', fontSize:14.5 }}>{t.airline}</b><div className="micro">{[t.origin&&('Départ '+t.origin),t.time,t.via,t.dur].filter(Boolean).join(' · ')}</div></div>
            </div>
          </div>
        )}

        {t.travelers && t.travelers.filter(p=>p.givenName||p.familyName).length>0 && (
          <div className="card card--pad" style={{ marginTop:12 }}>
            <h4 style={{ fontSize:14, marginBottom:8 }}>Identités voyageurs</h4>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {t.travelers.filter(p=>p.givenName||p.familyName).map((p,i)=>(
                <div key={i} className="row between" style={{ fontSize:13.5 }}><b>{p.givenName} {p.familyName}</b><span className="micro">{p.bornOn||''}</span></div>
              ))}
            </div>
          </div>
        )}

        {typeof FullItinerary!=='undefined' && <FullItinerary departHub={(t.origin||'votre aéroport de départ')} arriveHub={t.destination||''} pax={t.pax} />}

        {t.roadtrip && (
          <button className="btn btn--secondary btn--block" style={{ marginTop:12 }} onClick={()=>{ window.__TF_CARNET_PLAN=t.roadtrip; go('carnet', t); }}>
            <Icon n="download" size={16} /> Mon carnet de voyage
          </button>
        )}

        <button className="card card--pad trip-link" onClick={()=>go('formalites')}>
          <div className="mem-ic"><Icon n="shield" size={18} /></div>
          <b style={{ flex:1, textAlign:'left', fontFamily:'var(--font-display)', fontSize:14.5 }}>Vérifier mes formalités</b>
          <Icon n="chevronRight" size={18} style={{ color:'var(--text-muted)' }} />
        </button>

        <div className="card card--pad" style={{ marginTop:12 }}>
          <h4 style={{ fontSize:14, marginBottom:6 }}>Conditions du billet</h4>
          <p className="micro" style={{ lineHeight:1.5 }}>{t.conditions || 'Modification et annulation selon le tarif et la compagnie — des frais peuvent s\'appliquer.'}</p>
          <ManageBooking trip={t} go={go} />
        </div>

        <div className="micro" style={{ textAlign:'center', color:'var(--text-muted)', marginTop:14, lineHeight:1.5 }}>
          En cas de besoin, retrouvez l'aide et le bon interlocuteur dans <b>Profil → Aide & SAV</b>.
        </div>
      </div>
    </div>
  );
}

/* ---- Premium price-watch card ---- */
function PriceWatchCard({ go }){
  const premium = (window.TF && TF.isPremium && TF.isPremium());
  const [items,setItems]=React.useState(null);
  const [o,setO]=React.useState(''); const [d,setD]=React.useState(''); const [dt,setDt]=React.useState('');
  const [busy,setBusy]=React.useState(false);
  function load(){ if(window.WebbinaBackend && WebbinaBackend.getWatches){ WebbinaBackend.getWatches().then(x=>setItems(x||[])).catch(()=>setItems([])); } else setItems([]); }
  React.useEffect(load,[]);
  async function add(){ if(o.length!==3||d.length!==3) return; setBusy(true); try{ await WebbinaBackend.addWatch(o.toUpperCase(),d.toUpperCase(),dt||undefined); setO('');setD('');setDt(''); load(); }catch(e){} setBusy(false); }
  async function rm(id){ try{ await WebbinaBackend.removeWatch(id); load(); }catch(e){} }
  if(!premium){
    return (
      <div className="card card--pad" style={{ marginTop:14, background:'var(--grad-premium)', color:'#fff', border:'none' }}>
        <div className="row between" style={{ alignItems:'flex-start' }}>
          <div style={{ flex:1 }}>
            <span className="badge badge--premium" style={{ marginBottom:8 }}><Icon n="crown" size={13} />Premium</span>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:16, marginTop:8 }}>Alerte baisse de prix</div>
            <div style={{ fontSize:13, opacity:.9, marginTop:4, lineHeight:1.45 }}>Suivez un trajet&nbsp;: Webbina vous prévient dès que le prix baisse.</div>
          </div>
          <button className="btn btn--secondary btn--sm" onClick={()=>go('premium')} style={{ flex:'none' }}>Activer</button>
        </div>
      </div>
    );
  }
  return (
    <div className="card card--pad" style={{ marginTop:14 }}>
      <div className="row between"><h4 style={{ fontSize:15 }}>Alertes prix</h4><span className="badge badge--premium"><Icon n="crown" size={12} />Premium</span></div>
      <div className="micro" style={{ margin:'4px 0 10px' }}>Suivez un trajet, on vous prévient quand ça baisse.</div>
      <div className="watch-add">
        <input className="watch-in" placeholder="MPL" maxLength="3" value={o} onChange={e=>setO(e.target.value.replace(/[^a-zA-Z]/g,''))} />
        <Icon n="arrowRight" size={16} style={{ color:'var(--text-muted)' }} />
        <input className="watch-in" placeholder="LIS" maxLength="3" value={d} onChange={e=>setD(e.target.value.replace(/[^a-zA-Z]/g,''))} />
        <input className="watch-in date" type="date" value={dt} onChange={e=>setDt(e.target.value)} />
        <button className="btn btn--primary btn--sm" disabled={busy||o.length!==3||d.length!==3} onClick={add}>Suivre</button>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:12 }}>
        {items===null ? <div className="micro">Chargement…</div> :
         items.length===0 ? <div className="micro" style={{ color:'var(--text-muted)' }}>Aucun trajet suivi.</div> :
         items.map(w=>(
          <div key={w.id} className={'watch-row'+(w.dropped?' drop':'')}>
            <div style={{ flex:1 }}>
              <b style={{ fontFamily:'var(--font-display)', fontSize:14 }}>{w.origin} → {w.destination}</b>
              <div className="micro">{w.departDate||'Toutes dates'}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <b style={{ fontFamily:'var(--font-display)' }}>{w.currentPrice} {w.currency==='EUR'?'€':w.currency}</b>
              {w.dropped ? <div className="micro" style={{ color:'var(--success)' }}>▼ −{w.dropAmount} € ({w.dropPct}%)</div>
                         : <div className="micro" style={{ color:'var(--text-muted)' }}>réf. {w.refPrice} €</div>}
            </div>
            <button className="icon-btn" onClick={()=>rm(w.id)} aria-label="Retirer"><Icon n="x" size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Gamification ---- */
function BadgesScreen({ go }) {
  const [loy, setLoy] = React.useState(null);
  React.useEffect(()=>{
    let alive=true;
    (async()=>{ try{ if(window.WebbinaBackend && WebbinaBackend.loyalty){ const d=await WebbinaBackend.loyalty(); if(alive && d) setLoy(d); } }catch(e){} })();
    return ()=>{ alive=false; };
  }, []);
  // Real thresholds when logged in; otherwise the demo flags in TF.BADGES.
  const earnedOf = (b)=>{
    if(!loy) return !!b.earned;
    if(b.id==='explorer') return loy.validatedTrips>=1;
    if(b.id==='adventurer') return loy.validatedTrips>=3;
    if(b.id==='globe') return loy.continents>=3;
    if(b.id==='family') return loy.familyTrips>=5;
    return !!b.earned;
  };
  const badges = TF.BADGES.map(b=>({ ...b, earned: earnedOf(b) }));
  const earned = badges.filter(b=>b.earned).length;
  const balance = loy ? loy.balance : (TF.LOYALTY && TF.LOYALTY.balance) || 0;
  const rate = loy ? +(loy.rate*100).toFixed(1) : (TF.LOYALTY && TF.LOYALTY.rate) || 0.5;
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

        <div className="card card--pad" style={{ marginTop:14, borderColor:'var(--gold-300, var(--border))' }}>
          <div className="row between" style={{ alignItems:'center' }}>
            <div>
              <div className="res-eyebrow" style={{ color:'var(--gold-700)' }}><Icon n="wallet" size={13} />Ma cagnotte voyage</div>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:30, marginTop:4 }}>{balance} €</div>
            </div>
            <div className="badge-medal" style={{ background:'var(--gold-50)', color:'var(--gold-700)', width:54, height:54 }}><Icon n="star" size={26} /></div>
          </div>
          <p className="micro" style={{ marginTop:8, lineHeight:1.5 }}>À chaque voyage <b>validé</b>, <b>{rate} %</b> du montant revient en cagnotte (<b>{(TF.LOYALTY&&TF.LOYALTY.ratePremium)||2} % en Premium</b>), <b>déductible</b> de votre prochaine réservation. Créditée après votre retour, plafonnée, valable {(TF.LOYALTY&&TF.LOYALTY.expiryMonths)||24} mois.</p>
        </div>

        <div className="card card--pad" style={{ marginTop:12 }}>
          <h4 style={{ fontSize:15, marginBottom:4 }}>Comment ça marche&nbsp;?</h4>
          <p className="micro" style={{ lineHeight:1.5 }}>Chaque voyage réservé fait progresser votre famille et débloque un <b>avantage réel</b> : de la cagnotte, un mois Premium offert, une commission réduite à vie, puis le statut VIP. Plus vous voyagez, plus Webbina vous gâte.</p>
        </div>

        <details className="card card--pad rules-card" style={{ marginTop:12 }}>
          <summary><Icon n="shield" size={15} /> Les règles, en toute transparence</summary>
          <ul className="rules-list">
            {(window.TF && TF.LOYALTY_RULES ? TF.LOYALTY_RULES : []).map((r,i)=><li key={i}>{r}</li>)}
          </ul>
        </details>

        <div className="tier-list" style={{ marginTop:16 }}>
          {badges.map(b=>(
            <div key={b.id} className={`tier-row ${b.earned?'earned':''}`}>
              <div className="tier-medal" style={{ background: b.earned?`var(--${b.color}-50)`:'var(--slate-100)', color: b.earned?`var(--${b.color}-700)`:'var(--text-muted)' }}>
                <Icon n={b.ic} size={26} />
                {b.earned && <span className="medal-star"><Icon n="check" size={12} /></span>}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div className="row between" style={{ alignItems:'baseline' }}>
                  <b style={{ fontFamily:'var(--font-display)', fontSize:15.5 }}>{b.name}</b>
                  <span className="micro" style={{ color:'var(--text-muted)' }}>{b.desc}</span>
                </div>
                <div className="tier-reward" style={{ color:`var(--${b.color}-700)`, background:`var(--${b.color}-50)` }}>
                  <Icon n="star" size={12} /> {b.reward}
                </div>
                {b.detail && <p className="tier-detail">{b.detail}</p>}
                {!b.earned && !loy && b.progress!=null && (
                  <div style={{ marginTop:8 }}>
                    <div style={{ height:6, borderRadius:99, background:'var(--slate-100)', overflow:'hidden' }}><div style={{ width:`${b.progress}%`, height:'100%', background:`var(--${b.color})` }}></div></div>
                    <div className="micro" style={{ marginTop:4 }}>{b.progress}% \u2014 plus que quelques voyages&nbsp;!</div>
                  </div>
                )}
              </div>
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
          {[['star','Mes récompenses','badges'],['briefcase','Mémoire voyage','dashboard'],['shield','Passeports de la famille','passeports'],['users','Ma famille & enfants',null],['wallet','Moyens de paiement',null],['shield','Données & confidentialité','legal'],['info','Informations légales (mentions, CGV)','legal'],['phone','Aide & SAV','aide']].map((r,i)=>(
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

/* ---- Premium ---- */
function PremiumScreen({ go }) {
  const [plan, setPlanState] = React.useState(TF.plan());
  const premium = plan==='premium';
  function toggle(){
    const next = premium ? 'free' : 'premium';
    TF.setPlan(next); setPlanState(next);
  }
  const Row = ({ txt, free, prem }) => (
    <div className="row gap3" style={{ padding:'12px 0', borderBottom:'1px solid var(--border)', alignItems:'center' }}>
      <div style={{ flex:1, fontSize:14, fontFamily:'var(--font-display)', fontWeight:600 }}>{txt}</div>
      <div style={{ width:54, textAlign:'center' }}>{free ? <Icon n="check" size={16} style={{ color:'var(--text-muted)' }} /> : <span className="micro" style={{ color:'var(--text-muted)' }}>—</span>}</div>
      <div style={{ width:54, textAlign:'center' }}>{prem ? <Icon n="check" size={16} style={{ color:'var(--gold-700)' }} /> : <span className="micro" style={{ color:'var(--text-muted)' }}>—</span>}</div>
    </div>
  );
  return (
    <div className="screen" style={{ paddingBottom:30 }}>
      <div className="sub-head">
        <button className="icon-btn" onClick={()=>go('home')} aria-label="Retour"><Icon n="arrowLeft" size={22} /></button>
        <div style={{ flex:1 }}><b style={{ fontFamily:'var(--font-display)', fontSize:17 }}>Webbina Premium</b></div>
      </div>
      <div style={{ padding:'16px 18px' }}>
        <div className="card card--pad" style={{ background:'var(--grad-premium)', color:'#fff', border:'none', textAlign:'center' }}>
          <Avatar size={64} ring expr="enthusiastic" style={{ margin:'0 auto 6px' }} />
          <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:22 }}>{premium ? 'Vous êtes Premium ✨' : 'Passez Premium'}</div>
          <div style={{ fontSize:14, opacity:.9, marginTop:4 }}>Plus de liberté, plus d'économies, zéro publicité.</div>
          <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:30, marginTop:12 }}>4,99 €<span style={{ fontSize:15, fontWeight:600, opacity:.8 }}>/mois</span></div>
        </div>

        <div className="card card--pad" style={{ marginTop:16 }}>
          <div className="row gap3" style={{ paddingBottom:8, borderBottom:'2px solid var(--border)' }}>
            <div style={{ flex:1 }}></div>
            <div style={{ width:54, textAlign:'center' }} className="micro">Gratuit</div>
            <div style={{ width:54, textAlign:'center', color:'var(--gold-700)', fontWeight:700 }} className="micro">Premium</div>
          </div>
          <Row txt="Webbina, recherche & réservation in-app" free={true} prem={true} />
          <Row txt="Séjours clé en main (vol + hôtel + activités)" free={true} prem={true} />
          <Row txt="Cagnotte voyage doublée (2 % au lieu de 1 %)" free={false} prem={true} />
          <Row txt="Commission réduite — vous payez moins à chaque voyage" free={false} prem={true} />
          <Row txt="Bons plans exclusifs réservés aux Premium" free={false} prem={true} />
          <Row txt="Alerte baisse de prix sur vos voyages suivis" free={false} prem={true} />
          <Row txt="Sans aucune publicité ni encart partenaire" free={false} prem={true} />
          <Row txt="Webbina prioritaire + SAV prioritaire" free={false} prem={true} />
          <Row txt="Carnet famille & passeports illimités" free={false} prem={true} />
        </div>

        <button className={premium ? 'btn btn--secondary btn--block' : 'btn btn--premium btn--block'} style={{ marginTop:16 }} onClick={toggle}>
          <Icon n="crown" size={18} />{premium ? 'Revenir au plan gratuit' : 'Passer Premium · 4,99 €/mois'}
        </button>
        <p className="micro" style={{ textAlign:'center', marginTop:10, lineHeight:1.5 }}>
          {premium ? 'Merci de soutenir Webbina 💙 Résiliable à tout moment.' : 'Sans engagement, résiliable en un clic. Le gratuit reste complet — le Premium enlève simplement les encarts partenaires et réduit nos commissions.'}
        </p>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardScreen, TripDetailScreen, BadgesScreen, ProfilScreen, PremiumScreen });
