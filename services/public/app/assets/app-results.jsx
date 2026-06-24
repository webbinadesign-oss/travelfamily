/* TravelFamily.AI app — Results + Destination detail (tabs: Aperçu / Vols / Hôtels / Itinéraire) */

function ResultsScreen({ go, trip, favs, toggleFav }) {
  const a = trip && !trip.id ? (trip||{}) : {};          // answers payload (budget, adults, kids…)
  const pax = Math.max(1, (a.adults||2) + (a.kids||0));
  const budget = a.budget || null;                        // total family budget
  const [filter, setFilter] = React.useState('Match');
  const filters=['Match','Prix','☀️ Plage','✈️ Sans escale','🌿 Sans avion'];

  const estTotal = (d)=> d.price * pax;                   // per-person × travellers
  let list=[...TF.DESTINATIONS].map(d=>({ ...d, _total: estTotal(d), _over: budget? estTotal(d) > budget : false }));
  if(filter==='Prix') list.sort((x,y)=>x._total-y._total);
  else list.sort((x,y)=> (x._over-y._over) || (y.match-x.match)); // in-budget first

  const inBudget = list.filter(d=>!d._over);
  const best = inBudget[0] || list[0];
  const paxLabel = `${pax} pers.`;
  const budgetLabel = budget ? `≈ ${budget.toLocaleString('fr-FR')} €` : 'budget libre';

  return (
    <div className="screen">
      <div className="sub-head">
        <button className="icon-btn" onClick={()=>go('chat')} aria-label="Retour"><Icon n="arrowLeft" size={22} /></button>
        <div style={{ flex:1 }}>
          <b style={{ fontFamily:'var(--font-display)', fontSize:17 }}>{budget ? `${inBudget.length} destination${inBudget.length>1?'s':''} dans votre budget` : `${list.length} destinations pour vous`}</b>
          <div className="micro">{paxLabel} · {budgetLabel}</div>
        </div>
        <button className="icon-btn" aria-label="Filtres"><Icon n="sliders" size={22} /></button>
      </div>
      <div className="quick-suggest" style={{ padding:'12px 16px', flexWrap:'nowrap', overflowX:'auto' }}>
        {filters.map(f=><button key={f} className={`chip ${filter===f?'chip--active':''}`} style={{ flex:'none' }} onClick={()=>setFilter(f)}>{f}</button>)}
      </div>
      <div style={{ padding:'4px 16px 16px', display:'flex', flexDirection:'column', gap:16 }}>
        <div className="ai-note">
          <Avatar size={34} expr="enthusiastic" />
          <div className="micro" style={{ color:'var(--ocean-700)' }}>{budget
            ? <React.Fragment><b>J'ai gardé votre budget en tête&nbsp;: {budgetLabel}.</b> Voici ce que je recommande pour {paxLabel}, sans le dépasser. Mon coup de cœur&nbsp;: <b>{best&&best.name}</b>. 💙</React.Fragment>
            : <React.Fragment><b>Mon coup de cœur&nbsp;: {best&&best.name}.</b> Le meilleur équilibre soleil, activités enfants et budget. 💙</React.Fragment>}
          </div>
        </div>
        {list.map((d,i)=>(
          <div key={d.id} style={{ position:'relative', opacity: d._over?0.62:1 }}>
            {d===best && !d._over && filter==='Match' && <div className="coup-tag"><Icon n="sparkles" size={13} />Coup de cœur de Webbina</div>}
            {d._over && <div className="over-tag"><Icon n="info" size={12} />≈ {d._total.toLocaleString('fr-FR')} € · au-dessus du budget</div>}
            <DestCard d={d} onOpen={()=>go('detail', { ...d, _pax:pax, _budget:budget })} fav={favs.includes(d.id)} onFav={toggleFav} showMatch />
          </div>
        ))}
        {budget && inBudget.length===0 && (
          <div className="micro" style={{ color:'var(--text-2)', padding:'4px 2px' }}>Aucune destination ne rentre tout à fait dans {budgetLabel} pour {paxLabel}. Je vous montre les plus proches — dites-moi si vous pouvez ajuster le budget ou la durée. 💙</div>
        )}
      </div>
    </div>
  );
}

const TABS_DETAIL = [['apercu','Aperçu'],['vols','Vols'],['hotels','Hôtels'],['surplace','Sur place'],['jour','Jour par jour']];

function DetailScreen({ trip, go, book, favs, toggleFav }) {
  const d = trip && trip.id ? trip : TF.DESTINATIONS[0];
  const [tab, setTab] = React.useState('apercu');
  const fav = favs.includes(d.id);
  return (
    <div className="screen" style={{ paddingBottom:96 }}>
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
          <h2 style={{ color:'#fff', fontSize:30, marginTop:8 }}>{d.name}, {d.country}</h2>
          <div className="row gap3" style={{ color:'#fff', opacity:.95, marginTop:4, fontSize:14 }}>
            <span className="row gap2"><Icon n="mapPin" size={15} />{d.tag}</span>
            <span className="row gap2"><Icon n="star" size={15} />{String(d.rating).replace('.',',')}</span>
            <span className="row gap2"><Icon n="users" size={15} />{d.kid}</span>
          </div>
        </div>
      </div>

      <div className="detail-tabs">
        {TABS_DETAIL.map(([k,l])=>(
          <button key={k} className={`detail-tab ${tab===k?'on':''}`} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>

      <div style={{ padding:'16px 16px 0' }}>
        {tab==='apercu' && <ApercuTab d={d} go={go} book={book} />}
        {tab==='vols' && <VolsTab dest={d} book={book} />}
        {tab==='hotels' && <HotelsTab dest={d} />}
        {tab==='surplace' && <SurPlaceTab dest={d} />}
        {tab==='jour' && <ItineraryTab />}
      </div>

      <div className="sticky-cta">
        <div><div className="micro">Voyage complet · 5 pers.</div><b style={{ fontFamily:'var(--font-display)', fontSize:20 }}>{(d.price*5).toLocaleString('fr-FR')} €</b></div>
        <button className="btn btn--cta" onClick={()=>go('dashboard')}>Réserver<Icon n="arrowRight" size={20} /></button>
      </div>
    </div>
  );
}

function WeatherWidget({ dest }) {
  const [state, setState] = React.useState('idle'); // idle|loading|live|fail
  const [data, setData] = React.useState(null);
  React.useEffect(()=>{
    let cancelled=false;
    const lat=dest&&dest.lat, lng=dest&&dest.lng;
    if(lat==null||lng==null||!window.WebbinaBackend||!window.WebbinaBackend.weather){ setState('fail'); return; }
    (async()=>{
      const live=await window.WebbinaBackend.isLive();
      if(!live){ if(!cancelled) setState('fail'); return; }
      setState('loading');
      try{ const w=await window.WebbinaBackend.weather(lat,lng); if(!cancelled){ setData(w); setState('live'); } }
      catch(e){ if(!cancelled) setState('fail'); }
    })();
    return ()=>{ cancelled=true; };
  }, [dest&&dest.id]);

  if(state==='fail'||state==='idle') return null;
  const icon=(code)=>{ const c=(code||'').slice(0,2); return ({'01':'sun','02':'sun','03':'cloud','04':'cloud','09':'droplet','10':'droplet','11':'zap','13':'snowflake','50':'wind'})[c]||'sun'; };
  const days=['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  return (
    <div className="card card--pad weather-card">
      <div className="row between" style={{ marginBottom: state==='live'?12:0 }}>
        <div className="row gap2" style={{ alignItems:'center' }}>
          <Icon n="sun" size={18} style={{ color:'var(--gold)' }} />
          <h4 style={{ fontSize:16 }}>Météo à {dest.name}</h4>
        </div>
        {state==='live' && <span className="micro" style={{ color:'var(--success)', fontWeight:700 }}><Icon n="check" size={12} /> En direct</span>}
      </div>
      {state==='loading' && <div className="micro">Je consulte la météo sur place… 🌤️</div>}
      {state==='live' && data && (
        <React.Fragment>
          <div className="row gap3" style={{ alignItems:'center', marginBottom:14 }}>
            <div className="wx-now"><Icon n={icon(data.now.icon)} size={34} style={{ color:'var(--gold)' }} /></div>
            <div>
              <b style={{ fontFamily:'var(--font-display)', fontSize:30, lineHeight:1 }}>{data.now.tempC}°</b>
              <div className="micro" style={{ textTransform:'capitalize' }}>{data.now.condition} · ressenti {data.now.feelsLikeC}°</div>
            </div>
          </div>
          <div className="wx-days">
            {(data.daily||[]).slice(0,5).map((dy,i)=>{
              const dd=new Date(dy.date);
              return (
                <div key={i} className="wx-day">
                  <span className="micro">{days[dd.getDay()]}</span>
                  <Icon n={icon(dy.icon)} size={18} style={{ color:'var(--gold)' }} />
                  <b style={{ fontFamily:'var(--font-display)', fontSize:13 }}>{dy.maxC}°</b>
                  <span className="micro">{dy.minC}°</span>
                </div>
              );
            })}
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

function ApercuTab({ d, go, book }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className="ai-note" style={{ background:'var(--surface)', border:'1px solid var(--border)', boxShadow:'var(--sh-sm)' }}>
        <Avatar size={38} expr="reassuring" />
        <div style={{ fontSize:14.5, lineHeight:1.5 }}><b style={{ fontFamily:'var(--font-display)' }}>Pourquoi je la recommande&nbsp;:</b> {d.desc}
          <div style={{ marginTop:8 }}><SpeakBtn text={'Pourquoi je la recommande. '+d.desc} /></div>
        </div>
      </div>
      <WeatherWidget dest={d} />
      <PackageCard dest={d} book={book} />
      {/* formalités quick link */}
      <button className="card card--hover" onClick={()=>go('formalites')} style={{ width:'100%', textAlign:'left', padding:14, display:'flex', alignItems:'center', gap:12, border:'1px solid var(--border)' }}>
        <div style={{ width:44, height:44, borderRadius:12, background:'var(--warning-bg)', display:'grid', placeItems:'center', flex:'none' }}><Icon n="shield" size={22} style={{ color:'var(--warning)' }} /></div>
        <div style={{ flex:1 }}><div className="row gap2" style={{alignItems:'center'}}><b style={{ fontFamily:'var(--font-display)', fontSize:15 }}>Formalités d'entrée</b><StatusDot status="orange" size={9} /></div><div className="micro">Visa, passeports, vaccins — 1 action requise</div></div>
        <Icon n="chevronRight" size={20} style={{ color:'var(--text-muted)' }} />
      </button>
      {/* budget breakdown */}
      <div className="card card--pad">
        <div className="row between" style={{ marginBottom:12 }}>
          <h4 style={{ fontSize:18 }}>Budget estimé</h4>
          <b style={{ fontFamily:'var(--font-display)', fontSize:22 }}>{(d.price*(d._pax||5)).toLocaleString('fr-FR')} €</b>
        </div>
        <div style={{ height:14, borderRadius:99, background:'var(--slate-100)', overflow:'hidden', display:'flex' }}>
          <div style={{ width:'46%', background:'var(--ocean)' }}></div><div style={{ width:'34%', background:'var(--turq)' }}></div><div style={{ width:'20%', background:'var(--coral)' }}></div>
        </div>
        <div className="row wrap gap2" style={{ marginTop:12 }}>
          <Badge tone="ocean" icon="plane">Vols {Math.round(d.price*(d._pax||5)*0.46).toLocaleString('fr-FR')} €</Badge>
          <Badge tone="turq" icon="bed">Séjour {Math.round(d.price*(d._pax||5)*0.34).toLocaleString('fr-FR')} €</Badge>
          <Badge tone="coral" icon="compass">Activités {Math.round(d.price*(d._pax||5)*0.20).toLocaleString('fr-FR')} €</Badge>
        </div>
        {(() => {
          const total=d.price*(d._pax||5); const bud=d._budget;
          if(!bud) return <div className="micro" style={{ marginTop:10, color:'var(--text-2)' }}>Estimation pour {(d._pax||5)} voyageurs.</div>;
          return total<=bud
            ? <div className="micro" style={{ marginTop:10, color:'var(--success)', fontWeight:700 }}><Icon n="check" size={14} /> Dans votre budget de {bud.toLocaleString('fr-FR')} € (il reste ≈ {(bud-total).toLocaleString('fr-FR')} €)</div>
            : <div className="micro" style={{ marginTop:10, color:'var(--warning)', fontWeight:700 }}><Icon n="info" size={14} /> ≈ {(total-bud).toLocaleString('fr-FR')} € au-dessus de votre budget de {bud.toLocaleString('fr-FR')} €</div>;
        })()}
      </div>
    </div>
  );
}

function CompareExplain({ children }) {
  return (
    <div className="explain">
      <Avatar size={30} expr="reassuring" />
      <div style={{ fontSize:13.5, lineHeight:1.5 }}><span dangerouslySetInnerHTML={{__html:children}} />
        <div style={{ marginTop:8 }}><SpeakBtn text={children} /></div>
      </div>
    </div>
  );
}

/* ── Duffel helpers: format real offers into the card shape ─────────────── */
const AIRLINE_NAMES = { AF:'Air France', KL:'KLM', LH:'Lufthansa', BA:'British Airways', EK:'Emirates', QR:'Qatar Airways', TK:'Turkish Airlines', EY:'Etihad', SQ:'Singapore Airlines', AA:'American Airlines', UA:'United', IB:'Iberia', TP:'TAP Air Portugal', AZ:'ITA Airways', U2:'easyJet', FR:'Ryanair', VY:'Vueling', LX:'SWISS', SN:'Brussels Airlines' };
function isoToHM(iso){ if(!iso) return ''; const m=/PT(?:(\d+)H)?(?:(\d+)M)?/.exec(iso); if(!m) return ''; const h=m[1]?m[1]+' h':''; const min=m[2]?(' '+m[2]+' min'):''; return (h+min).trim()||'—'; }
function hhmm(dt){ try{ return new Date(dt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); }catch(e){ return ''; } }
function offerToCard(o, i){
  const segs=o.segments||[]; const first=segs[0]||{}; const last=segs[segs.length-1]||{};
  const code=first.carrierCode||'??';
  return {
    id:o.id||('d'+i), code,
    airline:AIRLINE_NAMES[code]||code,
    stops:o.stops||0,
    dur:isoToHM(o.durationIso),
    via:(o.stops===0)?'Direct':((o.stops===1)?'1 escale':o.stops+' escales'),
    price:Math.round(o.price&&o.price.amount||0),
    rating:4.5,
    time:(hhmm(first.departureAt)+' → '+hhmm(last.arrivalAt)),
    recommended:false,
  };
}

function CoherenceBlock({ offer, dest }) {
  const [res, setRes] = React.useState(null);
  const [state, setState] = React.useState('loading'); // loading|done|off

  React.useEffect(()=>{
    let cancelled=false;
    if(!offer || !window.WebbinaBackend || !window.WebbinaBackend.coherence){ setState('off'); return; }
    const segs=offer.segments||[];
    if(!segs.length){ setState('off'); return; }
    // Build legs from the real flight + a return ~5 nights later; hotel aligned to arrival.
    const arrIso=segs[segs.length-1].arrivalAt;
    const arrivalDay=new Date(arrIso); const checkIn=arrivalDay.toISOString().slice(0,10);
    const co=new Date(arrivalDay); co.setDate(co.getDate()+(dest&&dest.nights||5)); const checkOut=co.toISOString().slice(0,10);
    const legs=segs.map(s=>({ mode:'flight', from:s.from, to:s.to, departure:s.departureAt, arrival:s.arrivalAt, label:s.flightNumber||(s.from+'→'+s.to) }));
    (async()=>{
      try{
        const r=await window.WebbinaBackend.coherence({ legs, hotel:{ checkIn, checkOut }, hasYoungChildren:true });
        if(!cancelled){ setRes(r); setState('done'); }
      }catch(e){ if(!cancelled) setState('off'); }
    })();
    return ()=>{ cancelled=true; };
  }, [offer&&offer.id]);

  if(state==='off') return null;
  const META={ green:{bg:'var(--success-bg)',fg:'var(--success)',bd:'var(--success-border)',ic:'check'}, orange:{bg:'var(--warning-bg)',fg:'var(--warning)',bd:'var(--warning-border)',ic:'info'}, red:{bg:'var(--error-bg,#FEECEC)',fg:'var(--error)',bd:'var(--error-border,#F5C2C2)',ic:'info'} };
  const top = res ? META[res.status] : META.green;
  return (
    <div className="card card--pad" style={{ borderLeft:`4px solid ${top.fg}` }}>
      <div className="row gap2" style={{ alignItems:'center', marginBottom: state==='done'?10:0 }}>
        <Icon n="clock" size={18} style={{ color:top.fg }} />
        <h4 style={{ fontSize:16, flex:1 }}>Cohérence des horaires</h4>
        {state==='done' && <span className="micro" style={{ color:'var(--success)', fontWeight:700 }}><Icon n="check" size={12} /> Vérifié</span>}
      </div>
      {state==='loading' && <div className="micro">Je vérifie que tout s'enchaîne bien (vol, J+1, nuits d'hôtel)… 🧭</div>}
      {state==='done' && res && (
        <React.Fragment>
          <div className="webbina-reco" style={{ marginBottom:10 }}>
            <Avatar size={26} expr={res.status==='red'?'reassuring':res.status==='orange'?'focused':'happy'} />
            <div className="micro" style={{ color:'var(--text-2)', lineHeight:1.5 }}>{res.summary}</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {res.checks.map((c,i)=>{
              const m=META[c.status];
              return (
                <div key={i} className="row gap2" style={{ alignItems:'flex-start', padding:'9px 11px', borderRadius:'var(--r-md)', background:m.bg, border:`1px solid ${m.bd}` }}>
                  <Icon n={m.ic} size={15} style={{ color:m.fg, flex:'none', marginTop:1 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <b style={{ fontFamily:'var(--font-display)', fontSize:13, color:m.fg }}>{c.title}</b>
                    <div className="micro" style={{ color:'var(--text-2)', marginTop:1, lineHeight:1.4 }}>{c.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

function VolsTab({ dest, book }) {
  const [sel, setSel] = React.useState(null);
  const [state, setState] = React.useState('idle'); // idle|loading|live|fallback
  const [flights, setFlights] = React.useState(TF.FLIGHTS);
  const [rawBest, setRawBest] = React.useState(null);
  const [note, setNote] = React.useState(null);

  React.useEffect(()=>{
    let cancelled=false;
    const iata = dest && dest.iata;
    if(!iata || !window.WebbinaBackend){ setState('fallback'); return; }
    (async()=>{
      const live = await window.WebbinaBackend.isLive();
      if(!live){ if(!cancelled){ setState('fallback'); setNote('Hors-ligne — exemples affichés.'); } return; }
      setState('loading');
      // depart ~6 weeks out (test-data friendly), 2 adults + 2 children
      const dep=new Date(); dep.setDate(dep.getDate()+42);
      try{
        const r = await window.WebbinaBackend.searchFlights({ origin:'CDG', destination:iata, departureDate:dep.toISOString().slice(0,10), adults:2, children:2, maxResults:5 });
        if(cancelled) return;
        const items=(r.items||[]).map(offerToCard);
        if(items.length){ items[0].recommended=true; items[0].reason='La meilleure combinaison prix / escales que j\'ai trouvée en direct pour vos dates. ✨'; setFlights(items); setRawBest((r.items||[])[0]||null); setState('live'); }
        else { setState('fallback'); setNote('Aucun vol trouvé pour ces dates de test — exemples affichés.'); }
      }catch(e){ if(!cancelled){ setState('fallback'); setNote('Recherche indisponible — exemples affichés.'); } }
    })();
    return ()=>{ cancelled=true; };
  }, [dest && dest.iata]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12, paddingBottom:8 }}>
      <div className="compare-head">
        {state==='live'
          ? <span className="row gap2" style={{ color:'var(--success)', fontWeight:700 }}><Icon n="check" size={14} />Vols réels en direct · Duffel</span>
          : <React.Fragment><span>Comparé via</span>{TF.CONNECTORS.flights.map(n=><Connector key={n} name={n} />)}</React.Fragment>}
      </div>
      {state==='loading' && (
        <div className="ai-note" style={{ background:'var(--surface)', border:'1px solid var(--border)' }}>
          <Avatar size={32} expr="focused" />
          <div className="micro">Je cherche les meilleurs vols pour {dest&&dest.name}… ✈️</div>
        </div>
      )}
      {note && <div className="micro" style={{ color:'var(--text-muted)', padding:'0 2px' }}>{note}</div>}
      {state==='live' && rawBest && <CoherenceBlock offer={rawBest} dest={dest} />}
      {flights.map(f=>(
        <div key={f.id} className={`compare-card ${sel===f.id?'sel':''} ${f.recommended?'reco':''}`} onClick={()=>setSel(f.id)}>
          {f.recommended && <div className="reco-tag"><Icon n="sparkles" size={12} />Recommandé par Webbina</div>}
          <div className="row between">
            <div className="row gap3">
              <div className="airline-logo">{f.code}</div>
              <div>
                <b style={{ fontFamily:'var(--font-display)', fontSize:15 }}>{f.airline}</b>
                <div className="micro">{f.time}</div>
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <b style={{ fontFamily:'var(--font-display)', fontSize:18 }}>{f.price} €</b>
              <div className="micro">/ personne</div>
            </div>
          </div>
          <div className="row gap3 micro" style={{ marginTop:10 }}>
            <span className="row gap2"><Icon n="clock" size={13} />{f.dur}</span>
            <span className="row gap2" style={{ color: f.stops===0?'var(--success)':'var(--text-2)', fontWeight:f.stops===0?700:500 }}><Icon n={f.stops===0?'check':'plane'} size={13} />{f.via}</span>
            <span className="row gap2" style={{ color:'var(--gold-700)' }}><Icon n="star" size={13} />{String(f.rating).replace('.',',')}</span>
          </div>
          {f.reason && <CompareExplain>{f.reason}</CompareExplain>}
        </div>
      ))}
      {sel && book && (()=>{ const chosen=flights.find(x=>x.id===sel); return (
        <button className="btn btn--primary btn--block book-cta" onClick={()=>book({ dest, flight: chosen })}>
          Réserver ce vol · {chosen?chosen.price:''} €/pers <Icon n="arrowRight" size={18} />
        </button>
      ); })()}
    </div>
  );
}

function hotelToCard(h, i){
  const score = h.reviewScore != null ? Number(h.reviewScore) : (h.rating ? h.rating*2 : 8.5);
  return {
    id: h.hotelId || ('dh'+i),
    name: h.name || 'Hôtel',
    img: h.photoUrl || null,
    stars: h.rating ? Math.round(h.rating) : 4,
    rating: Math.round(score*10)/10,
    reviews: 0,
    price: Math.round(h.price && h.price.amount || 0),
    perNight: !!h.perNight,
    family: true,
    perks: [],
  };
}

function HotelsTab({ dest }) {
  const [sel, setSel] = React.useState(null);
  const [state, setState] = React.useState('idle'); // idle|loading|live|fallback
  const [hotels, setHotels] = React.useState(TF.HOTELS);
  const [note, setNote] = React.useState(null);

  React.useEffect(()=>{
    let cancelled=false;
    const lat=dest && dest.lat, lng=dest && dest.lng;
    if(lat==null || lng==null || !window.WebbinaBackend || !window.WebbinaBackend.searchHotels){ setState('fallback'); return; }
    (async()=>{
      const live = await window.WebbinaBackend.isLive();
      if(!live){ if(!cancelled){ setState('fallback'); setNote('Hors-ligne — exemples affichés.'); } return; }
      setState('loading');
      const ci=new Date(); ci.setDate(ci.getDate()+42);
      const co=new Date(ci); co.setDate(co.getDate()+ (dest.nights||5));
      try{
        const r = await window.WebbinaBackend.searchHotels({ lat, lng, checkInDate:ci.toISOString().slice(0,10), checkOutDate:co.toISOString().slice(0,10), adults:2, children:2, radiusKm:12 });
        if(cancelled) return;
        const items=(r.items||[]).slice(0,6).map(hotelToCard);
        if(items.length){ items[0].recommended=true; items[0].reason='Le meilleur rapport qualité-prix que j\'ai trouvé en direct près de '+dest.name+', pour vos dates. ✨'; setHotels(items); setState('live'); }
        else { setState('fallback'); setNote('Aucun hôtel trouvé sur ces dates de test — exemples affichés.'); }
      }catch(e){ if(!cancelled){ setState('fallback'); setNote('Recherche indisponible — exemples affichés.'); } }
    })();
    return ()=>{ cancelled=true; };
  }, [dest && dest.id]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12, paddingBottom:8 }}>
      <div className="compare-head">
        {state==='live'
          ? <span className="row gap2" style={{ color:'var(--success)', fontWeight:700 }}><Icon n="check" size={14} />Hôtels réels en direct · Duffel</span>
          : <React.Fragment><span>Comparé via</span>{TF.CONNECTORS.hotels.map(n=><Connector key={n} name={n} />)}</React.Fragment>}
      </div>
      {state==='loading' && (
        <div className="ai-note" style={{ background:'var(--surface)', border:'1px solid var(--border)' }}>
          <Avatar size={32} expr="focused" />
          <div className="micro">Je cherche les meilleurs hébergements pour {dest&&dest.name}… 🏨</div>
        </div>
      )}
      {note && <div className="micro" style={{ color:'var(--text-muted)', padding:'0 2px' }}>{note}</div>}
      {hotels.map(h=>(
        <div key={h.id} className={`compare-card ${sel===h.id?'sel':''} ${h.recommended?'reco':''}`} onClick={()=>setSel(h.id)}>
          {h.recommended && <div className="reco-tag"><Icon n="sparkles" size={12} />Recommandé par Webbina</div>}
          <div className="row gap3">
            <div style={{ width:74, height:74, borderRadius:'var(--r-md)', backgroundImage:`url(${h.img&&h.img.startsWith('http')?h.img:'assets/'+(h.img||'photo-hotel.jpg')})`, backgroundSize:'cover', backgroundPosition:'center', flex:'none', background:h.img?undefined:'var(--slate-100)' }}></div>
            <div style={{ flex:1 }}>
              <div className="row between">
                <b style={{ fontFamily:'var(--font-display)', fontSize:14.5, lineHeight:1.2 }}>{h.name}</b>
              </div>
              <div className="row gap2 micro" style={{ marginTop:3 }}>
                <span style={{ color:'var(--gold)' }}>{'★'.repeat(Math.max(1,Math.min(5,h.stars)))}</span>
                {h.family && <Badge tone="success" icon="check">Famille</Badge>}
              </div>
              <div className="row gap2" style={{ marginTop:6 }}>
                <span className="rating-pill">{String(h.rating).replace('.',',')}</span>
                <span className="micro">{h.reviews?h.reviews.toLocaleString('fr-FR')+' avis · ':''}<b>{h.price} €</b>{h.perNight?'/nuit':' / séjour'}</span>
              </div>
            </div>
          </div>
          {h.perks && h.perks.length>0 && (
            <div className="row wrap gap2" style={{ marginTop:10 }}>
              {h.perks.map(p=><span key={p} className="perk"><Icon n="check" size={12} />{p}</span>)}
            </div>
          )}
          {h.reason && <CompareExplain>{h.reason}</CompareExplain>}
        </div>
      ))}
    </div>
  );
}

function ItineraryTab() {
  return (
    <div style={{ paddingBottom:8 }}>
      <div className="ai-note" style={{ background:'var(--surface)', border:'1px solid var(--border)', boxShadow:'var(--sh-sm)', marginBottom:14 }}>
        <Avatar size={34} expr="focused" />
        <div className="micro" style={{ color:'var(--ocean-700)' }}>J'ai conçu un rythme doux, pensé pour des enfants&nbsp;: jamais plus d'une grosse activité par jour. 🧒</div>
      </div>
      <div className="timeline">
        {TF.ITINERARY.map(day=>(
          <div key={day.day} className="tl-day">
            <div className="tl-dayhead">
              <div className="tl-daynum">J{day.day}</div>
              <div style={{ flex:1 }}><b style={{ fontFamily:'var(--font-display)', fontSize:15.5 }}>{day.title}</b></div>
              <span className="weather"><Icon n={day.weather[0]} size={15} style={{ color:'var(--gold)' }} />{day.weather[1]}°</span>
            </div>
            <div className="tl-items">
              {day.items.map((it,i)=>(
                <div key={i} className="tl-item">
                  <div className="tl-dot"><Icon n={it[0]} size={15} /></div>
                  <div style={{ flex:1 }}>
                    <div className="row gap2"><b className="tl-time">{it[1]}</b><b style={{ fontFamily:'var(--font-display)', fontSize:14 }}>{it[2]}</b></div>
                    <div className="micro">{it[3]}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button className="btn btn--secondary btn--block" style={{ marginTop:14 }}><Icon n="refresh" size={18} />Régénérer avec Webbina</button>
    </div>
  );
}

Object.assign(window, { ResultsScreen, DetailScreen });
