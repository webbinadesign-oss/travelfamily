/* TravelFamily.AI — Itinéraire porte-à-porte (réutilisable).
   - Segment "to"   : domicile → 1er transport (aéroport/gare).
   - Segment "from" : arrivée → hôtel/destination (dernier km).
   Chaque option peut être AJOUTÉE à la réservation (panier itinéraire),
   pour que le voyage final inclue TOUS les trajets. Visible dès la recherche.
   Modes réels (Google Routes) : transit/voiture. Bus/covoiturage/parking/
   transfert : comparés + lien direct (API marchandes à brancher). */

const ITIN_MODE_IC = { walk:'compass', drive:'car', bus:'bus', metro:'train', tram:'train', rail:'train', transit:'train', parking:'car', BUS:'bus', CARPOOL:'car', TRANSIT:'train', DRIVE:'car', WALK:'compass' };

/* Panier itinéraire (localStorage) — lu par le tunnel de réservation. */
window.tfItin = {
  list(){ try{ return JSON.parse(localStorage.getItem('tf_itin_legs')||'[]'); }catch(e){ return []; } },
  add(leg){ const a=this.list().filter(x=>x.key!==leg.key); a.push(leg); localStorage.setItem('tf_itin_legs', JSON.stringify(a)); window.dispatchEvent(new Event('tf-itin-change')); },
  remove(key){ const a=this.list().filter(x=>x.key!==key); localStorage.setItem('tf_itin_legs', JSON.stringify(a)); window.dispatchEvent(new Event('tf-itin-change')); },
  has(key){ return this.list().some(x=>x.key===key); },
  total(){ return this.list().reduce((s,x)=>s+(x.cost||0),0); },
  clear(){ localStorage.removeItem('tf_itin_legs'); window.dispatchEvent(new Event('tf-itin-change')); },
};

function ItinOptionRow({ o, segKey, addable }){
  const [open, setOpen] = React.useState(false);
  const key = segKey+':'+o.id;
  const [added, setAdded] = React.useState(()=>window.tfItin.has(key));
  function toggleAdd(e){
    e.stopPropagation();
    if(added){ window.tfItin.remove(key); setAdded(false); }
    else { window.tfItin.add({ key, label:o.label.replace(/ · le plus.*$/,''), mode:o.mode, cost:(o.cost&&o.cost.amount)||0, durationMin:o.durationMin }); setAdded(true); }
  }
  return (
    <div className={'itin-opt'+(added?' is-added':'')}>
      <button className="itin-head" onClick={()=>setOpen(!open)}>
        <div className="itin-ic"><Icon n={ITIN_MODE_IC[o.mode]||'route'} size={17} /></div>
        <div style={{ flex:1, textAlign:'left' }}>
          <b style={{ fontFamily:'var(--font-display)', fontSize:13.5 }}>{o.label}</b>
          <div className="micro">{o.durationMin} min{o.distanceKm?` · ${o.distanceKm} km`:''}{o.profileFit?` · ${o.profileFit}`:''}</div>
        </div>
        {o.cost && <span className="itin-cost">{o.cost.estimated?'~':''}{o.cost.amount} €</span>}
        <Icon n="chevronRight" size={16} style={{ color:'var(--text-muted)', transform:open?'rotate(90deg)':'none', transition:'transform .18s' }} />
      </button>
      {open && (
        <div className="itin-body">
          {o.steps.map((s,i)=>(
            <div key={i} className="itin-step">
              <div className="itin-step-ic"><Icon n={ITIN_MODE_IC[s.mode]||'compass'} size={13} /></div>
              <div style={{ flex:1 }}><span style={{ fontSize:12.5 }}>{s.instruction}{s.line?` (${s.line})`:''}</span><div className="micro">{s.durationMin} min{s.distanceKm?` · ${s.distanceKm} km`:''}</div></div>
            </div>
          ))}
          {o.note && <div className="micro" style={{ color:'var(--text-muted)', marginTop:6, lineHeight:1.45 }}>{o.note}</div>}
          <div className="row gap2" style={{ marginTop:8 }}>
            {addable && <button className={'btn btn--sm '+(added?'btn--secondary':'btn--primary')} style={{ flex:1 }} onClick={toggleAdd}>{added? '✓ Ajouté au voyage' : '+ Ajouter au voyage'}</button>}
            {o.bookUrl && <a className="btn btn--secondary btn--sm" href={o.bookUrl} target="_blank" rel="noopener" style={{ textDecoration:'none' }}><Icon n="arrowRight" size={15} /> Horaires</a>}
          </div>
        </div>
      )}
    </div>
  );
}

/* Un segment (départ OU arrivée) avec saisie d'adresse + options. */
function ItinSegment({ direction, fixedPoint, pax, addable=true, defaultAddrKey }){
  // direction: 'to' (domicile→hub) | 'from' (hub→hôtel)
  const [addr, setAddr] = React.useState(()=>{ try{ return localStorage.getItem(defaultAddrKey||('tf_addr_'+direction))||''; }catch(e){ return ''; } });
  const [opts, setOpts] = React.useState(null);
  const [state, setState] = React.useState('idle');
  const title = direction==='to' ? `Rejoindre ${fixedPoint}` : `De ${fixedPoint} à votre hébergement`;
  const ph = direction==='to' ? 'Votre adresse de départ' : 'Adresse / hôtel d\'arrivée';
  const segKey = (direction==='to'?'to:':'from:')+fixedPoint;
  async function go(){
    if(addr.trim().length<3) return;
    try{ localStorage.setItem(defaultAddrKey||('tf_addr_'+direction), addr.trim()); }catch(e){}
    setState('loading'); setOpts(null);
    try{
      const B=window.WebbinaBackend; let r=null;
      const o={ family:(pax||1)>=3, pax:pax||1 };
      if(direction==='to' && B && B.itineraryToHub) r = await B.itineraryToHub(addr.trim(), fixedPoint, o);
      if(direction==='from' && B && B.itineraryFromHub) r = await B.itineraryFromHub(fixedPoint, addr.trim(), o);
      if(r && r.options && r.options.length){ setOpts(r.options); setState('done'); } else setState('error');
    }catch(e){ setState('error'); }
  }
  return (
    <div className="card card--pad" style={{ marginTop:12 }}>
      <div className="row gap2" style={{ alignItems:'center' }}>
        <div className="mem-ic"><Icon n="route" size={18} /></div>
        <div style={{ flex:1 }}><b style={{ fontFamily:'var(--font-display)', fontSize:14.5 }}>{title}</b><div className="micro">Trajet détaillé, comme une carte</div></div>
      </div>
      <div className="row gap2" style={{ marginTop:10 }}>
        <input className="watch-in date" style={{ flex:1 }} placeholder={ph} value={addr} onChange={e=>setAddr(e.target.value)} onKeyDown={e=>e.key==='Enter'&&go()} />
        <button className="btn btn--primary btn--sm" disabled={state==='loading'||addr.trim().length<3} onClick={go}>{state==='loading'?'…':'Calculer'}</button>
      </div>
      {state==='error' && <div className="micro" style={{ marginTop:8, color:'var(--text-muted)' }}>Itinéraire indisponible — vérifiez l'adresse, ou réessayez.</div>}
      {state==='done' && opts && (
        <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:8 }}>
          {opts.map(o=><ItinOptionRow key={o.id} o={o} segKey={segKey} addable={addable} />)}
          <div className="micro" style={{ color:'var(--text-muted)', lineHeight:1.5 }}>Durées en temps réel (Google). Prix bus/covoiturage/parking/transfert estimés — confirmés chez le prestataire.</div>
        </div>
      )}
    </div>
  );
}

/* Itinéraire complet (départ + arrivée) — pour la phase de recherche. */
function FullItinerary({ departHub, arriveHub, pax }){
  return (
    <div>
      <div className="micro sec-cap" style={{ marginTop:4 }}>Trajet porte-à-porte</div>
      <ItinSegment direction="to" fixedPoint={departHub||'votre aéroport de départ'} pax={pax} defaultAddrKey="tf_home_addr" />
      {arriveHub && <ItinSegment direction="from" fixedPoint={arriveHub} pax={pax} defaultAddrKey="tf_dest_addr" />}
    </div>
  );
}

/* Petit récap des trajets ajoutés (utilisé dans le tunnel de réservation). */
function ItinCartSummary(){
  const [legs, setLegs] = React.useState(()=>window.tfItin.list());
  React.useEffect(()=>{ const f=()=>setLegs(window.tfItin.list()); window.addEventListener('tf-itin-change', f); return ()=>window.removeEventListener('tf-itin-change', f); }, []);
  if(!legs.length) return null;
  return (
    <div className="card card--pad" style={{ marginTop:12 }}>
      <h4 style={{ fontSize:14, marginBottom:8 }}>Trajets ajoutés à votre voyage</h4>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {legs.map(l=>(
          <div key={l.key} className="row between" style={{ fontSize:13 }}>
            <span className="row gap2" style={{ alignItems:'center' }}><Icon n={ITIN_MODE_IC[l.mode]||'route'} size={14} /> {l.label}</span>
            <span style={{ display:'flex', gap:8, alignItems:'center' }}><b style={{ fontFamily:'var(--font-display)' }}>~{l.cost} €</b><button className="icon-btn" onClick={()=>window.tfItin.remove(l.key)} aria-label="Retirer"><Icon n="x" size={14} /></button></span>
          </div>
        ))}
      </div>
      <div className="micro" style={{ color:'var(--text-muted)', marginTop:8, lineHeight:1.45 }}>Estimations ajoutées au total — la réservation des bus/covoiturage/transferts se finalise chez le prestataire (intégration directe à venir).</div>
    </div>
  );
}

Object.assign(window, { DoorToHub: ItinSegment, ItinSegment, FullItinerary, ItinCartSummary });
