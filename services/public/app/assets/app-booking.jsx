/* TravelFamily.AI — Tunnel de réservation (paiement RÉEL via Stripe, ou test simulé).
   3 étapes : Récap → Paiement → Confirmation.
   - Commission Webbina transparente, calculée par le backend (/api/booking/quote).
   - Paiement DANS l'app : Stripe Payment Element + confirmPayment(redirect:'if_required')
     → la carte ne touche jamais notre serveur, et l'utilisateur ne quitte jamais l'app.
   - Si Stripe n'est pas encore configuré : repli simulation (carte test 4242…). */

function fmtPrice(n){ return Math.round(n).toLocaleString('fr-FR'); }

/* Conditions du billet, formulées honnêtement à partir des données Duffel. */
function condText(flight){
  const c = flight && flight.conditions;
  if(c){
    const chg = c.changeable ? ('modifiable'+(c.changePenalty?` (frais ~${Math.round(c.changePenalty)} ${c.currency==='EUR'||!c.currency?'€':c.currency})`:' sans frais')) : 'non modifiable';
    const rfd = c.refundable ? ('remboursable'+(c.refundPenalty?` (frais ~${Math.round(c.refundPenalty)} ${c.currency==='EUR'||!c.currency?'€':c.currency})`:'')) : 'non remboursable';
    return `Billet ${chg}, ${rfd}. Selon les conditions de la compagnie.`;
  }
  return 'Conditions de modification et d\'annulation selon le tarif et la compagnie. À vérifier avant tout changement — des frais peuvent s\'appliquer.';
}

function BookingScreen({ booking, go }) {
  const b = booking || {};
  const dest = b.dest || {};
  const flight = b.flight || {};
  const [step, setStep] = React.useState(0);
  const [travelers, setTravelers] = React.useState(null);
  const [paying, setPaying] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [quote, setQuote] = React.useState(null);     // {base, fee, total, label, currency}
  const [payEnabled, setPayEnabled] = React.useState(false);
  const [ref, setRef] = React.useState('');
  const [paxIds, setPaxIds] = React.useState([]);
  const [savedPax, setSavedPax] = React.useState([]);

  // Saved passports/travelers → reliable autofill (no typos).
  React.useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try{
        const out=[];
        if(window.WebbinaBackend && window.WebbinaBackend.passports){
          const ps = await window.WebbinaBackend.passports();
          (ps||[]).forEach(p=>{ if(p){ const parts=String(p.holder||p.fullName||'').trim().split(' '); out.push({ givenName:parts.slice(0,-1).join(' ')||parts[0]||'', familyName:parts.slice(-1)[0]||'', bornOn:p.birthdate||p.bornOn||'', gender:p.gender||'' }); } });
        }
        if(!out.length && window.WebbinaBackend && window.WebbinaBackend.travelers){
          const ts = await window.WebbinaBackend.travelers();
          (ts||[]).forEach(t=>{ if(t){ const parts=String(t.fullName||'').trim().split(' '); out.push({ givenName:parts.slice(0,-1).join(' ')||parts[0]||'', familyName:parts.slice(-1)[0]||'', bornOn:t.birthdate||'', gender:'' }); } });
        }
        if(!cancelled) setSavedPax(out);
      }catch(e){}
    })();
    return ()=>{ cancelled=true; };
  }, []);

  // Stripe Elements refs
  const stripeRef = React.useRef(null);
  const elementsRef = React.useRef(null);
  const mountRef = React.useRef(null);
  const [stripeReady, setStripeReady] = React.useState(false);

  // saved travelers from memory (fallback to a default party of 4)
  React.useEffect(()=>{
    let cancelled=false;
    (async()=>{
      let list=null;
      if(window.WebbinaBackend && window.WebbinaBackend.travelers){ list = await window.WebbinaBackend.travelers(); }
      if(cancelled) return;
      if(list && list.length){ setTravelers(list.map(t=>({ name:t.fullName, sub:t.relation||'' }))); }
      else setTravelers([
        { name:'Vous', sub:'Adulte' }, { name:'Conjoint·e', sub:'Adulte' },
        { name:'Enfant 1', sub:'Enfant' }, { name:'Enfant 2', sub:'Enfant' },
      ]);
    })();
    return ()=>{ cancelled=true; };
  }, []);

  // editable party size — starts from memory/booking, fully adjustable
  const [adults, setAdults] = React.useState(null);
  const [children, setChildren] = React.useState(null);
  React.useEffect(()=>{
    if(adults!==null) return;
    if(travelers===null) return;
    const ad=(travelers||[]).filter(t=>!/enfant|child|bébé|kid/i.test((t.sub||'')+(t.name||''))).length;
    const ch=(travelers||[]).length-ad;
    setAdults(Math.max(1, ad||2)); setChildren(Math.max(0, ch|| (b.package&&b.package.travelers?Math.max(0,b.package.travelers-2):2)));
  }, [travelers]);
  const pax = (adults||0)+(children||0) || (travelers||[]).length || 4;
  const unit = flight.price || 0;
  const base = unit * pax;

  // transparent quote from backend (fallback to local estimate)
  React.useEffect(()=>{
    let cancelled=false;
    if(!base) return;
    (async()=>{
      let q=null;
      if(window.WebbinaBackend && window.WebbinaBackend.quote){ q = await window.WebbinaBackend.quote('flight', base, pax); }
      if(cancelled) return;
      if(q) setQuote(q);
      else setQuote({ base, fee: Math.round(9*pax), total: base + 9*pax, label:'Frais de service Webbina (9 €/voyageur)', currency:'EUR' });
      if(window.WebbinaBackend && window.WebbinaBackend.config){ const c = await window.WebbinaBackend.config(); if(!cancelled) setPayEnabled(!!(c&&c.paymentEnabled)); }
    })();
    return ()=>{ cancelled=true; };
  }, [base, pax]);

  const fee = quote ? quote.fee : Math.round(9*pax);
  const total = quote ? quote.total : base + fee;

  // When entering the payment step with real Stripe enabled, mount the Payment Element.
  React.useEffect(()=>{
    if(step!==1 || !payEnabled || !base) return;
    let cancelled=false;
    (async()=>{
      try{
        setErr(null);
        const data = await window.WebbinaBackend.paymentIntent('flight', base, pax, 'Vol '+(dest.name||''));
        if(cancelled) return;
        if(quote && data.breakdown) setQuote(data.breakdown);
        if(!window.Stripe){ setErr('Module de paiement indisponible.'); return; }
        const stripe = window.Stripe(data.publishableKey);
        stripeRef.current = stripe;
        const elements = stripe.elements({ clientSecret: data.clientSecret, appearance:{ theme:'night', variables:{ colorPrimary:'#3B82F6', borderRadius:'12px' } } });
        elementsRef.current = elements;
        const pe = elements.create('payment', { layout:'tabs' });
        // wait for the mount node
        const tryMount=()=>{ if(mountRef.current){ pe.mount(mountRef.current); setStripeReady(true); } else setTimeout(tryMount, 60); };
        tryMount();
      }catch(e){ if(!cancelled) setErr('Impossible d\'initialiser le paiement. Réessayez dans un instant.'); }
    })();
    return ()=>{ cancelled=true; };
  }, [step, payEnabled, base]);

  async function saveTrip(){
    // Best-effort real ticket issuance (Duffel) — never blocks the confirmation.
    let orderRef = '';
    try{
      const offerId = flight.id || flight.offerId;
      const named = (paxIds||[]).filter(p=>p && p.givenName && p.familyName);
      if(offerId && named.length && window.WebbinaBackend && window.WebbinaBackend.createFlightOrder){
        const order = await window.WebbinaBackend.createFlightOrder(offerId, named);
        if(order && order.bookingReference){ orderRef = order.bookingReference; setRef(order.bookingReference); }
        if(order && order.id){ try{ window.__lastOrderId = order.id; }catch(e){} }
      }
    }catch(e){ /* issuance optional in test phase */ }

    // Always keep a local copy so the reservation is visible end-to-end (incl. demo).
    try{
      const rec = {
        id: 'L'+Date.now(), ref: orderRef || ref || ('TF-'+Math.random().toString(36).slice(2,8).toUpperCase()),
        orderId: (window.__lastOrderId||''),
        destination: dest.name||'', country: dest.country||'', img: dest.img||'',
        airline: flight.airline||'', code: flight.code||'', time: flight.time||'', via: flight.via||'', dur: flight.dur||'',
        origin: flight.origin||'', total: total, pax: pax, adults: adults, children: children,
        travelers: (paxIds||[]).map(p=>({ givenName:p.givenName||'', familyName:p.familyName||'', bornOn:p.bornOn||'' })),
        conditions: condText(flight),
        paid: payEnabled, createdAt: Date.now(),
      };
      const arr = JSON.parse(localStorage.getItem('tf_trips_local')||'[]');
      arr.unshift(rec); localStorage.setItem('tf_trips_local', JSON.stringify(arr.slice(0,30)));
    }catch(e){}

    // Confirmation e-mail (no-op if mail not configured on the backend).
    try{
      const api=(window.WEBBINA_API||'').replace(/\/+$/,'');
      const email=(window.WebbinaAuth && window.WebbinaAuth.getEmail && window.WebbinaAuth.getEmail());
      if(api && email){
        const headers=Object.assign({'Content-Type':'application/json'}, (window.webbinaAuthHeaders?window.webbinaAuthHeaders():{}));
        fetch(api+'/api/booking/confirm',{ method:'POST', headers, body:JSON.stringify({
          email, destination:dest.name||'votre destination', ref:(orderRef||ref||''), total:Math.round(total), pax,
          flight:[flight.airline,flight.time,flight.via].filter(Boolean).join(' · '), conditions:condText(flight),
        })}).catch(()=>{});
      }
    }catch(e){}

    try{
      if(window.WebbinaBackend){
        const api=(window.WEBBINA_API||'').replace(/\/+$/,'');
        const id=(window.WebbinaAuth && window.WebbinaAuth.getUserId && window.WebbinaAuth.getUserId());
        if(api && id){
          const headers=Object.assign({'Content-Type':'application/json'}, (window.webbinaAuthHeaders?window.webbinaAuthHeaders():{}));
          await fetch(api+'/api/memory/'+id+'/trips',{ method:'POST', headers, body:JSON.stringify({
            title:'Vol vers '+(dest.name||'destination'), destination:dest.name||'', country:dest.country||'',
            status:'booked', budget:{ amount: total, currency:'EUR' }, travelersCount:pax,
            summary:(flight.airline||'')+' · '+(flight.via||'')+' · '+fmtPrice(unit)+' €/pers'
          })});
        }
      }
    }catch(e){}
  }

  async function payReal(e){
    e && e.preventDefault();
    setErr(null); setPaying(true);
    try{
      const stripe = stripeRef.current, elements = elementsRef.current;
      const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect:'if_required' });
      if(error){ setErr(error.message || 'Le paiement a échoué.'); setPaying(false); return; }
      if(paymentIntent && (paymentIntent.status==='succeeded' || paymentIntent.status==='processing')){
        setRef('TF-'+(paymentIntent.id||'').slice(-6).toUpperCase());
        await saveTrip(); setPaying(false); setStep(2);
      } else { setErr('Paiement non confirmé. Réessayez.'); setPaying(false); }
    }catch(e){ setErr('Une erreur est survenue pendant le paiement.'); setPaying(false); }
  }

  // ---- test-mode (simulation) fallback ----
  const [card, setCard] = React.useState({ num:'', exp:'', cvc:'', name:'' });
  function luhnOK(num){ const s=num.replace(/\s/g,''); if(s.length<13) return false; let sum=0,alt=false; for(let i=s.length-1;i>=0;i--){ let d=+s[i]; if(alt){ d*=2; if(d>9) d-=9; } sum+=d; alt=!alt; } return sum%10===0; }
  const cardValid = luhnOK(card.num) && /^\d{2}\/\d{2}$/.test(card.exp) && card.cvc.length>=3 && card.name.trim().length>2;
  async function paySim(e){
    e && e.preventDefault(); setErr(null);
    if(!cardValid){ setErr('Vérifiez les informations de carte (utilisez 4242 4242 4242 4242 en test).'); return; }
    setPaying(true); await new Promise(r=>setTimeout(r, 1500));
    setRef('TF-'+Math.random().toString(36).slice(2,8).toUpperCase());
    await saveTrip(); setPaying(false); setStep(2);
  }

  return (
    <div className="screen booking">
      <div className="sub-head">
        <button className="icon-btn" onClick={()=> step===0?go('detail',dest):setStep(step-1)} aria-label="Retour"><Icon n="arrowLeft" size={22} /></button>
        <div style={{ flex:1 }}>
          <b style={{ fontFamily:'var(--font-display)', fontSize:17 }}>Réservation</b>
          <div className="micro">{dest.name} · {pax} voyageur{pax>1?'s':''}</div>
        </div>
        <span className="test-badge">{payEnabled?'STRIPE':'MODE TEST'}</span>
      </div>

      <div className="bk-steps">
        {['Récap','Paiement','Confirmé'].map((s,i)=>(
          <div key={s} className={`bk-step ${i<=step?'on':''} ${i<step?'done':''}`}>
            <span className="bk-dot">{i<step?<Icon n="check" size={13} />:i+1}</span><span className="micro">{s}</span>
          </div>
        ))}
      </div>

      <div style={{ padding:'4px 16px 24px' }}>
        {step===0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <WebbinaReco>{`Je vérifie tout une dernière fois avant de réserver pour votre famille. Aucun paiement n'est encore prélevé. 💙`}</WebbinaReco>
            <div className="card card--pad">
              <div className="row gap3" style={{ alignItems:'center' }}>
                <span className="fb-logo">{flight.code||'✈'}</span>
                <div style={{ flex:1 }}>
                  <b style={{ fontFamily:'var(--font-display)', fontSize:15 }}>{flight.airline||'Vol'}</b>
                  <div className="micro">{flight.time||''} · {flight.via||''} · {flight.dur||''}</div>
                </div>
              </div>
            </div>
            <div className="card card--pad">
              <h4 style={{ fontSize:15, marginBottom:4 }}>Voyageurs</h4>
              <div className="micro" style={{ marginBottom:12 }}>Ajustez votre famille — le prix se met à jour automatiquement.</div>
              <div className="row between trav-row">
                <div><b style={{ fontFamily:'var(--font-display)', fontSize:14 }}>Adultes</b><div className="micro">12 ans et plus</div></div>
                <div className="stepper">
                  <button type="button" className="stp-btn" onClick={()=>setAdults(a=>Math.max(1,(a||1)-1))} disabled={(adults||1)<=1} aria-label="Moins d'adultes">−</button>
                  <span className="stp-val">{adults||1}</span>
                  <button type="button" className="stp-btn" onClick={()=>setAdults(a=>Math.min(9,(a||1)+1))} aria-label="Plus d'adultes">+</button>
                </div>
              </div>
              <div className="row between trav-row">
                <div><b style={{ fontFamily:'var(--font-display)', fontSize:14 }}>Enfants</b><div className="micro">0 à 11 ans</div></div>
                <div className="stepper">
                  <button type="button" className="stp-btn" onClick={()=>setChildren(c=>Math.max(0,(c||0)-1))} disabled={(children||0)<=0} aria-label="Moins d'enfants">−</button>
                  <span className="stp-val">{children||0}</span>
                  <button type="button" className="stp-btn" onClick={()=>setChildren(c=>Math.min(9,(c||0)+1))} aria-label="Plus d'enfants">+</button>
                </div>
              </div>
              <div className="micro" style={{ marginTop:10, color:'var(--text-2)' }}><Icon n="users" size={12} /> {pax} voyageur{pax>1?'s':''} au total</div>
            </div>
            {typeof PaxIdentity!=='undefined' && <PaxIdentity count={pax} value={paxIds} onChange={setPaxIds} saved={savedPax} />}
            <div className="card card--pad cond-card">
              <div className="row gap2" style={{ alignItems:'flex-start' }}>
                <Icon n="info" size={16} />
                <div><b style={{ fontFamily:'var(--font-display)', fontSize:13.5 }}>Conditions du billet</b><div className="micro" style={{ marginTop:3, lineHeight:1.5 }}>{condText(flight)} Elles vous sont rappelées dans l'e-mail de confirmation.</div></div>
              </div>
            </div>
            <PriceBlock unit={unit} pax={pax} base={base} fee={fee} total={total} label={quote&&quote.label} />
            <button className="btn btn--primary btn--block" onClick={()=>setStep(1)}>Procéder au paiement <Icon n="arrowRight" size={18} /></button>
          </div>
        )}

        {step===1 && payEnabled && (
          <form style={{ display:'flex', flexDirection:'column', gap:14 }} onSubmit={payReal}>
            <WebbinaReco>{`Dernière étape&nbsp;! Le paiement est sécurisé par Stripe, directement ici — vous ne quittez jamais l'application. 🔒`}</WebbinaReco>
            <div className="card card--pad">
              <div ref={mountRef}></div>
              {!stripeReady && !err && <div className="micro" style={{ color:'var(--text-muted)' }}>Chargement du paiement sécurisé…</div>}
            </div>
            <PriceBlock unit={unit} pax={pax} base={base} fee={fee} total={total} label={quote&&quote.label} />
            {err && <div className="micro" style={{ color:'var(--error)', padding:'2px 4px' }}>{err}</div>}
            <button className="btn btn--primary btn--block" type="submit" disabled={paying || !stripeReady}>
              {paying ? 'Paiement en cours…' : `Payer ${fmtPrice(total)} €`} {!paying && <Icon n="shield" size={18} />}
            </button>
            <div className="micro" style={{ textAlign:'center', color:'var(--text-muted)' }}><Icon n="shield" size={12} /> Paiement chiffré · propulsé par Stripe</div>
          </form>
        )}

        {step===1 && !payEnabled && (
          <form style={{ display:'flex', flexDirection:'column', gap:14 }} onSubmit={paySim}>
            <div className="test-card-note">
              <Icon n="info" size={16} />
              <div className="micro">Mode test — aucun prélèvement réel. Utilisez la carte <b>4242 4242 4242 4242</b>, une date future et n'importe quel CVC.</div>
            </div>
            <div className="card card--pad" style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <label className="bk-field"><span>Numéro de carte</span>
                <input inputMode="numeric" placeholder="4242 4242 4242 4242" value={card.num}
                  onChange={e=>setCard({...card, num:e.target.value.replace(/[^\d ]/g,'').slice(0,19)})} />
              </label>
              <div className="row gap3">
                <label className="bk-field" style={{ flex:1 }}><span>Expiration</span>
                  <input placeholder="MM/AA" value={card.exp} onChange={e=>{ let v=e.target.value.replace(/[^\d]/g,'').slice(0,4); if(v.length>2) v=v.slice(0,2)+'/'+v.slice(2); setCard({...card, exp:v}); }} />
                </label>
                <label className="bk-field" style={{ flex:1 }}><span>CVC</span>
                  <input inputMode="numeric" placeholder="123" value={card.cvc} onChange={e=>setCard({...card, cvc:e.target.value.replace(/[^\d]/g,'').slice(0,4)})} />
                </label>
              </div>
              <label className="bk-field"><span>Nom sur la carte</span>
                <input placeholder="Prénom Nom" value={card.name} onChange={e=>setCard({...card, name:e.target.value})} />
              </label>
            </div>
            <PriceBlock unit={unit} pax={pax} base={base} fee={fee} total={total} label={quote&&quote.label} />
            {err && <div className="micro" style={{ color:'var(--error)', padding:'2px 4px' }}>{err}</div>}
            <button className="btn btn--primary btn--block" type="submit" disabled={paying}>
              {paying ? 'Paiement en cours…' : `Payer ${fmtPrice(total)} € (test)`} {!paying && <Icon n="check" size={18} />}
            </button>
            <div className="micro" style={{ textAlign:'center', color:'var(--text-muted)' }}><Icon n="shield" size={12} /> Paiement sécurisé · propulsé par Stripe (test)</div>
          </form>
        )}

        {step===2 && (
          <div style={{ textAlign:'center', padding:'18px 8px' }}>
            <div className="bk-success"><LivingWebbina expr="enthusiastic" state="speaking" size={120} celebrate /></div>
            <h2 style={{ fontSize:26, marginTop:16 }}>C'est réservé&nbsp;! 🎉</h2>
            <p className="muted" style={{ fontSize:15, marginTop:6, lineHeight:1.5 }}>Votre voyage vers <b>{dest.name}</b> est confirmé pour {pax} voyageurs. Je l'ai ajouté à « Mes voyages ».</p>
            <div className="card card--pad" style={{ marginTop:18, textAlign:'left' }}>
              <div className="row between"><span className="micro">Référence</span><b style={{ fontFamily:'var(--font-mono,monospace)', fontSize:13 }}>{ref||'TF-XXXXXX'}</b></div>
              <div className="row between" style={{ marginTop:8 }}><span className="micro">Total payé{payEnabled?'':' (test)'}</span><b style={{ fontFamily:'var(--font-display)' }}>{fmtPrice(total)} €</b></div>
            </div>
            <button className="btn btn--primary btn--block" style={{ marginTop:18 }} onClick={()=>{ try{ const a=JSON.parse(localStorage.getItem('tf_trips_local')||'[]'); if(a[0]){ go('tripdetail', a[0]); return; } }catch(e){} go('dashboard'); }}>Voir ma réservation <Icon n="arrowRight" size={18} /></button>
            <button className="btn btn--secondary btn--block" style={{ marginTop:10 }} onClick={()=>go('dashboard')}>Mes voyages</button>
          </div>
        )}
      </div>
    </div>
  );
}

function PriceBlock({ unit, pax, base, fee, total, label }) {
  return (
    <div className="card card--pad price-block">
      <div className="row between"><span className="micro">{fmtPrice(unit)} € × {pax} voyageur{pax>1?'s':''}</span><span>{fmtPrice(base)} €</span></div>
      <div className="row between" style={{ marginTop:6 }}><span className="micro">{label||'Frais de service Webbina'}</span><span>{fmtPrice(fee)} €</span></div>
      <div className="row between price-total"><b>Total</b><b>{fmtPrice(total)} €</b></div>
      <div className="micro" style={{ marginTop:8, color:'var(--text-muted)', lineHeight:1.4 }}><Icon n="info" size={11} /> Frais de service transparents, déjà inclus dans ce total. Aucun coût caché.</div>
    </div>
  );
}

Object.assign(window, { BookingScreen, PriceBlock });
