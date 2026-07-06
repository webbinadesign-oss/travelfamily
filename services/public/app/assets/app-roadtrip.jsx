/* TravelFamily.AI — Carnet de route (road-trip planner multi-villes).
   Webbina génère un séjour complet : jour par jour, comparaison d'hôtels par
   ville, vol le moins cher, location de voiture, trajets réels et budget total.
   Un formulaire simple → un vrai "roadbook" que ChatGPT ne peut pas produire
   (prix réels, temps de route réels). */

const RT_TIERS = { 'éco':{ ic:'leaf', c:'var(--success,#15A34A)' }, 'confort':{ ic:'star', c:'var(--ocean-700)' }, 'premium':{ ic:'crown', c:'var(--gold-700,#B8841C)' } };

function fmt(n){ return Math.round(Number(n)||0).toLocaleString('fr-FR'); }
function hm(min){ const h=Math.floor(min/60), m=Math.round(min%60); return h?`${h}h${m?String(m).padStart(2,'0'):''}`:`${m} min`; }

/* ---- Formulaire de génération ---- */
function RoadtripForm({ onPlan, busy }){
  const PRE = (typeof window!=='undefined' && window.__TF_RT_PREFILL) || {};
  const [origin,setOrigin]=React.useState(()=>{ try{ return PRE.origin||localStorage.getItem('tf_home_addr')||''; }catch(e){ return PRE.origin||''; } });
  const [region,setRegion]=React.useState('');
  const [must,setMust]=React.useState('');
  const [start,setStart]=React.useState('');
  const [end,setEnd]=React.useState('');
  const [pax,setPax]=React.useState(PRE.travelers||2);
  const [mode,setMode]=React.useState('fly-drive');
  const [oIata,setOIata]=React.useState(()=>{ try{ return localStorage.getItem('tf_pref_origin_iata')||'MPL'; }catch(e){ return 'MPL'; } });
  const AIRPORTS=[['MPL','Montpellier'],['CDG','Paris CDG'],['ORY','Paris Orly'],['MRS','Marseille'],['LYS','Lyon'],['TLS','Toulouse'],['NCE','Nice'],['BOD','Bordeaux'],['NTE','Nantes'],['BCN','Barcelone'],['GVA','Genève'],['BRU','Bruxelles']];
  function submit(){
    if(region.trim().length<2||origin.trim().length<2) return;
    onPlan({
      origin:origin.trim(), region:region.trim(),
      mustSee: must.split(',').map(s=>s.trim()).filter(Boolean),
      startDate:start||undefined, endDate:end||undefined,
      travelers:pax, mode,
      ...(mode==='fly-drive'?{ originIata:oIata }:{}),
    });
  }
  return (
    <div className="card card--pad">
      <div className="seg2" style={{ marginBottom:14 }}>
        <button className={mode==='fly-drive'?'on':''} onClick={()=>setMode('fly-drive')}><Icon n="plane" size={15} /> Avion + voiture</button>
        <button className={mode==='road'?'on':''} onClick={()=>setMode('road')}><Icon n="car" size={15} /> Road trip voiture</button>
      </div>
      <label className="rt-lbl">Départ</label>
      <input className="rt-in" placeholder="Votre ville (ex. Montarnaud)" value={origin} onChange={e=>setOrigin(e.target.value)} />
      {mode==='fly-drive' && (
        <>
          <label className="rt-lbl">Aéroport de départ</label>
          <select className="rt-in" value={oIata} onChange={e=>{ setOIata(e.target.value); try{ localStorage.setItem('tf_pref_origin_iata', e.target.value); }catch(_){} }}>
            {AIRPORTS.map(a=><option key={a[0]} value={a[0]}>{a[1]} ({a[0]})</option>)}
          </select>
        </>
      )}
      <label className="rt-lbl">Destination / région</label>
      <input className="rt-in" placeholder="ex. Portugal, Sicile, Andalousie…" value={region} onChange={e=>setRegion(e.target.value)} />
      <label className="rt-lbl">Villes indispensables <span className="rt-opt">(séparées par des virgules)</span></label>
      <input className="rt-in" placeholder="ex. Porto, Lisbonne, Faro" value={must} onChange={e=>setMust(e.target.value)} />
      <div className="row gap2">
        <div style={{ flex:1 }}><label className="rt-lbl">Aller</label><input className="rt-in" type="date" value={start} onChange={e=>setStart(e.target.value)} /></div>
        <div style={{ flex:1 }}><label className="rt-lbl">Retour</label><input className="rt-in" type="date" value={end} onChange={e=>setEnd(e.target.value)} /></div>
      </div>
      <label className="rt-lbl">Voyageurs</label>
      <div className="rt-step"><button onClick={()=>setPax(p=>Math.max(1,p-1))}>−</button><b>{pax}</b><button onClick={()=>setPax(p=>Math.min(12,p+1))}>+</button></div>
      <button className="btn btn--primary btn--block" style={{ marginTop:16 }} disabled={busy||region.trim().length<2||origin.trim().length<2} onClick={submit}>
        {busy? <><span className="rt-spin"></span> Webbina prépare votre carnet…</> : <><Icon n="sparkles" size={17} /> Générer mon carnet de route</>}
      </button>
      <div className="micro" style={{ textAlign:'center', color:'var(--text-muted)', marginTop:8 }}>Vol & trajets en temps réel · hôtels comparés · budget complet</div>
    </div>
  );
}

/* ---- Affichage du carnet ---- */
function RoadbookView({ plan, onReset, book }){
  const b=plan.budget, cur=b.currency==='EUR'?'€':b.currency;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div className="card card--pad rt-hero">
        <div className="row between" style={{ alignItems:'flex-start' }}>
          <div>
            <div className="micro" style={{ opacity:.85 }}>{plan.mode==='fly-drive'?'Avion + voiture':'Road trip'} · {plan.travelers} voyageur{plan.travelers>1?'s':''}</div>
            <h2 style={{ fontSize:24, marginTop:2, color:'#fff' }}>{plan.title}</h2>
            <div className="micro" style={{ color:'#fff', opacity:.9, marginTop:2 }}>{plan.origin} → {plan.region}{plan.startDate?` · ${plan.startDate} au ${plan.endDate||''}`:''}</div>
          </div>
        </div>
        <div className="rt-total"><span>Budget total estimé</span><b>{fmt(b.total)} {cur}</b></div>
        <div className="micro" style={{ color:'#fff', opacity:.85 }}>≈ {fmt(b.perPerson)} {cur} / personne</div>
      </div>

      {/* Vol + voiture */}
      {(plan.flight||plan.car) && (
        <div className="card card--pad">
          <h4 style={{ fontSize:14, marginBottom:8 }}>Transport principal</h4>
          {plan.flight && (
            <div className="rt-line"><div className="rt-line-ic"><Icon n="plane" size={16} /></div>
              <div style={{ flex:1 }}><b>Vol {plan.flight.origin} → {plan.flight.arrival}</b><div className="micro">{plan.flight.real?'Meilleur tarif trouvé (A/R, tous voyageurs)':'Aéroport conseillé'}</div></div>
              <b>{plan.flight.real?fmt(plan.flight.price)+' '+cur:'—'}</b>
            </div>
          )}
          {plan.car && (
            <div className="rt-line"><div className="rt-line-ic"><Icon n="car" size={16} /></div>
              <div style={{ flex:1 }}><b>Location voiture ({plan.car.category})</b><div className="micro">{plan.car.days} jours × {plan.car.perDay} {cur}/j · estimation</div></div>
              <b>{fmt(plan.car.total)} {cur}</b>
            </div>
          )}
          {plan.car && <a className="btn btn--secondary btn--block btn--sm" href={plan.car.bookUrl} target="_blank" rel="noopener" style={{ marginTop:8, textDecoration:'none' }}><Icon n="arrowRight" size={15} /> Voir les voitures dispo</a>}
        </div>
      )}

      {/* Étapes jour par jour */}
      {plan.stops.map((s,i)=>(
        <div key={i} className="card card--pad">
          {s.driveFromPrev && (
            <div className="rt-drive"><Icon n="car" size={13} /> {s.driveFromPrev.from} → {s.driveFromPrev.to} · <b>{hm(s.driveFromPrev.durationMin)}</b> · {fmt(s.driveFromPrev.distanceKm)} km {s.driveFromPrev.real&&<span className="rt-real">réel</span>}</div>
          )}
          <div className="row between" style={{ alignItems:'center' }}>
            <div className="row gap2" style={{ alignItems:'center' }}><span className="rt-badge">{i+1}</span><b style={{ fontFamily:'var(--font-display)', fontSize:17 }}>{s.city}</b></div>
            <span className="micro">{s.nights} nuit{s.nights>1?'s':''}</span>
          </div>
          {s.summary && <p className="micro" style={{ marginTop:4, lineHeight:1.5 }}>{s.summary}</p>}

          {/* Jour par jour */}
          {s.days.map((d,j)=>(
            <div key={j} className="rt-day">
              <b style={{ fontSize:13.5 }}>{d.title}</b>
              <ul className="rt-day-list">{d.items.map((it,k)=><li key={k}>{it}</li>)}</ul>
            </div>
          ))}

          {/* Comparaison hôtels */}
          {s.hotels && s.hotels.length>0 && (
            <div style={{ marginTop:10 }}>
              <div className="micro sec-cap" style={{ margin:'2px 0 6px' }}>Hôtels à {s.city} — comparez</div>
              <div className="rt-hotels">
                {s.hotels.map((h,k)=>{ const t=RT_TIERS[h.tier]||RT_TIERS.confort; return (
                  <div key={k} className="rt-hotel">
                    <div className="rt-hotel-top" style={{ color:t.c }}><Icon n={t.ic} size={14} /> <span>{h.tier}</span></div>
                    <div className="rt-hotel-price"><b>{fmt(h.pricePerNight)} {cur}</b><span>/nuit</span></div>
                    <div className="micro" style={{ lineHeight:1.35 }}>{h.name}</div>
                  </div>
                ); })}
              </div>
              <div className="micro" style={{ color:'var(--text-muted)', marginTop:6 }}>Estimations haute saison — réservation en direct dès l'activation partenaires.</div>
            </div>
          )}
        </div>
      ))}

      {/* Budget détaillé */}
      <div className="card card--pad">
        <h4 style={{ fontSize:14, marginBottom:8 }}>Budget détaillé</h4>
        {[['Vols',b.flights],['Location voiture',b.car],['Hôtels',b.hotels],['Carburant',b.fuel],['Péages',b.tolls],['Visites & activités',b.activities]].filter(r=>r[1]>0).map((r,i)=>(
          <div key={i} className="rt-brow"><span>{r[0]}</span><b>{fmt(r[1])} {cur}</b></div>
        ))}
        <div className="rt-brow rt-btotal"><span>Total</span><b>{fmt(b.total)} {cur}</b></div>
        <div className="micro" style={{ color:'var(--text-muted)', marginTop:6, lineHeight:1.5 }}>{fmt(plan.drivingTotalKm)} km de route au total. Carburant ≈ 7 L/100 · péages estimés. Les prix réels (vol) peuvent évoluer jusqu'à la réservation.</div>
      </div>

      {/* Conseils Webbina */}
      {plan.notes && plan.notes.length>0 && (
        <div className="card card--pad" style={{ background:'var(--ocean-50)' }}>
          <div className="row gap2" style={{ alignItems:'center', marginBottom:6 }}><Avatar size={26} expr="happy" /><b style={{ fontFamily:'var(--font-display)', fontSize:14 }}>Les conseils de Webbina</b></div>
          <ul className="rt-day-list">{plan.notes.map((n,i)=><li key={i}>{n}</li>)}</ul>
        </div>
      )}

      <button className="btn btn--cta btn--block" onClick={()=>{ if(book){ book({ dest:{ name:plan.title, country:plan.region }, flight:{ airline:plan.title, code:'★', price:plan.budget.total }, roadtrip:plan }); } }}>
        <Icon n="check" size={18} /> Choisir cet itinéraire
      </button>
      <button className="btn btn--secondary btn--block" style={{ marginTop:8 }} onClick={()=>{ window.__TF_CARNET_PLAN=plan; go('carnet'); }}>
        <Icon n="download" size={16} /> Aperçu du carnet de voyage
      </button>
      <button className="btn btn--ghost btn--block" onClick={onReset}><Icon n="arrowLeft" size={16} /> Comparer à nouveau</button>
    </div>
  );
}

function RoadtripScreen({ go, book }){
  const [options,setOptions]=React.useState(null);   // array of complete plans
  const [chosen,setChosen]=React.useState(null);     // selected plan (roadbook)
  const [busy,setBusy]=React.useState(false);
  const [err,setErr]=React.useState('');
  async function onPlan(input){
    setBusy(true); setErr(''); setOptions(null); setChosen(null);
    try{
      const r = window.WebbinaBackend && WebbinaBackend.planRoadtripOptions ? await WebbinaBackend.planRoadtripOptions(input) : null;
      if(r && r.length) setOptions(r);
      else setErr('Webbina n\'a pas pu générer d\'itinéraires (backend en veille ?). Réessayez dans un instant.');
    }catch(e){ setErr('Une erreur est survenue. Réessayez.'); }
    setBusy(false);
  }
  return (
    <div className="screen" style={{ paddingBottom:30 }}>
      <div className="sub-head">
        <button className="icon-btn" onClick={()=> chosen ? setChosen(null) : (options ? setOptions(null) : go('home'))} aria-label="Retour"><Icon n="arrowLeft" size={22} /></button>
        <div style={{ flex:1 }}><b style={{ fontFamily:'var(--font-display)', fontSize:17 }}>{chosen?'Mon itinéraire':(options?'Comparez les options':'Carnet de route')}</b></div>
      </div>
      <div style={{ padding:'14px 16px' }}>
        {!options && !chosen && (
          <div className="card card--pad" style={{ marginBottom:14, background:'var(--ocean-50)', border:'none' }}>
            <div className="row gap2" style={{ alignItems:'center' }}><Avatar size={40} ring expr="enthusiastic" /><div><b style={{ fontFamily:'var(--font-display)', fontSize:15 }}>Je vous prépare plusieurs voyages</b><div className="micro" style={{ marginTop:2 }}>Comparez prix et itinéraires, choisissez, puis réservez.</div></div></div>
          </div>
        )}
        {err && <div className="card card--pad" style={{ marginBottom:12, color:'var(--coral-700,#D43B3B)' }}>{err}</div>}
        {chosen ? <RoadbookView plan={chosen} onReset={()=>setChosen(null)} book={book} />
          : options ? <OptionsCompare options={options} onPick={setChosen} onReset={()=>setOptions(null)} />
          : <RoadtripForm onPlan={onPlan} busy={busy} />}
      </div>
    </div>
  );
}

/* ---- Comparaison des itinéraires (AVANT réservation) ---- */
function OptionsCompare({ options, onPick, onReset }){
  const cheapest = Math.min(...options.map(o=>o.budget.total));
  const STRAT = { eco:{ ic:'leaf', c:'var(--success,#15A34A)' }, balanced:{ ic:'star', c:'var(--ocean-700)' }, comfort:{ ic:'crown', c:'var(--gold-700,#B8841C)' } };
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div className="micro" style={{ color:'var(--text-2)', lineHeight:1.5 }}>Webbina a préparé <b>{options.length} itinéraires complets</b>. Comparez, ouvrez le détail, puis choisissez le vôtre.</div>
      {options.map((o,i)=>{ const st=STRAT[o.strategy]||STRAT.balanced; const cur=o.budget.currency==='EUR'?'€':o.budget.currency; const best=o.budget.total===cheapest;
        return (
        <div key={i} className="card card--pad opt-card" style={{ borderColor: best?st.c:'var(--border)' }}>
          {best && <span className="opt-flag">Le moins cher</span>}
          <div className="row between" style={{ alignItems:'flex-start' }}>
            <div className="row gap2" style={{ alignItems:'center' }}>
              <div className="opt-ic" style={{ color:st.c }}><Icon n={st.ic} size={18} /></div>
              <div><b style={{ fontFamily:'var(--font-display)', fontSize:15.5 }}>{o.label}</b><div className="micro">{o.stops.length} étapes · {o.stops.reduce((s,x)=>s+x.nights,0)} nuits</div></div>
            </div>
            <div style={{ textAlign:'right' }}><b style={{ fontFamily:'var(--font-display)', fontSize:20 }}>{fmt(o.budget.total)} {cur}</b><div className="micro">≈ {fmt(o.budget.perPerson)} {cur}/pers</div></div>
          </div>
          {o.angle && <p className="micro" style={{ margin:'8px 0 0', lineHeight:1.5 }}>{o.angle}</p>}
          <div className="opt-route">{o.stops.map((s,k)=>(<React.Fragment key={k}>{k>0 && <Icon n="chevronRight" size={12} style={{ color:'var(--text-muted)' }} />}<span>{s.city}</span></React.Fragment>))}</div>
          <div className="opt-mini">
            {o.flight && <span><Icon n="plane" size={12} /> {o.flight.real?fmt(o.flight.price)+' '+cur:'vol'}</span>}
            {o.car && <span><Icon n="car" size={12} /> {o.car.category}</span>}
            <span><Icon n="star" size={12} /> hôtels {o.hotelTier}</span>
            {o.drivingTotalKm>0 && <span><Icon n="route" size={12} /> {fmt(o.drivingTotalKm)} km</span>}
          </div>
          <button className="btn btn--primary btn--block btn--sm" style={{ marginTop:12 }} onClick={()=>onPick(o)}>Voir le détail & choisir <Icon n="arrowRight" size={15} /></button>
        </div>
      ); })}
      <button className="btn btn--ghost btn--block" onClick={onReset}><Icon n="arrowLeft" size={16} /> Modifier ma demande</button>
    </div>
  );
}

Object.assign(window, { RoadtripScreen });

/* ---- Récap itinéraire + carte Google (AVANT paiement, modifiable) ---- */
function RoadtripRecap({ plan, onEdit }){
  if(!plan || !plan.stops) return null;
  const api=(window.WEBBINA_API||'').replace(/\/+$/,'');
  const map = api ? api+'/api/map/route.png?points='+encodeURIComponent(plan.stops.map(s=>s.city).join('|'))+(plan.region?('&region='+encodeURIComponent(plan.region)):'') : null;
  const cur = plan.budget && plan.budget.currency==='EUR'?'€':(plan.budget&&plan.budget.currency)||'€';
  return (
    <div className="card card--pad">
      <div className="row between" style={{ alignItems:'center', marginBottom:8 }}>
        <h4 style={{ fontSize:14 }}>Votre itinéraire</h4>
        {onEdit && <button className="btn btn--ghost btn--sm" onClick={onEdit}><Icon n="edit" size={14} /> Modifier</button>}
      </div>
      {map && <img src={map} alt="Carte de l'itinéraire" crossOrigin="anonymous" style={{ width:'100%', borderRadius:'var(--r-md)', border:'1px solid var(--border)', display:'block', marginBottom:10 }} onError={e=>{e.target.style.display='none';}} />}
      <div className="opt-route" style={{ marginTop:0 }}>{plan.stops.map((s,k)=>(<React.Fragment key={k}>{k>0 && <Icon n="chevronRight" size={12} style={{ color:'var(--text-muted)' }} />}<span>{s.city} <span className="micro">({s.nights}n)</span></span></React.Fragment>))}</div>
      <div className="opt-mini" style={{ marginTop:9 }}>
        {plan.flight && <span><Icon n="plane" size={12} /> {plan.flight.real?fmt(plan.flight.price)+' '+cur:'vol'}</span>}
        {plan.car && <span><Icon n="car" size={12} /> {plan.car.category}</span>}
        <span><Icon n="star" size={12} /> hôtels {plan.hotelTier||'confort'}</span>
        {plan.drivingTotalKm>0 && <span><Icon n="route" size={12} /> {fmt(plan.drivingTotalKm)} km</span>}
      </div>
    </div>
  );
}

Object.assign(window, { RoadtripRecap });
