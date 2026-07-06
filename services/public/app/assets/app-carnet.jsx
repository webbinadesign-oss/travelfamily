/* TravelFamily.AI — Carnet de voyage imprimable.
   Généré après validation/paiement : un livret qualitatif jour par jour, avec
   carte Google (itinéraire), hôtels, budget, formalités, réservations. Bouton
   d'impression → PDF via le navigateur (@media print optimisé dans le CSS). */

function mapUrl(plan){
  const api=(window.WEBBINA_API||'').replace(/\/+$/,'');
  if(!api || !plan || !plan.stops) return null;
  const pts=plan.stops.map(s=>s.city).join('|');
  return api+'/api/map/route.png?points='+encodeURIComponent(pts)+(plan.region?('&region='+encodeURIComponent(plan.region)):'');
}
function cvFmt(n){ return Math.round(Number(n)||0).toLocaleString('fr-FR'); }
function cvHm(min){ const h=Math.floor(min/60), m=Math.round(min%60); return h?`${h}h${m?String(m).padStart(2,'0'):''}`:`${m} min`; }

function CarnetVoyage({ plan, trip, go }){
  const p = plan || (trip && trip.roadtrip) || null;
  const map = p ? mapUrl(p) : null;
  const cur = p && p.budget ? (p.budget.currency==='EUR'?'€':p.budget.currency) : '€';
  const tier = p ? (p.hotelTier || 'confort') : 'confort';
  function doPrint(){ try{ window.print(); }catch(e){} }

  if(!p){
    return (
      <div className="screen" style={{ padding:'20px' }}>
        <div className="sub-head"><button className="icon-btn" onClick={()=>go('dashboard')}><Icon n="arrowLeft" size={22} /></button><b style={{ fontFamily:'var(--font-display)', fontSize:17 }}>Carnet de voyage</b></div>
        <div className="card card--pad" style={{ marginTop:16 }}><p className="micro">Aucun voyage à afficher. Générez un carnet de route puis choisissez un itinéraire.</p></div>
      </div>
    );
  }
  return (
    <div className="screen cv-screen">
      <div className="sub-head cv-noprint">
        <button className="icon-btn" onClick={()=>go(trip?'tripdetail':'roadtrip', trip||undefined)} aria-label="Retour"><Icon n="arrowLeft" size={22} /></button>
        <div style={{ flex:1 }}><b style={{ fontFamily:'var(--font-display)', fontSize:17 }}>Carnet de voyage</b></div>
        <button className="btn btn--primary btn--sm" onClick={doPrint}><Icon n="download" size={15} /> Imprimer / PDF</button>
      </div>

      <div className="cv-sheet">
        {/* Couverture */}
        <div className="cv-cover">
          <div className="cv-brand"><span className="cv-logo">🦁</span> TravelFamily.AI</div>
          <h1 className="cv-title">{p.title}</h1>
          <div className="cv-sub">{p.origin} → {p.region}{p.startDate?` · du ${p.startDate} au ${p.endDate||''}`:''}</div>
          <div className="cv-meta">
            <span>{p.travelers} voyageur{p.travelers>1?'s':''}</span>
            <span>{p.stops.length} étapes</span>
            <span>{p.stops.reduce((s,x)=>s+x.nights,0)} nuits</span>
            {p.drivingTotalKm>0 && <span>{cvFmt(p.drivingTotalKm)} km</span>}
          </div>
          {map && <img className="cv-map" src={map} alt="Itinéraire" crossOrigin="anonymous" onError={e=>{e.target.style.display='none';}} />}
        </div>

        {/* Transport */}
        {(p.flight||p.car) && (
          <div className="cv-block">
            <h2 className="cv-h2">Transport</h2>
            {p.flight && <div className="cv-row"><b>✈️ Vol {p.flight.origin} → {p.flight.arrival}{p.flight.lowcost?' · low-cost':''}</b><span>{p.flight.real?cvFmt(p.flight.price)+' '+cur:'à confirmer'}</span></div>}
            {p.flight && p.flight.note && <div className="cv-note" style={{ marginTop:2 }}>{p.flight.note}</div>}
            {p.access && <div className="cv-row"><b>{p.access.mode==='DRIVE'?'🅿️':'🚌'} Accès aéroport — {p.access.label}</b><span>{p.access.cost?cvFmt(p.access.cost)+' '+cur:'—'}</span></div>}
            {p.car && <div className="cv-row"><b>🚗 Location {p.car.category}</b><span>{p.car.days} j × {p.car.perDay} {cur} = {cvFmt(p.car.total)} {cur}</span></div>}
          </div>
        )}

        {/* Jour par jour */}
        <div className="cv-block">
          <h2 className="cv-h2">Votre itinéraire jour par jour</h2>
          {p.stops.map((s,i)=>(
            <div key={i} className="cv-stop">
              {s.driveFromPrev && <div className="cv-drive">🚗 {s.driveFromPrev.from} → {s.driveFromPrev.to} · {cvHm(s.driveFromPrev.durationMin)} · {cvFmt(s.driveFromPrev.distanceKm)} km</div>}
              <div className="cv-stop-head"><span className="cv-num">{i+1}</span><b>{s.city}</b><span className="cv-nights">{s.nights} nuit{s.nights>1?'s':''}</span></div>
              {s.summary && <p className="cv-summary">{s.summary}</p>}
              {s.days.map((d,j)=>(
                <div key={j} className="cv-day"><b>{d.title}</b><ul>{d.items.map((it,k)=><li key={k}>{it}</li>)}</ul></div>
              ))}
              {s.hotels && s.hotels.length>0 && (()=>{ const h=s.hotels.find(x=>x.tier===tier)||s.hotels[0]; return (
                <div className="cv-hotel">🏨 <b>{h.name}</b> — {cvFmt(h.pricePerNight)} {cur}/nuit <span className="cv-tier">({h.tier})</span></div>
              ); })()}
            </div>
          ))}
        </div>

        {/* Budget */}
        {p.budget && (
          <div className="cv-block cv-avoidbreak">
            <h2 className="cv-h2">Budget du voyage</h2>
            {[['Vols',p.budget.flights],['Location voiture',p.budget.car],['Hôtels',p.budget.hotels],['Carburant',p.budget.fuel],['Péages',p.budget.tolls],['Visites & activités',p.budget.activities]].filter(r=>r[1]>0).map((r,i)=>(
              <div key={i} className="cv-brow"><span>{r[0]}</span><b>{cvFmt(r[1])} {cur}</b></div>
            ))}
            <div className="cv-brow cv-btotal"><span>Total</span><b>{cvFmt(p.budget.total)} {cur}</b></div>
            <div className="cv-note">≈ {cvFmt(p.budget.perPerson)} {cur} / personne. Estimations ; prix réels (vol) confirmés à la réservation.</div>
          </div>
        )}

        {/* Conseils */}
        {p.notes && p.notes.length>0 && (
          <div className="cv-block cv-avoidbreak">
            <h2 className="cv-h2">Les conseils de Webbina 🦁</h2>
            <ul className="cv-tips">{p.notes.map((n,i)=><li key={i}>{n}</li>)}</ul>
          </div>
        )}

        <div className="cv-foot">Bon voyage ! — Webbina, votre conseillère TravelFamily.AI · Vérifiez vos formalités sur diplomatie.gouv.fr avant le départ.</div>
      </div>
    </div>
  );
}

function CarnetScreen({ trip, plan, go }){
  return <CarnetVoyage plan={plan} trip={trip} go={go} />;
}

Object.assign(window, { CarnetVoyage, CarnetScreen });
