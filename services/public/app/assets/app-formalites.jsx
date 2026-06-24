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
        {/* global status */}
        <div className="formal-banner" style={{ borderColor:STATUS_META[F.globalStatus].border, background:STATUS_META[F.globalStatus].bg }}>
          <div className="formal-lights">
            <span className={`fl ${F.globalStatus==='green'?'on':''}`} style={{ background:'var(--success)' }}></span>
            <span className={`fl ${F.globalStatus==='orange'?'on':''}`} style={{ background:'var(--warning)' }}></span>
            <span className={`fl ${F.globalStatus==='red'?'on':''}`} style={{ background:'var(--error)' }}></span>
          </div>
          <div style={{ flex:1 }}>
            <b style={{ fontFamily:'var(--font-display)', fontSize:16, color:STATUS_META[F.globalStatus].fg }}>Presque prêt à partir</b>
            <div className="micro" style={{ color:'var(--text-2)' }}>{F.family} · {counts.red||0} action, {counts.orange||0} à vérifier</div>
          </div>
        </div>

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
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {F.items.map(it=>{
            const m=STATUS_META[it.status]; const isOpen=open===it.id;
            return (
              <div key={it.id} className="formal-item" style={{ borderColor: isOpen? m.border : 'var(--border)' }}>
                <button className="formal-row" onClick={()=>setOpen(isOpen?null:it.id)}>
                  <div className="formal-ic" style={{ background:m.bg, color:m.fg }}><Icon n={it.ic} size={22} /></div>
                  <div style={{ flex:1, textAlign:'left' }}>
                    <b style={{ fontFamily:'var(--font-display)', fontSize:15.5 }}>{it.label}</b>
                    <div className="micro" style={{ color:m.fg, fontWeight:700 }}>{m.label}</div>
                  </div>
                  <StatusDot status={it.status} />
                  <Icon n="chevronDown" size={18} style={{ color:'var(--text-muted)', transform:isOpen?'rotate(180deg)':'none', transition:'transform .2s' }} />
                </button>
                {isOpen && (
                  <div className="formal-detail">
                    <p style={{ fontSize:14, lineHeight:1.55, color:'var(--text-2)' }} dangerouslySetInnerHTML={{__html:it.detail}} />
                    <div style={{ marginTop:8 }}><SpeakBtn text={m.label+'. '+it.detail} /></div>
                    {it.status!=='green' && (
                      <button className={`btn ${it.status==='red'?'btn--accent':'btn--secondary'} btn--block btn--sm`} style={{ marginTop:10 }}>
                        {it.status==='red' ? <><Icon n="edit" size={16} />Générer le document</> : <><Icon n="sparkles" size={16} />Pré-remplir avec Webbina</>}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button className="btn btn--cta btn--block" style={{ marginTop:18 }}><Icon n="download" size={18} />Télécharger mon récap formalités</button>
        <p className="micro" style={{ textAlign:'center', marginTop:12 }}>Sources officielles · France Diplomatie, IATA Travel Centre. Mis à jour aujourd'hui.</p>
      </div>
    </div>
  );
}

Object.assign(window, { FormalitesScreen });
