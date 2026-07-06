/* TravelFamily.AI — Grille de prix par dates (type Google Flights).
   Un tableau départ × retour avec les tarifs réels (Travelpayouts) ; l'utilisateur
   fait défiler le mois, voit le moins cher en vert, et choisit la meilleure combinaison. */

function pgFmt(n){ return Math.round(Number(n)||0).toLocaleString('fr-FR'); }
function pgMonthLabel(m){ try{ const [y,mo]=m.split('-'); return new Date(+y,+mo-1,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'}); }catch(e){ return m; } }
function pgAddMonth(m,delta){ const [y,mo]=m.split('-').map(Number); const d=new Date(y,mo-1+delta,1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
function pgDay(iso){ try{ return new Date(iso).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}); }catch(e){ return iso; } }

function PriceGrid({ origin, destination, pax, onPick, month0 }){
  const [month,setMonth]=React.useState(month0 || (()=>{ const d=new Date(); d.setDate(d.getDate()+30); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); })());
  const [data,setData]=React.useState(null);
  const [state,setState]=React.useState('idle');
  async function load(m){
    setState('loading'); setData(null);
    try{
      const r = window.WebbinaBackend && WebbinaBackend.priceGrid ? await WebbinaBackend.priceGrid(origin, destination, m, { pax, returnMonth:m }) : null;
      if(r && r.cells && r.cells.length){ setData(r); setState('done'); } else setState('empty');
    }catch(e){ setState('empty'); }
  }
  React.useEffect(()=>{ load(month); }, [month]);

  // Build axes from cells.
  const grid = React.useMemo(()=>{
    if(!data || !data.cells) return null;
    const deps=[...new Set(data.cells.map(c=>c.depart))].sort();
    const rets=[...new Set(data.cells.map(c=>c.ret).filter(Boolean))].sort();
    const map={}; data.cells.forEach(c=>{ map[c.depart+'|'+c.ret]=c; });
    return { deps, rets, map };
  }, [data]);

  return (
    <div>
      <div className="pg-head">
        <button className="pg-nav" onClick={()=>setMonth(pgAddMonth(month,-1))} aria-label="Mois précédent"><Icon n="chevronRight" size={18} style={{ transform:'rotate(180deg)' }} /></button>
        <b style={{ fontFamily:'var(--font-display)', fontSize:15, textTransform:'capitalize' }}>{pgMonthLabel(month)}</b>
        <button className="pg-nav" onClick={()=>setMonth(pgAddMonth(month,1))} aria-label="Mois suivant"><Icon n="chevronRight" size={18} /></button>
      </div>
      <div className="micro" style={{ textAlign:'center', color:'var(--text-muted)', marginBottom:8 }}>{origin} → {destination} · aller/retour · {pax} voyageur{pax>1?'s':''}</div>

      {state==='loading' && <div className="pg-load"><span className="rt-spin" style={{ borderTopColor:'var(--ocean-700)', borderColor:'var(--border)' }}></span> Webbina scanne les prix du mois…</div>}
      {state==='empty' && <div className="card card--pad"><p className="micro" style={{ margin:0, color:'var(--text-muted)' }}>Pas assez de données pour ce mois. Essayez le mois suivant.</p></div>}

      {state==='done' && grid && grid.rets.length>0 && (
        <div className="pg-wrap">
          <table className="pg-table">
            <thead>
              <tr><th className="pg-corner"><Icon n="plane" size={13} /></th>
                {grid.rets.map(r=><th key={r} className="pg-col"><span>retour</span>{pgDay(r)}</th>)}
              </tr>
            </thead>
            <tbody>
              {grid.deps.map(d=>(
                <tr key={d}>
                  <th className="pg-row"><span>aller</span>{pgDay(d)}</th>
                  {grid.rets.map(r=>{ const c=grid.map[d+'|'+r]; if(!c) return <td key={r} className="pg-cell pg-empty">·</td>;
                    const best=c.price===data.cheapest;
                    return <td key={r} className={'pg-cell'+(best?' pg-best':'')} onClick={()=>onPick&&onPick(c)} title={c.airline}>{pgFmt(c.price)}<span className="pg-eur">€</span></td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {state==='done' && grid && grid.rets.length===0 && (
        <div className="pg-strip">
          {grid.deps.map(d=>{ const c=grid.map[d+'|']; if(!c) return null; const best=c.price===data.cheapest;
            return <button key={d} className={'pg-chip'+(best?' pg-best':'')} onClick={()=>onPick&&onPick(c)}><span>{pgDay(d)}</span><b>{pgFmt(c.price)} €</b></button>;
          })}
        </div>
      )}
      {state==='done' && <div className="micro" style={{ color:'var(--text-muted)', marginTop:8, lineHeight:1.5 }}>🟢 = le moins cher du mois. Tarifs réels constatés à l'instant (non garantis jusqu'à la réservation). Touchez un prix pour le choisir.</div>}
    </div>
  );
}

function PriceGridScreen({ go }){
  const CFG = (typeof window!=='undefined' && window.__TF_PG) || { origin:'MPL', destination:'LIS', pax:2 };
  const [picked,setPicked]=React.useState(null);
  React.useEffect(()=>{ try{ if(window.WebbinaBackend && WebbinaBackend.warm) WebbinaBackend.warm(); }catch(e){} }, []);
  return (
    <div className="screen" style={{ paddingBottom:30 }}>
      <div className="sub-head">
        <button className="icon-btn" onClick={()=>go('roadtrip')} aria-label="Retour"><Icon n="arrowLeft" size={22} /></button>
        <div style={{ flex:1 }}><b style={{ fontFamily:'var(--font-display)', fontSize:17 }}>Grille des prix</b></div>
      </div>
      <div style={{ padding:'14px 16px' }}>
        <div className="card card--pad" style={{ marginBottom:14, background:'var(--ocean-50)', border:'none' }}>
          <div className="row gap2" style={{ alignItems:'center' }}><Avatar size={38} ring expr="focused" /><div><b style={{ fontFamily:'var(--font-display)', fontSize:15 }}>Trouvez les meilleures dates</b><div className="micro" style={{ marginTop:2 }}>Comparez les prix aller/retour sur tout le mois, comme les pros.</div></div></div>
        </div>
        {picked && (
          <div className="card card--pad" style={{ marginBottom:12, borderColor:'var(--success,#15A34A)' }}>
            <div className="row between"><b style={{ fontFamily:'var(--font-display)' }}>Dates choisies</b><span className="micro">{pgDay(picked.depart)}{picked.ret?' → '+pgDay(picked.ret):''}</span></div>
            <div className="row between" style={{ marginTop:6 }}><span className="micro">Prix</span><b style={{ fontFamily:'var(--font-display)' }}>{pgFmt(picked.price)} €</b></div>
            {picked.link && <a className="btn btn--primary btn--block btn--sm" href={picked.link} target="_blank" rel="noopener" style={{ marginTop:10, textDecoration:'none' }}><Icon n="arrowRight" size={15} /> Voir / réserver ce vol</a>}
          </div>
        )}
        <div className="card card--pad">
          <PriceGrid origin={CFG.origin} destination={CFG.destination} pax={CFG.pax||2} onPick={setPicked} />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PriceGrid, PriceGridScreen });
