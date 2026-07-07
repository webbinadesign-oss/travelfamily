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
  const SAVED = (()=>{ try{ return JSON.parse(localStorage.getItem('tf_rt_form')||'null')||{}; }catch(e){ return {}; } })();
  const [origin,setOrigin]=React.useState(PRE.origin||SAVED.origin||'');
  const [region,setRegion]=React.useState(PRE.region||SAVED.region||'');
  const [must,setMust]=React.useState(PRE.must||SAVED.must||'');
  const [start,setStart]=React.useState(SAVED.start||'');
  const [end,setEnd]=React.useState(SAVED.end||'');
  const [pax,setPax]=React.useState(SAVED.pax||PRE.travelers||2);
  const [mode,setMode]=React.useState(SAVED.mode||'fly-drive');
  const [oIata,setOIata]=React.useState(SAVED.oIata||'AUTO');
  const [hasCar,setHasCar]=React.useState(SAVED.hasCar!=null?SAVED.hasCar:true);
  const AIRPORTS=[['AUTO','✨ Auto — le moins cher (Webbina compare)'],['MPL','Montpellier'],['CDG','Paris CDG'],['ORY','Paris Orly'],['MRS','Marseille'],['LYS','Lyon'],['TLS','Toulouse'],['NCE','Nice'],['BOD','Bordeaux'],['NTE','Nantes'],['BCN','Barcelone'],['GVA','Genève'],['BRU','Bruxelles']];
  function submit(){
    if(region.trim().length<2||origin.trim().length<2) return;
    try{ localStorage.setItem('tf_rt_form', JSON.stringify({ origin, region, must, start, end, pax, mode, oIata, hasCar })); }catch(e){}
    onPlan({
      origin:origin.trim(), region:region.trim(),
      mustSee: must.split(',').map(s=>s.trim()).filter(Boolean),
      startDate:start||undefined, endDate:end||undefined,
      travelers:pax, mode,
      ...(mode==='fly-drive'?{ originIata:oIata, hasCar }:{}),
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
          <select className="rt-in" value={oIata} onChange={e=>setOIata(e.target.value)}>
            {AIRPORTS.map(a=><option key={a[0]} value={a[0]}>{a[0]==='AUTO'?a[1]:a[1]+' ('+a[0]+')'}</option>)}
          </select>
          <div className="micro" style={{ color:'var(--text-muted)', marginTop:4 }}>Pas sûr d'où partir ? Laissez « Auto » : Webbina compare les aéroports et trouve le moins cher.</div>
          <label className="rt-lbl">Pour rejoindre l'aéroport</label>
          <div className="seg2">
            <button className={hasCar?'on':''} onClick={()=>setHasCar(true)}><Icon n="car" size={14} /> J'ai une voiture</button>
            <button className={!hasCar?'on':''} onClick={()=>setHasCar(false)}><Icon n="bus" size={14} /> Sans voiture</button>
          </div>
          <div className="micro" style={{ color:'var(--text-muted)', marginTop:4 }}>{hasCar?'Webbina calcule le trajet + le parking aéroport.':'Webbina compare transports, bus et BlaBlaCar.'}</div>
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
  const cur=plan.budget.currency==='EUR'?'€':plan.budget.currency;
  const rooms=Math.max(1,Math.ceil((plan.travelers||1)/2));
  // Per-city chosen hotel tier (default = the plan's tier). Fully switchable.
  const [tiers,setTiers]=React.useState(()=>plan.stops.map(()=>plan.hotelTier||'confort'));
  const hotelOf=(s,ti)=> (s.hotels && (s.hotels.find(h=>h.tier===ti)||s.hotels[0])) || null;
  const hotelsTotal=plan.stops.reduce((sum,s,i)=>{ const h=hotelOf(s,tiers[i]); return sum+(h?h.pricePerNight*s.nights*rooms:0); },0);
  const b0=plan.budget;
  const b={ ...b0, hotels:Math.round(hotelsTotal), total:Math.round((b0.total-b0.hotels)+hotelsTotal), perPerson:Math.round(((b0.total-b0.hotels)+hotelsTotal)/(plan.travelers||1)) };
  function setTier(i,ti){ setTiers(prev=>{ const n=[...prev]; n[i]=ti; return n; }); }
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
              <div style={{ flex:1 }}><b>Vol {plan.flight.origin} → {plan.flight.arrival}{plan.flight.returnAirport?' · retour depuis '+plan.flight.returnAirport:''}{plan.flight.lowcost?' · low-cost':''}</b><div className="micro">{plan.flight.real?'Meilleur tarif trouvé (A/R, tous voyageurs)':'Aéroport conseillé'}</div>{plan.flight.compared&&plan.flight.compared.length>1&&<div className="micro" style={{ marginTop:3 }}>Comparé : {plan.flight.compared.map(c=>c.iata+' '+(c.price!=null?fmt(c.price)+cur:'—')).join(' · ')}</div>}{plan.flight.note&&<div className="micro" style={{ marginTop:3, color:'var(--text-muted)', lineHeight:1.45 }}>{plan.flight.note}</div>}</div>
              <b>{plan.flight.real?fmt(plan.flight.price)+' '+cur:'—'}</b>
            </div>
          )}
          {plan.flight && plan.flight.real && (
            <button className="btn btn--ghost btn--block btn--sm" style={{ marginTop:4 }} onClick={()=>{ window.__TF_PG={ origin:plan.flight.origin, destination:plan.flight.arrival, pax:plan.travelers }; go('pricegrid'); }}>
              <Icon n="grid" size={14} /> Voir la grille des prix par dates
            </button>
          )}
          {plan.access && (
            <div className="rt-line"><div className="rt-line-ic"><Icon n={plan.access.mode==='DRIVE'?'car':'bus'} size={16} /></div>
              <div style={{ flex:1 }}><b>Accès aéroport — {plan.access.label}</b><div className="micro">{Math.round(plan.access.durationMin)} min{plan.access.note?' · '+plan.access.note:''}</div></div>
              <b>{plan.access.cost?fmt(plan.access.cost)+' '+cur:'—'}</b>
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

          {/* Choix de l'hôtel (switchable éco / confort / premium) */}
          {s.hotels && s.hotels.length>0 && (
            <div style={{ marginTop:10 }}>
              <div className="micro sec-cap" style={{ margin:'2px 0 6px' }}>Hôtels à {s.city} — <b>touchez pour choisir</b></div>
              <div className="rt-hotels">
                {s.hotels.map((h,k)=>{ const t=RT_TIERS[h.tier]||RT_TIERS.confort; const sel=tiers[i]===h.tier; return (
                  <button key={k} className={'rt-hotel'+(sel?' rt-hotel--sel':'')} onClick={()=>setTier(i,h.tier)} style={sel?{ borderColor:t.c }:{}}>
                    <div className="rt-hotel-top" style={{ color:t.c }}><Icon n={sel?'check':t.ic} size={14} /> <span>{h.tier}</span></div>
                    <div className="rt-hotel-price"><b>{fmt(h.pricePerNight)} {cur}</b><span>/nuit</span></div>
                    <div className="micro" style={{ lineHeight:1.35 }}>{h.name}</div>
                  </button>
                ); })}
              </div>
              <div className="micro" style={{ color:'var(--text-muted)', marginTop:6 }}>{s.nights} nuit{s.nights>1?'s':''} × {rooms} chambre{rooms>1?'s':''} — estimations, réservables dès activation partenaires.</div>
            </div>
          )}
        </div>
      ))}

      {/* Budget détaillé */}
      <div className="card card--pad">
        <h4 style={{ fontSize:14, marginBottom:8 }}>Budget détaillé</h4>
        {[['Vols',b.flights],['Accès aéroport',b.access],['Location voiture',b.car],['Hôtels',b.hotels],['Carburant',b.fuel],['Péages',b.tolls],['Visites & activités',b.activities]].filter(r=>r[1]>0).map((r,i)=>(
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

/* ---- Indicateur de progression (pendant la génération) ---- */
function RoadtripProgress(){
  const STEPS=['Webbina imagine 3 itinéraires','Recherche des vols les moins chers','Comparaison des aéroports proches','Calcul des trajets et du budget'];
  const [step,setStep]=React.useState(0);
  React.useEffect(()=>{ const id=setInterval(()=>setStep(s=>Math.min(s+1,STEPS.length-1)), 6000); return ()=>clearInterval(id); }, []);
  return (
    <div className="card card--pad" style={{ textAlign:'center' }}>
      <LivingWebbina size={64} state="idle" expr="focused" style={{ margin:'0 auto 8px' }} />
      <b style={{ fontFamily:'var(--font-display)', fontSize:16 }}>Webbina prépare votre voyage…</b>
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:14, textAlign:'left' }}>
        {STEPS.map((t,i)=>(
          <div key={i} className="rtp-step">
            <span className={'rtp-dot'+(i<step?' done':i===step?' active':'')}>{i<step?<Icon n="check" size={12} />:i+1}</span>
            <span style={{ fontSize:13.5, color:i<=step?'var(--text)':'var(--text-muted)' }}>{t}</span>
          </div>
        ))}
      </div>
      <div className="rtp-bar"><div className="rtp-fill" style={{ width:((step+1)/STEPS.length*100)+'%' }}></div></div>
      <div className="micro" style={{ color:'var(--text-muted)', marginTop:8 }}>Quelques secondes — je déniche les meilleures options 💙</div>
    </div>
  );
}

function RoadtripScreen({ go, book }){
  const [options,setOptions]=React.useState(null);   // array of complete plans
  const [chosen,setChosen]=React.useState(null);     // selected plan (roadbook)
  const [builder,setBuilder]=React.useState(null);   // {stops,input} — edit stops before pricing
  const [busy,setBusy]=React.useState(false);
  const [err,setErr]=React.useState('');
  const lastInput=React.useRef(null);
  React.useEffect(()=>{ try{ if(window.WebbinaBackend && WebbinaBackend.warm) WebbinaBackend.warm(); }catch(e){} }, []);
  // Step 1 → suggest editable stops (no pricing yet).
  async function onPlan(input){
    lastInput.current = input;
    setBusy(true); setErr(''); setOptions(null); setChosen(null); setBuilder(null);
    try{
      const r = window.WebbinaBackend && WebbinaBackend.suggestRoadtrip ? await WebbinaBackend.suggestRoadtrip(input) : null;
      if(Array.isArray(r) && r.length) setBuilder({ stops:r, input });
      else if(r && r.error==='timeout') setErr('C\'est un peu long — le serveur se réveillait. Relancez : ce sera rapide. 💙');
      else setErr('Webbina n\'a pas pu proposer d\'itinéraire. Vérifiez la destination et réessayez.');
    }catch(e){ setErr('Une erreur est survenue. Réessayez.'); }
    setBusy(false);
  }
  // Step 2 → generate priced options from the validated stops.
  async function onValidate(stops){
    const input={ ...lastInput.current, mustSee: stops.map(s=>s.city) };
    lastInput.current=input;
    setBusy(true); setErr(''); setBuilder(null);
    try{
      const r = window.WebbinaBackend && WebbinaBackend.planRoadtripOptions ? await WebbinaBackend.planRoadtripOptions(input) : null;
      if(Array.isArray(r) && r.length) setOptions(r);
      else if(r && r.error==='timeout') setErr('C\'est un peu long — relancez, ce sera rapide. 💙');
      else if(r && r.error) setErr('Connexion au serveur difficile. Réessayez.');
      else setErr('Webbina n\'a pas pu générer d\'itinéraires. Réessayez.');
    }catch(e){ setErr('Une erreur est survenue. Réessayez.'); }
    setBusy(false);
  }
  function back(){ if(chosen) setChosen(null); else if(options){ setOptions(null); setBuilder({ stops:(lastInput.current.mustSee||[]).map(c=>({city:c,summary:'',see:[],nights:2})), input:lastInput.current }); } else if(builder) setBuilder(null); else go('home'); }
  return (
    <div className="screen" style={{ paddingBottom:30 }}>
      <div className="sub-head">
        <button className="icon-btn" onClick={back} aria-label="Retour"><Icon n="arrowLeft" size={22} /></button>
        <div style={{ flex:1 }}><b style={{ fontFamily:'var(--font-display)', fontSize:17 }}>{chosen?'Composer mon voyage':(options?'Comparez les options':(builder?'Votre itinéraire':'Carnet de route'))}</b></div>
      </div>
      <div style={{ padding:'14px 16px' }}>
        {!options && !chosen && !builder && (
          <div className="card card--pad" style={{ marginBottom:14, background:'var(--ocean-50)', border:'none' }}>
            <div className="row gap2" style={{ alignItems:'center' }}><Avatar size={40} ring expr="enthusiastic" /><div><b style={{ fontFamily:'var(--font-display)', fontSize:15 }}>On construit votre voyage ensemble</b><div className="micro" style={{ marginTop:2 }}>D'abord l'itinéraire (à ajuster), puis les prix, puis vous choisissez.</div></div></div>
          </div>
        )}
        {err && <div className="card card--pad" style={{ marginBottom:12, color:'var(--coral-700,#D43B3B)' }}>{err}</div>}
        {busy && <RoadtripProgress />}
        {!busy && (chosen ? <RoadbookTunnel plan={chosen} go={go} book={book} onReset={()=>setChosen(null)} />
          : options ? <OptionsCompare options={options} onPick={setChosen} onReset={()=>{ setOptions(null); }} busy={busy} onChangeAirport={(iata)=>{ const inp=lastInput.current; if(inp){ setBusy(true); WebbinaBackend.planRoadtripOptions({ ...inp, originIata:iata }).then(r=>{ if(Array.isArray(r)&&r.length) setOptions(r); setBusy(false); }); } }} />
          : builder ? <ItineraryBuilder data={builder} region={lastInput.current.region} onValidate={onValidate} />
          : <RoadtripForm onPlan={onPlan} busy={busy} />)}
      </div>
    </div>
  );
}

/* ---- Constructeur d'itinéraire (ajout/suppression de villes avant les prix) ---- */
function ItineraryBuilder({ data, region, onValidate }){
  const [stops,setStops]=React.useState(data.stops);
  const [add,setAdd]=React.useState('');
  const api=(window.WEBBINA_API||'').replace(/\/+$/,'');
  const mapUrl = api && stops.length ? api+'/api/map/route.png?points='+encodeURIComponent(stops.map(s=>s.city).join('|'))+(region?('&region='+encodeURIComponent(region)):'') : null;
  function remove(i){ setStops(p=>p.filter((_,k)=>k!==i)); }
  function addCity(){ const c=add.trim(); if(c.length<2) return; setStops(p=>[...p,{ city:c, summary:'', see:[], nights:2 }]); setAdd(''); }
  function move(i,dir){ setStops(p=>{ const n=[...p]; const j=i+dir; if(j<0||j>=n.length) return n; [n[i],n[j]]=[n[j],n[i]]; return n; }); }
  function setNights(i,d){ setStops(p=>{ const n=[...p]; n[i]={ ...n[i], nights:Math.max(1,(n[i].nights||1)+d) }; return n; }); }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div className="card card--pad" style={{ background:'var(--ocean-50)', border:'none' }}>
        <div className="row gap2" style={{ alignItems:'center' }}><Avatar size={34} expr="happy" /><p className="micro" style={{ flex:1, lineHeight:1.45 }}>Voici l'itinéraire que je vous propose. <b>Ajoutez ou retirez des villes</b>, ajustez les nuits, puis validez — je chercherai ensuite les meilleurs prix.</p></div>
      </div>
      {mapUrl && <img src={mapUrl} alt="Carte" crossOrigin="anonymous" style={{ width:'100%', borderRadius:'var(--r-md)', border:'1px solid var(--border)', display:'block' }} onError={e=>{e.target.style.display='none';}} />}
      {stops.map((s,i)=>(
        <div key={i} className="card card--pad tnl-stop" style={{ padding:'12px 14px' }}>
          <div className="row between" style={{ alignItems:'center' }}>
            <div className="row gap2" style={{ alignItems:'center' }}><span className="rt-badge">{i+1}</span><b style={{ fontFamily:'var(--font-display)', fontSize:16 }}>{s.city}</b></div>
            <div className="row gap2" style={{ alignItems:'center' }}>
              <div className="rt-step" style={{ gap:8 }}><button onClick={()=>setNights(i,-1)}>−</button><b style={{ fontSize:13 }}>{s.nights}n</b><button onClick={()=>setNights(i,1)}>+</button></div>
              <button className="icon-btn" onClick={()=>move(i,-1)} disabled={i===0} aria-label="Monter"><Icon n="arrowUp" size={16} /></button>
              <button className="icon-btn" onClick={()=>move(i,1)} disabled={i===stops.length-1} aria-label="Descendre"><Icon n="arrowDown" size={16} /></button>
              <button className="icon-btn" onClick={()=>remove(i)} aria-label="Retirer" style={{ color:'var(--coral-700,#D43B3B)' }}><Icon n="x" size={16} /></button>
            </div>
          </div>
          {s.summary && <p className="micro" style={{ marginTop:6, lineHeight:1.5 }}>{s.summary}</p>}
          {s.see && s.see.length>0 && <div className="tnl-see">{s.see.map((it,k)=><span key={k} className="tnl-chip">{it}</span>)}</div>}
        </div>
      ))}
      <div className="card card--pad" style={{ padding:'12px 14px' }}>
        <div className="row gap2">
          <input className="rt-in" style={{ flex:1 }} placeholder="Ajouter une ville…" value={add} onChange={e=>setAdd(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCity()} />
          <button className="btn btn--secondary btn--sm" onClick={addCity}><Icon n="plus" size={16} /> Ajouter</button>
        </div>
      </div>
      <button className="btn btn--cta btn--block" disabled={stops.length<1} onClick={()=>onValidate(stops)}>
        <Icon n="check" size={18} /> Valider — chercher les meilleurs prix
      </button>
    </div>
  );
}

/* ---- Comparaison des itinéraires (AVANT réservation) ---- */
function OptionsCompare({ options, onPick, onReset, onChangeAirport, busy }){
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
          {o.flight && <div className="opt-flight"><Icon n="plane" size={13} /> <b>{o.flight.origin} → {o.flight.arrival}{o.flight.returnAirport?' · retour '+o.flight.returnAirport:''}</b>{o.flight.real?<span> · {fmt(o.flight.price)} {cur} <span className="micro">(A/R, {o.travelers} pers.)</span>{o.flight.returnAirport&&<span className="opt-lc" style={{ background:'var(--gold-50,#FBF1DA)', color:'var(--gold-700,#B8841C)' }}>open-jaw</span>}{o.flight.lowcost&&<span className="opt-lc">low-cost</span>}</span>:<span className="micro"> · aéroport conseillé</span>}</div>}
          {o.flight && o.flight.compared && o.flight.compared.length>1 && (()=>{ const withP=o.flight.compared.filter(c=>c.price!=null); return (
            <div className="opt-cmp">
              <div className="opt-cmp-h"><Icon n="sparkles" size={12} /> Webbina a comparé {o.flight.compared.length} aéroports de départ</div>
              <div className="opt-cmp-row">
                {o.flight.compared.map(c=>(
                  <button key={c.iata} type="button" disabled={busy||c.iata===o.flight.origin} onClick={()=>onChangeAirport&&onChangeAirport(c.iata)} className={'opt-cmp-chip'+(c.iata===o.flight.origin?' win':'')} title={c.iata===o.flight.origin?'Aéroport retenu':'Recalculer depuis '+c.iata}>{c.iata}{c.price!=null?' '+fmt(c.price)+cur:''}</button>
                ))}
              </div>
              <div className="opt-cmp-note">{busy? 'Recalcul en cours…' : (withP.length? <>✓ <b>{o.flight.origin}</b> retenu · <b>touchez un aéroport</b> pour recalculer depuis là</> : 'Tarifs indicatifs indisponibles pour ces dates — aéroport le plus proche retenu')}</div>
            </div>
          ); })()}
          {o.access && <div className="opt-flight"><Icon n={o.access.mode==='DRIVE'?'car':'bus'} size={13} /> <b>Accès aéroport</b> <span className="micro">· {o.access.label}{o.access.cost?` · ~${fmt(o.access.cost)} ${cur}`:''}</span></div>}
          <div className="opt-mini">
            {o.car && <span><Icon n="car" size={12} /> {o.car.category}</span>}
            <span><Icon n="star" size={12} /> hôtels {o.hotelTier}</span>
            {o.drivingTotalKm>0 && <span><Icon n="route" size={12} /> {fmt(o.drivingTotalKm)} km</span>}
          </div>
          <div className="opt-incl">Inclus : accès aéroport · vol{o.car?' · voiture':''} · hôtels ({o.stops.reduce((s,x)=>s+x.nights,0)} nuits) · visites · carburant/péages</div>
          <button className="btn btn--primary btn--block btn--sm" style={{ marginTop:12 }} onClick={()=>onPick(o)}>Voir le détail & choisir <Icon n="arrowRight" size={15} /></button>
        </div>
      ); })}
      <button className="btn btn--ghost btn--block" onClick={onReset}><Icon n="arrowLeft" size={16} /> Modifier ma demande</button>
    </div>
  );
}

/* ---- Tunnel séquentiel de composition (étape par étape, tout modifiable) ---- */
function RoadbookTunnel({ plan, go, book, onReset }){
  const cur = plan.budget.currency==='EUR'?'€':plan.budget.currency;
  const pax = plan.travelers||1;
  const rooms = Math.max(1, Math.ceil(pax/2));
  const totalNights = plan.stops.reduce((s,x)=>s+x.nights,0);
  const days = (plan.car&&plan.car.days) || (totalNights+1);
  const CAR_CATS = [['Économique',42],['Compacte',55],['SUV / Familiale',78],['Premium',110]];
  const flyDrive = plan.mode==='fly-drive';

  const [tiers,setTiers]=React.useState(()=>plan.stops.map(()=>plan.hotelTier||'confort'));
  const [carCat,setCarCat]=React.useState(plan.car?plan.car.category:'Compacte');
  const [acts,setActs]=React.useState({});          // "ci:ai" -> true
  const [hotelFilter,setHotelFilter]=React.useState('tous'); // tous|éco|confort|premium

  const STEPS = flyDrive ? ['Itinéraire','Vols','Voiture','Hôtels','Activités'] : ['Itinéraire','Hôtels','Activités'];
  const [step,setStep]=React.useState(0);
  const cur_id = STEPS[step];
  const [guided,setGuided]=React.useState(()=>{ try{ return localStorage.getItem('tf_guided')==='1'; }catch(e){ return false; } });
  function setGuide(on){ setGuided(on); try{ localStorage.setItem('tf_guided', on?'1':'0'); }catch(e){} if(!on){ try{ window.Voice&&Voice.cancel(); }catch(e){} } }

  // ---- budget dérivé des choix ----
  const hotelOf=(s,ti)=> (s.hotels && (s.hotels.find(h=>h.tier===ti)||s.hotels[0])) || null;
  const hotelsTotal=plan.stops.reduce((sum,s,i)=>{ const h=hotelOf(s,tiers[i]); return sum+(h?h.pricePerNight*s.nights*rooms:0); },0);
  const carPerDay=(CAR_CATS.find(c=>c[0]===carCat)||[,55])[1];
  const carTotal=flyDrive?carPerDay*days:0;
  const actCount=Object.values(acts).filter(Boolean).length;
  const actsTotal=actCount*25*pax;
  const b0=plan.budget;
  const total=Math.round((b0.flights||0)+(b0.access||0)+carTotal+hotelsTotal+(b0.fuel||0)+(b0.tolls||0)+actsTotal);
  const perPerson=Math.round(total/pax);

  function setTier(i,ti){ setTiers(p=>{ const n=[...p]; n[i]=ti; return n; }); }
  function toggleAct(k){ setActs(p=>({ ...p, [k]:!p[k] })); }
  const mapUrl = (()=>{ const api=(window.WEBBINA_API||'').replace(/\/+$/,''); return api?api+'/api/map/route.png?points='+encodeURIComponent(plan.stops.map(s=>s.city).join('|'))+(plan.region?('&region='+encodeURIComponent(plan.region)):''):null; })();

  // Narration guidée par étape (texte lu à voix haute pour les personnes peu à l'aise).
  const cities=plan.stops.map(s=>s.city).join(', ');
  const GUIDE={
    'Itinéraire':`Étape ${step+1} sur ${STEPS.length}. Voici l'itinéraire que je vous propose : ${cities}. Regardez les étapes sur la carte, puis touchez « On continue » quand vous êtes prête.`,
    'Vols':`Le vol maintenant.${plan.flight&&plan.flight.real?` Je pars de ${plan.flight.origin} vers ${plan.flight.arrival}, pour environ ${fmt(plan.flight.price)} euros aller-retour pour tout le monde.`:''} Si vous préférez d'autres dates, touchez le calendrier des prix. Sinon, on continue.`,
    'Voiture':`La voiture de location. J'ai pré-choisi la catégorie ${carCat}. Touchez une autre catégorie si vous voulez, le prix s'ajuste tout seul. Puis on continue.`,
    'Hôtels':`Les hôtels. Pour chaque ville, choisissez simplement entre éco, confort ou premium en touchant la carte. Le budget total se met à jour automatiquement en haut.`,
    'Activités':`Dernière étape : les activités, c'est optionnel. Cochez celles qui vous tentent, ou passez directement. Ensuite, touchez « Valider et réserver » et je m'occupe du reste.`,
  };
  React.useEffect(()=>{
    if(!guided) return;
    try{ window.Voice&&Voice.cancel(); window.Voice&&Voice.speak(GUIDE[cur_id]||'',{ expr:'happy' }); }catch(e){}
    return ()=>{ try{ window.Voice&&Voice.cancel(); }catch(e){} };
  }, [step, guided]);

  function finalize(){
    const enriched={ ...plan, hotelTierPerCity:tiers, carCategory:carCat, budget:{ ...b0, car:Math.round(carTotal), hotels:Math.round(hotelsTotal), activities:Math.round(actsTotal), total, perPerson } };
    if(book) book({ dest:{ name:plan.title, country:plan.region }, flight:{ airline:plan.title, code:'★', price:total }, roadtrip:enriched });
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* Stepper */}
      <div className="tnl-steps">
        {STEPS.map((s,i)=>(
          <button key={s} className={'tnl-step'+(i===step?' on':'')+(i<step?' done':'')} onClick={()=>i<=step&&setStep(i)}>
            <span className="tnl-num">{i<step?<Icon n="check" size={12} />:i+1}</span>
            <span className="tnl-lbl">{s}</span>
          </button>
        ))}
      </div>

      {/* Bandeau budget live */}
      <div className="tnl-budget"><span>Budget total</span><b>{fmt(total)} {cur}</b><span className="micro">≈ {fmt(perPerson)} {cur}/pers</span></div>

      {/* Guide vocal Webbina (personnes peu à l'aise) */}
      {guided ? (
        <div className="tnl-guide">
          <LivingWebbina size={44} state="idle" expr="happy" style={{ flex:'none' }} />
          <div style={{ flex:1 }}><b style={{ fontFamily:'var(--font-display)', fontSize:13 }}>Webbina vous guide</b><p className="micro" style={{ marginTop:2, lineHeight:1.45 }}>{GUIDE[cur_id]}</p></div>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <button className="icon-btn" title="Réécouter" onClick={()=>{ try{ window.Voice&&Voice.cancel(); window.Voice&&Voice.speak(GUIDE[cur_id],{expr:'happy'}); }catch(e){} }}><Icon n="mic" size={16} /></button>
            <button className="icon-btn" title="Couper le guide" onClick={()=>setGuide(false)}><Icon n="x" size={16} /></button>
          </div>
        </div>
      ) : (
        <button className="tnl-guide-on" onClick={()=>setGuide(true)}><Icon n="sparkles" size={15} /> Besoin d'aide ? Laissez Webbina vous guider pas à pas 🔊</button>
      )}

      {/* ÉTAPE ITINÉRAIRE */}
      {cur_id==='Itinéraire' && (
        <div className="card card--pad">
          <h4 style={{ fontSize:15, marginBottom:8 }}>Votre itinéraire — {plan.stops.length} étapes</h4>
          {mapUrl && <img src={mapUrl} alt="Carte" crossOrigin="anonymous" style={{ width:'100%', borderRadius:'var(--r-md)', border:'1px solid var(--border)', display:'block', marginBottom:12 }} onError={e=>{e.target.style.display='none';}} />}
          {plan.stops.map((s,i)=>(
            <div key={i} className="tnl-stop">
              {s.driveFromPrev && <div className="rt-drive"><Icon n="car" size={12} /> {hm(s.driveFromPrev.durationMin)} · {fmt(s.driveFromPrev.distanceKm)} km</div>}
              <div className="row gap2" style={{ alignItems:'center' }}><span className="rt-badge">{i+1}</span><b style={{ fontFamily:'var(--font-display)', fontSize:16, flex:1 }}>{s.city}</b><span className="micro">{s.nights} nuit{s.nights>1?'s':''}</span></div>
              {s.summary && <p className="micro" style={{ marginTop:4, lineHeight:1.5 }}>{s.summary}</p>}
              {s.days && s.days[0] && s.days[0].items && <div className="tnl-see">{s.days.flatMap(d=>d.items).slice(0,4).map((it,k)=><span key={k} className="tnl-chip">{it}</span>)}</div>}
            </div>
          ))}
        </div>
      )}

      {/* ÉTAPE VOLS */}
      {cur_id==='Vols' && plan.flight && (
        <div className="card card--pad">
          <h4 style={{ fontSize:15, marginBottom:8 }}>Votre vol</h4>
          <div className="rt-line"><div className="rt-line-ic"><Icon n="plane" size={16} /></div>
            <div style={{ flex:1 }}><b>{plan.flight.origin} → {plan.flight.arrival}{plan.flight.returnAirport?' · retour '+plan.flight.returnAirport:''}</b><div className="micro">{plan.flight.real?`Meilleur tarif A/R · ${pax} pers.`:'Aéroport conseillé'}{plan.flight.lowcost?' · low-cost':''}</div></div>
            <b>{plan.flight.real?fmt(plan.flight.price)+' '+cur:'—'}</b>
          </div>
          {plan.flight.note && <div className="micro" style={{ color:'var(--text-muted)', marginTop:6, lineHeight:1.45 }}>{plan.flight.note}</div>}
          {plan.flight.real && <button className="btn btn--secondary btn--block btn--sm" style={{ marginTop:10 }} onClick={()=>{ window.__TF_PG={ origin:plan.flight.origin, destination:plan.flight.arrival, pax }; go('pricegrid'); }}><Icon n="grid" size={14} /> Calendrier des prix (choisir d'autres dates)</button>}
          {plan.access && <div className="rt-line" style={{ marginTop:10 }}><div className="rt-line-ic"><Icon n={plan.access.mode==='DRIVE'?'car':'bus'} size={16} /></div><div style={{ flex:1 }}><b>Accès aéroport — {plan.access.label}</b><div className="micro">{Math.round(plan.access.durationMin)} min</div></div><b>{plan.access.cost?fmt(plan.access.cost)+' '+cur:'—'}</b></div>}
        </div>
      )}

      {/* ÉTAPE VOITURE */}
      {cur_id==='Voiture' && (
        <div className="card card--pad">
          <h4 style={{ fontSize:15, marginBottom:4 }}>Location de voiture</h4>
          <div className="micro" style={{ marginBottom:10 }}>Prise à <b>{plan.flight?plan.flight.arrival:'l\'arrivée'}</b>{plan.flight&&plan.flight.returnAirport&&plan.flight.returnAirport!==plan.flight.arrival?<> · restitution à <b>{plan.flight.returnAirport}</b> (open-jaw)</>:' · restitution au même endroit'} · {days} jours</div>
          <div className="tnl-cars">
            {CAR_CATS.map(c=>{ const sel=carCat===c[0]; return (
              <button key={c[0]} className={'tnl-car'+(sel?' sel':'')} onClick={()=>setCarCat(c[0])}>
                <Icon n="car" size={18} />
                <b>{c[0]}</b>
                <span>{c[1]} {cur}/j</span>
                <span className="micro">{fmt(c[1]*days)} {cur} total</span>
              </button>
            ); })}
          </div>
          <a className="btn btn--secondary btn--block btn--sm" href="https://www.discovercars.com/?a_aid=TravelFamily" target="_blank" rel="noopener" style={{ marginTop:10, textDecoration:'none' }}><Icon n="arrowRight" size={15} /> Voir les modèles disponibles</a>
          <div className="micro" style={{ color:'var(--text-muted)', marginTop:8 }}>⚠️ Permis + carte de crédit du conducteur obligatoires au retrait.</div>
        </div>
      )}

      {/* ÉTAPE HÔTELS */}
      {cur_id==='Hôtels' && (
        <div className="card card--pad">
          <div className="row between" style={{ alignItems:'center', marginBottom:8 }}>
            <h4 style={{ fontSize:15 }}>Hôtels par étape</h4>
            <select className="tnl-filter" value={hotelFilter} onChange={e=>setHotelFilter(e.target.value)}>
              <option value="tous">Tous les niveaux</option><option value="éco">Éco</option><option value="confort">Confort</option><option value="premium">Premium</option>
            </select>
          </div>
          {plan.stops.map((s,i)=>{ const list=(s.hotels||[]).filter(h=>hotelFilter==='tous'||h.tier===hotelFilter).slice().sort((a,b)=>a.pricePerNight-b.pricePerNight); return (
            <div key={i} className="tnl-hstop">
              <div className="row between"><b style={{ fontFamily:'var(--font-display)', fontSize:14 }}>{i+1}. {s.city}</b><span className="micro">{s.nights} nuit{s.nights>1?'s':''}</span></div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:6 }}>
                {list.map((h,k)=>{ const t=RT_TIERS[h.tier]||RT_TIERS.confort; const sel=tiers[i]===h.tier; return (
                  <button key={k} className={'tnl-hotel'+(sel?' sel':'')} onClick={()=>setTier(i,h.tier)} style={sel?{ borderColor:t.c }:{}}>
                    <span className="tnl-htier" style={{ color:t.c }}><Icon n={sel?'check':t.ic} size={13} /> {h.tier}</span>
                    <span style={{ flex:1, textAlign:'left', fontSize:12.5 }}>{h.name}</span>
                    <b style={{ fontFamily:'var(--font-display)', fontSize:13.5 }}>{fmt(h.pricePerNight)} {cur}<span className="micro">/nuit</span></b>
                  </button>
                ); })}
              </div>
            </div>
          ); })}
          <div className="micro" style={{ color:'var(--text-muted)', marginTop:8 }}>Estimations haute saison × {rooms} chambre{rooms>1?'s':''}. Réservation en direct dès activation partenaires.</div>
        </div>
      )}

      {/* ÉTAPE ACTIVITÉS */}
      {cur_id==='Activités' && (
        <div className="card card--pad">
          <h4 style={{ fontSize:15, marginBottom:4 }}>Activités à ajouter</h4>
          <div className="micro" style={{ marginBottom:10 }}>Optionnel — ~25 {cur}/personne par activité. Cochez ce qui vous tente.</div>
          {plan.stops.map((s,ci)=>(
            <div key={ci} className="tnl-hstop">
              <b style={{ fontFamily:'var(--font-display)', fontSize:14 }}>{s.city}</b>
              <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:6 }}>
                {[...new Set(s.days.flatMap(d=>d.items))].slice(0,5).map((it,ai)=>{ const k=ci+':'+ai; const on=!!acts[k]; return (
                  <button key={ai} className={'tnl-act'+(on?' on':'')} onClick={()=>toggleAct(k)}>
                    <span className={'tnl-check'+(on?' on':'')}>{on&&<Icon n="check" size={11} />}</span>
                    <span style={{ flex:1, textAlign:'left', fontSize:12.5 }}>{it}</span>
                    {on&&<b className="micro" style={{ color:'var(--ocean-700)' }}>+{25*pax} {cur}</b>}
                  </button>
                ); })}
              </div>
            </div>
          ))}
          <a className="btn btn--secondary btn--block btn--sm" href="https://www.getyourguide.fr?partner_id=Q2FL4D9&cmp=share_to_earn" target="_blank" rel="noopener" style={{ marginTop:10, textDecoration:'none' }}><Icon n="star" size={15} /> Explorer plus d'activités</a>
        </div>
      )}

      {/* Navigation */}
      <div className="row gap2">
        {step>0 && <button className="btn btn--ghost" style={{ flex:1 }} onClick={()=>setStep(step-1)}><Icon n="arrowLeft" size={16} /> Précédent</button>}
        {step<STEPS.length-1
          ? <button className="btn btn--primary" style={{ flex:2, ...(guided?{ minHeight:56, fontSize:16 }:{}) }} onClick={()=>setStep(step+1)}>{guided?'On continue':'Continuer'} <Icon n="arrowRight" size={16} /></button>
          : <button className="btn btn--cta" style={{ flex:2, ...(guided?{ minHeight:56, fontSize:16 }:{}) }} onClick={finalize}><Icon n="check" size={18} /> Valider et réserver</button>}
      </div>
      <div className="row gap2">
        <button className="btn btn--ghost btn--sm" style={{ flex:1 }} onClick={()=>{ window.__TF_CARNET_PLAN={ ...plan, hotelTierPerCity:tiers }; go('carnet'); }}><Icon n="download" size={14} /> Aperçu carnet</button>
        <button className="btn btn--ghost btn--sm" style={{ flex:1 }} onClick={onReset}>Autres itinéraires</button>
      </div>
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
