/* TravelFamily.AI — "Sur place" : Activités (réel · Google Places) +
   Location de voiture, Train, Bateau/Ferry, Camping (UI premium, architecture
   prête à brancher). Webbina recommande dans chaque univers. */

/* Sample (clearly-labelled) data for the not-yet-connected transport universes. */
const SURPLACE_UNIVERSES = [
  { id:'voiture', icon:'car', label:'Location de voiture', color:'ocean',
    reco:"Pour une famille, je conseille un SUV automatique avec sièges enfants — plus de place pour les bagages et les poussettes. 🚗",
    providers:['Hertz','Avis','Sixt','Europcar'],
    samples:[
      { t:'SUV familial automatique', s:'5 places · clim · 2 sièges enfants inclus', p:'42 €/j', badge:'Idéal famille' },
      { t:'Monospace 7 places', s:'Grand coffre · GPS · annulation gratuite', p:'58 €/j', badge:null },
      { t:'Citadine économique', s:'Parfaite en ville · faible conso', p:'29 €/j', badge:'Petit budget' },
    ] },
  { id:'train', icon:'train', label:'Train', color:'turq',
    reco:"Le train, c'est zéro stress avec les enfants : ils peuvent bouger, et vous voyagez sans embouteillages. Je vise les places carré famille. 🚆",
    providers:['SNCF','Trainline','Rail Europe','Eurostail'],
    samples:[
      { t:'Place carré famille', s:'4 places face à face + tablette', p:'dès 39 €', badge:'Confort famille' },
      { t:'1re classe enfant offert', s:'Calme · prises · grandes fenêtres', p:'dès 65 €', badge:null },
      { t:'Billet flexible', s:'Échangeable · remboursable', p:'dès 49 €', badge:'Souplesse' },
    ] },
  { id:'bateau', icon:'anchor', label:'Bateau / Ferry', color:'ocean',
    reco:"Une traversée en ferry devient une aventure pour les enfants ! Je privilégie les cabines familiales sur les trajets de nuit. ⛵",
    providers:['Corsica','Brittany Ferries','DFDS','GNV'],
    samples:[
      { t:'Cabine famille 4 couchages', s:'Pont avec aire de jeux · animaux acceptés', p:'dès 120 €', badge:'Confort nuit' },
      { t:'Traversée journée + voiture', s:'Véhicule inclus · restaurant à bord', p:'dès 89 €', badge:null },
      { t:'Ferry rapide', s:'Trajet court · idéal jeunes enfants', p:'dès 54 €', badge:'Rapide' },
    ] },
];

/* Generic real Google-Places section (used for Activities + Insolite lodging). */
function PlacesSection({ dest, icon, color, title, query, radiusKm, reco, fallback, fallbackIcon }) {
  const [state, setState] = React.useState('idle'); // idle|loading|live|fallback
  const [items, setItems] = React.useState([]);
  const [note, setNote] = React.useState(null);

  React.useEffect(()=>{
    let cancelled=false;
    const lat=dest&&dest.lat, lng=dest&&dest.lng;
    if(!window.WebbinaBackend || !window.WebbinaBackend.searchActivities){ setState('fallback'); return; }
    (async()=>{
      const live=await window.WebbinaBackend.isLive();
      if(!live){ if(!cancelled){ setState('fallback'); setNote('Hors-ligne — exemples affichés.'); } return; }
      setState('loading');
      try{
        const q=query+' '+(dest&&dest.name||'');
        const res=await window.WebbinaBackend.searchActivities(q, lat, lng, radiusKm||25);
        if(cancelled) return;
        const list=(res||[]).filter(p=>p.rating).slice(0,6);
        if(list.length){ setItems(list); setState('live'); }
        else { setState('fallback'); setNote('Aucun résultat trouvé — exemples affichés.'); }
      }catch(e){ if(!cancelled){ setState('fallback'); setNote('Recherche indisponible — exemples affichés.'); } }
    })();
    return ()=>{ cancelled=true; };
  }, [dest&&dest.id]);

  const data = state==='live'? items : fallback;

  return (
    <div className="universe-block">
      <div className="uni-head">
        <div className={`uni-ic u-${color}`}><Icon n={icon} size={20} /></div>
        <div style={{ flex:1 }}>
          <b className="uni-title">{title}</b>
          {state==='live'
            ? <span className="uni-live"><Icon n="check" size={12} /> Réel · Google</span>
            : <span className="micro">Idées pour la famille</span>}
        </div>
      </div>
      <WebbinaReco>{reco}</WebbinaReco>
      {state==='loading' && <div className="micro" style={{ padding:'4px 2px' }}>Je cherche sur place… ✨</div>}
      {note && <div className="micro" style={{ color:'var(--text-muted)', padding:'0 2px 4px' }}>{note}</div>}
      <div className="uni-scroll">
        {data.map((p,i)=>(
          <div key={p.id||i} className="act-card">
            <div className="act-photo" style={ p.photoUrl?{ backgroundImage:`url(${p.photoUrl})` }:{ background:'var(--grad-sky)' } }>
              {!p.photoUrl && <Icon n={fallbackIcon||'compass'} size={26} style={{ color:'#fff', opacity:.9 }} />}
              {i===0 && <span className="act-reco"><Icon n="sparkles" size={10} />Coup de cœur</span>}
            </div>
            <div className="act-body">
              <b className="act-name">{p.name}</b>
              <div className="micro act-addr">{p.address||''}</div>
              <div className="row gap2" style={{ marginTop:6, alignItems:'center' }}>
                <span className="rating-pill">{String(p.rating).replace('.',',')}</span>
                {p.userRatingsTotal? <span className="micro">{p.userRatingsTotal.toLocaleString('fr-FR')} avis</span>:null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivitiesSection({ dest }) {
  return (
    <PlacesSection
      dest={dest} icon="sparkles" color="gold" title="Activités" fallbackIcon="compass"
      query="activités en famille à" radiusKm={25}
      reco={`À ${dest&&dest.name||'destination'}, pour vos enfants je suggère de mélanger une activité nature et une sortie ludique — je garde un rythme doux entre deux. ✨`}
      fallback={[
        { id:'a1', name:'Parc aquatique familial', address:'Activité phare · dès 3 ans', rating:4.7, userRatingsTotal:2140 },
        { id:'a2', name:'Réserve naturelle & sentiers', address:'Balade poussette possible', rating:4.6, userRatingsTotal:980 },
        { id:'a3', name:'Musée interactif enfants', address:'Ateliers ludiques', rating:4.5, userRatingsTotal:640 },
      ]}
    />
  );
}

function InsoliteSection({ dest }) {
  return (
    <PlacesSection
      dest={dest} icon="tent" color="coral" title="Hébergements insolites & camping" fallbackIcon="tent"
      query="camping cabane maison d'hôtes insolite à" radiusKm={40}
      reco={`Pour une nuit qui sort de l'ordinaire à ${dest&&dest.name||'destination'} — cabane, écolodge, maison d'hôtes ou camping avec club enfants. Les enfants adorent, et vous aussi ! 🏕️`}
      fallback={[
        { id:'i1', name:'Camping familial avec piscine', address:'Mobil-home · club enfants', rating:4.6, userRatingsTotal:1320 },
        { id:'i2', name:'Cabane perchée dans les arbres', address:'Expérience insolite · au calme', rating:4.8, userRatingsTotal:540 },
        { id:'i3', name:"Maison d'hôtes de charme", address:'Petit-déjeuner maison · familial', rating:4.7, userRatingsTotal:410 },
      ]}
    />
  );
}

function WebbinaReco({ children }) {
  return (
    <div className="webbina-reco">
      <Avatar size={28} expr="enthusiastic" />
      <div className="micro" style={{ lineHeight:1.5, color:'var(--text-2)' }}>{children}</div>
    </div>
  );
}

function UniverseSection({ u }) {
  return (
    <div className="universe-block">
      <div className="uni-head">
        <div className={`uni-ic u-${u.color}`}><Icon n={u.icon} size={20} /></div>
        <div style={{ flex:1 }}>
          <b className="uni-title">{u.label}</b>
          <span className="uni-soon">Bientôt réservable</span>
        </div>
      </div>
      <WebbinaReco>{u.reco}</WebbinaReco>
      <div className="uni-scroll">
        {u.samples.map((s,i)=>(
          <div key={i} className="uni-card">
            <div className={`uni-card-top u-${u.color}`}><Icon n={u.icon} size={22} />{s.badge && <span className="uni-badge">{s.badge}</span>}</div>
            <div className="uni-card-body">
              <b className="act-name">{s.t}</b>
              <div className="micro act-addr">{s.s}</div>
              <div className="row between" style={{ marginTop:8, alignItems:'center' }}>
                <b style={{ fontFamily:'var(--font-display)', fontSize:15 }}>{s.p}</b>
                <span className="uni-cta">Voir</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="uni-providers">
        <span className="micro">Partenaires à venir :</span>
        {u.providers.map(p=><span key={p} className="uni-prov">{p}</span>)}
      </div>
    </div>
  );
}

function SurPlaceTab({ dest }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18, paddingBottom:8 }}>
      <div className="ai-note" style={{ background:'var(--surface)', border:'1px solid var(--border)', boxShadow:'var(--sh-sm)' }}>
        <Avatar size={36} expr="happy" />
        <div className="micro" style={{ color:'var(--text-2)', lineHeight:1.5 }}>Tout ce qu'il vous faut sur place, au même endroit. Je vous recommande les meilleures options pour voyager en famille. 💙</div>
      </div>
      <ActivitiesSection dest={dest} />
      <InsoliteSection dest={dest} />
      {SURPLACE_UNIVERSES.map(u=><UniverseSection key={u.id} u={u} />)}
    </div>
  );
}

function PackageCard({ dest, book }) {
  const [state, setState] = React.useState('idle'); // idle|loading|ready|error
  const [pkg, setPkg] = React.useState(null);
  const initKids = dest._kids!=null ? dest._kids : 0;
  const initPax = dest._pax || 2;
  const [adults, setAdults] = React.useState(Math.max(1, initPax-initKids));
  const [children, setChildren] = React.useState(Math.max(0, initKids));
  const [nights, setNights] = React.useState(dest.nights||7);
  const budget = dest._budget || null;

  async function build(){
    if(!window.WebbinaBackend || !window.WebbinaBackend.buildPackage){ setState('error'); return; }
    setState('loading');
    try{
      const dep=new Date(); dep.setDate(dep.getDate()+42);
      const ret=new Date(dep); ret.setDate(ret.getDate()+nights);
      const dd = dest._dealDates || {};
      const p = await window.WebbinaBackend.buildPackage({
        origin: dest._dealOrigin||'CDG', destinationIata:dest.iata||'DPS', destinationName:dest.name,
        lat:dest.lat, lng:dest.lng,
        departureDate: dd.dep || dep.toISOString().slice(0,10),
        returnDate: dd.ret || ret.toISOString().slice(0,10),
        adults: Math.max(1, adults), children: Math.max(0, children),
        budget: budget||undefined,
      });
      setPkg(p); setState('ready');
    }catch(e){ setState('error'); }
  }

  const f = pkg&&pkg.pricing;
  return (
    <div className="card card--pad pkg-card">
      <div className="row gap2" style={{ alignItems:'center', marginBottom:10 }}>
        <div className="pkg-ic"><Icon n="sparkles" size={18} /></div>
        <div style={{ flex:1 }}>
          <b style={{ fontFamily:'var(--font-display)', fontSize:16 }}>Séjour clé en main</b>
          <div className="micro">Vol + hébergement + activités, assemblés par Webbina</div>
        </div>
      </div>

      {state==='idle' && (
        <React.Fragment>
          <WebbinaReco>{`Laissez-moi tout organiser pour ${dest.name} : je combine le vol, l'hébergement et les activités en un seul séjour, dans votre budget. ✨`}</WebbinaReco>
          <div className="pkg-pax">
            <div className="pkg-pax-row">
              <span>Adultes</span>
              <div className="pkg-step">
                <button type="button" onClick={()=>setAdults(a=>Math.max(1,a-1))} aria-label="Moins d'adultes">−</button>
                <b>{adults}</b>
                <button type="button" onClick={()=>setAdults(a=>Math.min(9,a+1))} aria-label="Plus d'adultes">+</button>
              </div>
            </div>
            <div className="pkg-pax-row">
              <span>Enfants</span>
              <div className="pkg-step">
                <button type="button" onClick={()=>setChildren(c=>Math.max(0,c-1))} aria-label="Moins d'enfants">−</button>
                <b>{children}</b>
                <button type="button" onClick={()=>setChildren(c=>Math.min(9,c+1))} aria-label="Plus d'enfants">+</button>
              </div>
            </div>
            <div className="pkg-pax-row">
              <span>Nuits</span>
              <div className="pkg-step">
                <button type="button" onClick={()=>setNights(n=>Math.max(1,n-1))} aria-label="Moins de nuits">−</button>
                <b>{nights}</b>
                <button type="button" onClick={()=>setNights(n=>Math.min(30,n+1))} aria-label="Plus de nuits">+</button>
              </div>
            </div>
          </div>
          <button className="btn btn--primary btn--block" style={{ marginTop:12 }} onClick={build}>
            Composer mon séjour · {adults+children} voyageur{adults+children>1?'s':''} <Icon n="sparkles" size={17} />
          </button>
        </React.Fragment>
      )}

      {state==='loading' && <div className="micro" style={{ padding:'6px 2px' }}>J'assemble votre séjour idéal… ✈️ 🏨 🎟️</div>}
      {state==='error' && <div className="micro" style={{ color:'var(--text-muted)' }}>Je n'arrive pas à composer le séjour là tout de suite. Réessayez dans un instant.</div>}

      {state==='ready' && pkg && (
        <React.Fragment>
          <div className="pkg-lines">
            <div className="pkg-line">
              <span className="pkg-lic"><Icon n="plane" size={15} /></span>
              <div style={{ flex:1 }}><b>Vol aller-retour</b><div className="micro">{pkg.flight.source==='duffel-live'?(pkg.flight.stops===0?'Direct':pkg.flight.stops+' escale(s)')+' · prix réel':'Indisponible'}</div></div>
              <b>{pkg.flight.total? pkg.flight.total.toLocaleString('fr-FR')+' €':'—'}</b>
            </div>
            <div className="pkg-line">
              <span className="pkg-lic"><Icon n="bed" size={15} /></span>
              <div style={{ flex:1 }}><b>Hébergement · {pkg.hotel.nights} nuits</b><div className="micro">{pkg.hotel.estimated?'Estimation — confirmé à la réservation':'Tarif net'}</div></div>
              <b>{pkg.hotel.total.toLocaleString('fr-FR')} €</b>
            </div>
            <div className="pkg-line">
              <span className="pkg-lic"><Icon n="compass" size={15} /></span>
              <div style={{ flex:1 }}><b>Activités famille</b><div className="micro">{pkg.activities.items.length? pkg.activities.items.map(a=>a.name).slice(0,2).join(', '):'À la carte'}</div></div>
              <b>{pkg.activities.total.toLocaleString('fr-FR')} €</b>
            </div>
          </div>
          <div className="pkg-total">
            <div className="row between"><span className="micro">{pkg.pricing.feeLabel}</span><span>{pkg.pricing.fee.toLocaleString('fr-FR')} €</span></div>
            <div className="row between" style={{ marginTop:6 }}><b style={{ fontFamily:'var(--font-display)', fontSize:17 }}>Total séjour</b><b style={{ fontFamily:'var(--font-display)', fontSize:20 }}>{pkg.pricing.total.toLocaleString('fr-FR')} €</b></div>
            <div className="micro" style={{ marginTop:2 }}>pour {pkg.travelers} voyageurs · {pkg.nights} nuits</div>
          </div>
          {pkg.budget!=null && (
            pkg.withinBudget
              ? <div className="micro pkg-budget ok"><Icon n="check" size={13} /> Dans votre budget — il reste ≈ {pkg.remaining.toLocaleString('fr-FR')} €</div>
              : <div className="micro pkg-budget over"><Icon n="info" size={13} /> ≈ {Math.abs(pkg.remaining).toLocaleString('fr-FR')} € au-dessus du budget. Je peux raccourcir le séjour ou changer de dates.</div>
          )}
          <div className="micro" style={{ marginTop:8, color:'var(--text-muted)', lineHeight:1.4 }}>
            <Icon n="info" size={11} /> Vol et activités en prix réels. Hébergement estimé tant que notre partenaire hôtelier n'est pas connecté — le prix final sera confirmé avant paiement.
          </div>
          {book && pkg.flight.total>0 && (
            <button className="btn btn--primary btn--block" style={{ marginTop:12 }}
              onClick={()=>book({ dest, package:pkg, flight:{ airline:'Séjour '+dest.name, code:'★', price:Math.round(pkg.pricing.total/pkg.travelers), via:pkg.nights+' nuits', dur:'Vol + hôtel + activités' } })}>
              Réserver ce séjour <Icon n="arrowRight" size={17} />
            </button>
          )}
        </React.Fragment>
      )}
    </div>
  );
}

Object.assign(window, { SurPlaceTab, ActivitiesSection, InsoliteSection, PlacesSection, UniverseSection, WebbinaReco, PackageCard });
