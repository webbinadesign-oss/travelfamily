/* TravelFamily.AI app — Dashboard, Travel memory, Gamification, Profil */

function DashboardScreen({ go, openChat }) {
  // Real trips aren't persisted yet → show a clean, inviting empty state for a
  // genuine UX test (no fake "Famille Martin / Bali" pre-filled trip).
  const name = (window.WebbinaAuth && window.WebbinaAuth.getEmail && window.WebbinaAuth.getEmail())
    ? window.WebbinaAuth.getEmail().split('@')[0] : null;
  return (
    <div className="screen">
      <div style={{ padding:'16px 18px 0' }}>
        <div className="row between">
          <h2 style={{ fontSize:26 }}>Mes voyages</h2>
          <button className="icon-btn" onClick={()=>go('badges')} aria-label="Récompenses"><Icon n="star" size={22} style={{ color:'var(--gold)' }} /></button>
        </div>
        {name && <div className="micro" style={{ marginTop:2, textTransform:'capitalize' }}>Bonjour {name} 👋</div>}
      </div>

      {/* empty state — no trip yet */}
      <div style={{ padding:'18px' }}>
        <div className="card card--pad" style={{ textAlign:'center' }}>
          <LivingWebbina size={72} state="idle" expr="happy" style={{ margin:'0 auto 6px' }} />
          <h3 style={{ fontSize:19, marginTop:6 }}>Aucun voyage pour l'instant</h3>
          <p className="micro" style={{ marginTop:6, lineHeight:1.5, maxWidth:'34ch', marginInline:'auto' }}>Dites-moi où vous rêvez d'aller, et je compose votre prochain séjour en famille — vols, hébergement et activités, dans votre budget.</p>
          <button className="btn btn--primary btn--block" style={{ marginTop:14 }} onClick={()=> openChat ? openChat('home') : go('chat')}><Icon n="sparkles" size={17} />Planifier avec Webbina</button>
        </div>
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

Object.assign(window, { DashboardScreen, BadgesScreen, ProfilScreen, PremiumScreen });
