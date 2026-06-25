/* TravelFamily.AI app — Formalités (traffic-light engine) */

const STATUS_META = {
  green:  { label:'Conforme',       bg:'var(--success-bg)', fg:'var(--success)', border:'var(--success-border)' },
  orange: { label:'Vigilance',      bg:'var(--warning-bg)', fg:'var(--warning)', border:'var(--warning-border)' },
  red:    { label:'Action requise', bg:'var(--error-bg)',   fg:'var(--error)',   border:'var(--error-border)' },
};

/* Real passport-validity engine (memory-backed). */
function monthsBetween(from, to){ return (to.getFullYear()-from.getFullYear())*12 + (to.getMonth()-from.getMonth()) - (to.getDate()<from.getDate()?1:0); }
function passportStatus(expiresOn){
  if(!expiresOn) return { status:'orange', label:'Date inconnue', detail:'Ajoutez la date d\'expiration pour que je vérifie la validité.' };
  const exp=new Date(expiresOn); const now=new Date();
  if(isNaN(exp.getTime())) return { status:'orange', label:'Date invalide', detail:'La date d\'expiration semble incorrecte.' };
  const m=monthsBetween(now, exp);
  const dstr=exp.toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'});
  if(m<0) return { status:'red', label:'Expiré', detail:`Passeport expiré depuis le ${dstr}. Renouvellement obligatoire avant tout voyage.` };
  if(m<6) return { status:'red', label:'Moins de 6 mois', detail:`Expire le ${dstr}. De nombreux pays exigent une validité d'au moins 6 mois après la date de retour — renouvellement fortement recommandé.` };
  if(m<9) return { status:'orange', label:'Bientôt', detail:`Expire le ${dstr} (dans ~${m} mois). Vérifiez la règle des 6 mois selon votre destination.` };
  return { status:'green', label:'Valide', detail:`Valable jusqu'au ${dstr}. Conforme à la règle des 6 mois.` };
}

function PassportsBlock() {
  const [state, setState] = React.useState('idle'); // idle|loading|live|empty|off
  const [rows, setRows] = React.useState([]);

  React.useEffect(()=>{
    let cancelled=false;
    const B=window.WebbinaBackend;
    if(!B || !B.passports || !(window.WebbinaAuth && window.WebbinaAuth.getUserId && window.WebbinaAuth.getUserId())){ setState('off'); return; }
    setState('loading');
    (async()=>{
      try{
        const [pass, trav] = await Promise.all([B.passports(), B.travelers? B.travelers(): Promise.resolve([])]);
        if(cancelled) return;
        if(pass===null){ setState('off'); return; }
        const list=(pass||[]).map(p=>({ ...p, ...passportStatus(p.expiresOn) }));
        setRows(list);
        setState(list.length? 'live':'empty');
      }catch(e){ if(!cancelled) setState('off'); }
    })();
    return ()=>{ cancelled=true; };
  }, []);

  if(state==='off') return null;

  const worst = rows.reduce((a,r)=> a==='red'||r.status==='red'?'red':(a==='orange'||r.status==='orange'?'orange':'green'), 'green');
  return (
    <div className="card card--pad" style={{ marginBottom:14, borderLeft:'4px solid var(--ocean)' }}>
      <div className="row between" style={{ marginBottom: state==='live'?12:0 }}>
        <div className="row gap2" style={{ alignItems:'center' }}>
          <Icon n="shield" size={18} style={{ color:'var(--ocean)' }} />
          <h4 style={{ fontSize:16 }}>Passeports de votre famille</h4>
        </div>
        {state==='live' && <StatusDot status={worst} />}
      </div>
      {state==='loading' && <div className="micro">Je vérifie la validité de vos passeports… 🛂</div>}
      {state==='empty' && (
        <div className="micro" style={{ color:'var(--text-2)' }}>
          Aucun passeport enregistré pour l'instant. Ajoutez-les depuis votre profil et je vérifierai automatiquement leur validité à chaque voyage.
        </div>
      )}
      {state==='live' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {rows.map((r,i)=>{
            const m=STATUS_META[r.status];
            return (
              <div key={r.id||i} className="row gap3" style={{ alignItems:'flex-start', padding:'10px 12px', borderRadius:'var(--r-md)', background:m.bg, border:'1px solid '+m.border }}>
                <div style={{ width:36, height:36, borderRadius:10, background:'var(--surface)', display:'grid', placeItems:'center', flex:'none' }}>
                  <Icon n="user" size={18} style={{ color:m.fg }} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div className="row between">
                    <b style={{ fontFamily:'var(--font-display)', fontSize:14.5 }}>{r.holderName||'Voyageur'}</b>
                    <span className="micro" style={{ color:m.fg, fontWeight:700 }}>{r.label}</span>
                  </div>
                  <div className="micro" style={{ marginTop:2 }}>{r.nationality||'—'}{r.numberLast4?' · ****'+r.numberLast4:''}</div>
                  <div className="micro" style={{ color:'var(--text-2)', marginTop:4, lineHeight:1.45 }}>{r.detail}</div>
                </div>
              </div>
            );
          })}
          <div className="micro" style={{ color:'var(--success)', marginTop:2 }}><Icon n="check" size={12} /> Vérifié en direct depuis votre mémoire voyage</div>
        </div>
      )}
    </div>
  );
}

function FormalitesScreen({ go }) {
  const F = TF.FORMALITES;
  const [open, setOpen] = React.useState('kids');
  const [famLabel, setFamLabel] = React.useState(null);
  React.useEffect(()=>{
    let cancelled=false;
    const B=window.WebbinaBackend;
    if(B && B.travelers && window.WebbinaAuth && window.WebbinaAuth.getUserId && window.WebbinaAuth.getUserId()){
      (async()=>{ try{ const t=await B.travelers(); if(!cancelled && t && t.length){ setFamLabel(t.length+' voyageur'+(t.length>1?'s':'')+' enregistré'+(t.length>1?'s':'')); } }catch(e){} })();
    }
    return ()=>{ cancelled=true; };
  }, []);
  const counts = F.items.reduce((a,it)=>{ a[it.status]=(a[it.status]||0)+1; return a; }, {});
  return (
    <div className="screen" style={{ paddingBottom:30 }}>
      <div className="sub-head">
        <button className="icon-btn" onClick={()=>go('home')} aria-label="Retour"><Icon n="arrowLeft" size={22} /></button>
        <div style={{ flex:1 }}>
          <b style={{ fontFamily:'var(--font-display)', fontSize:17 }}>Formalités du voyage</b>
          <div className="micro">Passeports, visas, vaccins · vérifiés pour votre famille</div>
        </div>
      </div>

      <div style={{ padding:'16px 16px 0' }}>
        {/* real passport validity (memory-backed) */}
        <PassportsBlock />

        <div className="ai-note" style={{ margin:'14px 0', background:'var(--surface)', border:'1px solid var(--border)', boxShadow:'var(--sh-sm)' }}>
          <Avatar size={36} expr="reassuring" />
          <div className="micro" style={{ color:'var(--text-2)' }}>Je vérifie automatiquement les passeports, visas et vaccins de votre famille selon votre destination. Ajoutez vos voyageurs et je m'occupe du reste. 💪
            <div style={{ marginTop:8 }}><SpeakBtn text="Je vérifie automatiquement les passeports, visas et vaccins de votre famille selon votre destination." /></div>
          </div>
        </div>

        {/* legend */}
        <div className="row gap4 micro" style={{ justifyContent:'center', marginBottom:14 }}>
          <span className="row gap2"><StatusDot status="green" size={10} />Conforme</span>
          <span className="row gap2"><StatusDot status="orange" size={10} />Vigilance</span>
          <span className="row gap2"><StatusDot status="red" size={10} />Action requise</span>
        </div>

        {/* items */}
        <div className="card card--pad" style={{ textAlign:'center', borderStyle:'dashed' }}>
          <div style={{ width:54, height:54, borderRadius:'50%', margin:'2px auto 10px', background:'var(--ocean-50, color-mix(in srgb, var(--ocean) 12%, var(--surface)))', display:'grid', placeItems:'center' }}>
            <Icon n="compass" size={26} style={{ color:'var(--ocean)' }} />
          </div>
          <b style={{ fontFamily:'var(--font-display)', fontSize:16.5, display:'block', marginBottom:6 }}>Aucun voyage sélectionné pour l'instant</b>
          <p className="micro" style={{ color:'var(--text-2)', lineHeight:1.55, maxWidth:320, margin:'0 auto 14px' }}>
            Choisissez une destination et des dates, et je vérifie pour vous les <b>visas, l'ETA/eVisa, les vaccins</b> et la <b>validité des passeports</b> — avec mes feux 🟢🟡🔴.
          </p>
          <button className="btn btn--primary btn--sm" onClick={()=>go('home')}><Icon n="search" size={16} />Trouver ma destination</button>
        </div>

        <p className="micro" style={{ textAlign:'center', marginTop:16 }}>Sources officielles · France Diplomatie, IATA Travel Centre.</p>
      </div>
    </div>
  );
}

Object.assign(window, { FormalitesScreen });

/* ── Passport management (per-user, private) ─────────────────── */
const NATIONALITIES = [
  ['FR','🇫🇷 France'],['BE','🇧🇪 Belgique'],['CH','🇨🇭 Suisse'],['CA','🇨🇦 Canada'],
  ['LU','🇱🇺 Luxembourg'],['GB','🇬🇧 Royaume-Uni'],['DE','🇩🇪 Allemagne'],['ES','🇪🇸 Espagne'],
  ['IT','🇮🇹 Italie'],['PT','🇵🇹 Portugal'],['US','🇺🇸 États-Unis'],['MA','🇲🇦 Maroc'],
  ['DZ','🇩🇿 Algérie'],['TN','🇹🇳 Tunisie'],['SN','🇸🇳 Sénégal'],['CI','🇨🇮 Côte d\'Ivoire'],
];
const NAT_LABEL = Object.fromEntries(NATIONALITIES.map(([c,l])=>[c,l]));

function PassportsScreen({ go }) {
  const loggedIn = !!(window.WebbinaAuth && window.WebbinaAuth.getUserId && window.WebbinaAuth.getUserId());
  const B = window.WebbinaBackend;
  const [rows, setRows] = React.useState([]);
  const [state, setState] = React.useState('loading'); // loading|ready|off
  const [adding, setAdding] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [form, setForm] = React.useState({ holderName:'', nationality:'FR', numberLast4:'', expiresOn:'' });
  const [photo, setPhoto] = React.useState(null);

  const load = React.useCallback(async ()=>{
    if(!loggedIn || !B || !B.passports){ setState('off'); return; }
    setState('loading');
    try{
      const pass = await B.passports();
      if(pass===null){ setState('off'); return; }
      setRows((pass||[]).map(p=>({ ...p, ...passportStatus(p.expiresOn) })));
      setState('ready');
    }catch(e){ setState('ready'); setRows([]); }
  }, [loggedIn]);
  React.useEffect(()=>{ load(); }, [load]);

  function set(k,v){ setForm(f=>({ ...f, [k]:v })); }
  function pickPhoto(e){
    const f=e.target.files && e.target.files[0]; if(!f) return;
    const r=new FileReader(); r.onload=()=>setPhoto(r.result); r.readAsDataURL(f);
  }
  async function submit(){
    setErr('');
    if(!form.holderName.trim()){ setErr('Indiquez le nom du titulaire.'); return; }
    if(!form.expiresOn){ setErr('Indiquez la date d\'expiration.'); return; }
    setBusy(true);
    try{
      await B.addPassport({
        holderName: form.holderName.trim(),
        nationality: form.nationality,
        numberLast4: (form.numberLast4||'').replace(/\D/g,'').slice(-4) || undefined,
        expiresOn: form.expiresOn,
      });
      setForm({ holderName:'', nationality:'FR', numberLast4:'', expiresOn:'' });
      setPhoto(null); setAdding(false);
      await load();
    }catch(e){
      setErr(String(e&&e.message||e)==='no_account' ? 'Connectez-vous pour enregistrer un passeport.' : 'Enregistrement impossible pour le moment. Réessayez.');
    }finally{ setBusy(false); }
  }

  const inputStyle = { width:'100%', padding:'12px 14px', borderRadius:'var(--r-md)', border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:15, fontFamily:'inherit' };

  return (
    <div className="screen" style={{ paddingBottom:30 }}>
      <div className="sub-head">
        <button className="icon-btn" onClick={()=>go('profil')} aria-label="Retour"><Icon n="arrowLeft" size={22} /></button>
        <div style={{ flex:1 }}>
          <b style={{ fontFamily:'var(--font-display)', fontSize:17 }}>Passeports de la famille</b>
          <div className="micro">Privé · visible par vous seul·e</div>
        </div>
      </div>

      <div style={{ padding:'16px 16px 0' }}>
        <div className="ai-note" style={{ marginBottom:14, background:'var(--surface)', border:'1px solid var(--border)', boxShadow:'var(--sh-sm)' }}>
          <Avatar size={36} expr="reassuring" />
          <div className="micro" style={{ color:'var(--text-2)' }}>
            Enregistrez chaque passeport une fois&nbsp;: je vérifie automatiquement sa validité (règle des 6 mois) avant chacun de vos voyages. Vos données restent privées et chiffrées.
          </div>
        </div>

        {state==='off' && (
          <div className="card card--pad" style={{ textAlign:'center' }}>
            <Icon n="shield" size={26} style={{ color:'var(--ocean)' }} />
            <p style={{ fontSize:15, margin:'8px 0 12px', lineHeight:1.5 }}>Connectez-vous pour enregistrer et vérifier les passeports de votre famille en toute sécurité.</p>
            <button className="btn btn--primary btn--block" onClick={()=>go('profil')}>Aller à mon profil</button>
          </div>
        )}

        {state==='loading' && <div className="micro">Chargement de vos passeports… 🛂</div>}

        {state==='ready' && (
          <React.Fragment>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {rows.length===0 && !adding && (
                <div className="micro" style={{ color:'var(--text-2)', padding:'2px 2px 8px' }}>Aucun passeport enregistré pour l'instant.</div>
              )}
              {rows.map((r,i)=>{
                const m=STATUS_META[r.status];
                return (
                  <div key={r.id||i} className="row gap3" style={{ alignItems:'flex-start', padding:'12px', borderRadius:'var(--r-md)', background:m.bg, border:'1px solid '+m.border }}>
                    <div style={{ width:38, height:38, borderRadius:10, background:'var(--surface)', display:'grid', placeItems:'center', flex:'none' }}>
                      <Icon n="user" size={18} style={{ color:m.fg }} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div className="row between"><b style={{ fontFamily:'var(--font-display)', fontSize:15 }}>{r.holderName||'Voyageur'}</b><span className="micro" style={{ color:m.fg, fontWeight:700 }}>{r.label}</span></div>
                      <div className="micro" style={{ marginTop:2 }}>{NAT_LABEL[r.nationality]||r.nationality||'—'}{r.numberLast4?' · ****'+r.numberLast4:''}</div>
                      <div className="micro" style={{ color:'var(--text-2)', marginTop:4, lineHeight:1.45 }}>{r.detail}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {!adding && (
              <button className="btn btn--secondary btn--block" style={{ marginTop:14 }} onClick={()=>{ setAdding(true); setErr(''); }}>
                <Icon n="plus" size={18} />Ajouter un passeport
              </button>
            )}

            {adding && (
              <div className="card card--pad" style={{ marginTop:14, display:'flex', flexDirection:'column', gap:12 }}>
                <div className="row between" style={{ alignItems:'center' }}>
                  <b style={{ fontFamily:'var(--font-display)', fontSize:16 }}>Nouveau passeport</b>
                  <button className="icon-btn" aria-label="Annuler" onClick={()=>{ setAdding(false); setErr(''); setPhoto(null); }}><Icon n="x" size={18} /></button>
                </div>

                <label className="scan-tile">
                  <input type="file" accept="image/*" capture="environment" onChange={pickPhoto} style={{ display:'none' }} />
                  {photo
                    ? <img src={photo} alt="Aperçu passeport" style={{ width:'100%', borderRadius:'var(--r-md)', display:'block' }} />
                    : <div style={{ textAlign:'center', padding:'18px 12px' }}>
                        <Icon n="camera" size={26} style={{ color:'var(--ocean)' }} />
                        <div style={{ fontFamily:'var(--font-display)', fontWeight:600, fontSize:14.5, marginTop:6 }}>Scanner / photographier le passeport</div>
                        <div className="micro" style={{ marginTop:3 }}>Optionnel — vérifiez ensuite les champs ci-dessous.</div>
                      </div>}
                </label>

                <div>
                  <div className="micro" style={{ marginBottom:5, fontWeight:600 }}>Nom du titulaire</div>
                  <input style={inputStyle} value={form.holderName} onChange={e=>set('holderName',e.target.value)} placeholder="Ex. Camille Martin" />
                </div>
                <div className="row gap2">
                  <div style={{ flex:1 }}>
                    <div className="micro" style={{ marginBottom:5, fontWeight:600 }}>Nationalité</div>
                    <select style={inputStyle} value={form.nationality} onChange={e=>set('nationality',e.target.value)}>
                      {NATIONALITIES.map(([c,l])=><option key={c} value={c}>{l}</option>)}
                    </select>
                  </div>
                  <div style={{ width:120 }}>
                    <div className="micro" style={{ marginBottom:5, fontWeight:600 }}>4 derniers chiffres</div>
                    <input style={inputStyle} value={form.numberLast4} onChange={e=>set('numberLast4',e.target.value.replace(/\D/g,'').slice(0,4))} inputMode="numeric" placeholder="••••" />
                  </div>
                </div>
                <div>
                  <div className="micro" style={{ marginBottom:5, fontWeight:600 }}>Date d'expiration</div>
                  <input type="date" style={inputStyle} value={form.expiresOn} onChange={e=>set('expiresOn',e.target.value)} />
                </div>

                {err && <div className="micro" style={{ color:'var(--coral-700)', fontWeight:600 }}>{err}</div>}
                <button className="btn btn--primary btn--block" disabled={busy} onClick={submit}>{busy?'Enregistrement…':'Enregistrer le passeport'}</button>
                <p className="micro" style={{ textAlign:'center', lineHeight:1.45 }}>Nous ne stockons que les 4 derniers chiffres. La photo reste sur votre appareil.</p>
              </div>
            )}
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { PassportsScreen });
