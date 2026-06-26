/* TravelFamily.AI — Identités passagers (saisie + scan passeport MRZ).
   Objectif : zéro faute de frappe sur les noms (cause n°1 de frais de
   modification). Le scan lit la bande MRZ du passeport (déterministe) ; on peut
   aussi remplir manuellement ou choisir un voyageur enregistré. Jamais
   obligatoire — mais un avertissement bien visible rappelle de saisir les noms
   EXACTEMENT comme sur le passeport utilisé pour voyager. */

/* ── Lecteur MRZ (passeport TD3 : 2 lignes de 44 caractères) ───────────────── */
function parseMRZ(raw){
  if(!raw) return null;
  // Garder uniquement A-Z 0-9 < et découper en lignes plausibles (>=30 car.)
  const lines = raw.toUpperCase().replace(/[^A-Z0-9<\n]/g,'').split('\n')
    .map(l=>l.trim()).filter(l=>l.length>=30);
  // Repérer la 1ère ligne (commence par P< ou contient <<) et la 2e (data).
  let l1 = lines.find(l=>/^P[A-Z<]/.test(l) && l.includes('<<'));
  let idx = l1 ? lines.indexOf(l1) : -1;
  let l2 = idx>=0 ? lines[idx+1] : lines.find(l=>/[0-9<]{20,}/.test(l) && l!==l1);
  if(!l1 || !l2) return null;
  const pad = (s)=> (s+'<'.repeat(44)).slice(0,44);
  l1 = pad(l1); l2 = pad(l2);
  // Ligne 1 : P<ISS SURNAME<<GIVEN<NAMES
  const names = l1.slice(5).split('<<');
  const surname = (names[0]||'').replace(/</g,' ').trim();
  const given = (names[1]||'').replace(/</g,' ').trim();
  // Ligne 2 : doc(9) c nat(3) naissance(6) c sexe(1) exp(6) ...
  const nationality = l2.slice(10,13).replace(/</g,'');
  const birth = l2.slice(13,19);          // YYMMDD
  const sex = l2.slice(20,21);
  const exp = l2.slice(21,27);            // YYMMDD
  const yy = (s)=>{ const y=+s.slice(0,2); return (y<=(new Date().getFullYear()%100)+5?2000:1900)+y; };
  const iso = (s)=> /^\d{6}$/.test(s) ? `${yy(s)}-${s.slice(2,4)}-${s.slice(4,6)}` : '';
  return {
    familyName: surname || '', givenName: given || '',
    bornOn: iso(birth), expiresOn: iso(exp),
    gender: sex==='F'?'f':(sex==='M'?'m':''), nationality: nationality||'',
  };
}

/* ── Une carte passager ────────────────────────────────────────────────────── */
function PaxCard({ index, value, onChange, saved }){
  const [scanning, setScanning] = React.useState('');  // '', 'reading', 'error'
  const fileRef = React.useRef(null);
  function set(k,v){ onChange({ ...value, [k]:v }); }

  async function onFile(e){
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    setScanning('reading');
    try{
      if(!window.Tesseract){
        await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://unpkg.com/tesseract.js@5/dist/tesseract.min.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
      }
      const { data } = await window.Tesseract.recognize(f, 'eng', { tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<' });
      const mrz = parseMRZ(data && data.text);
      if(mrz && (mrz.familyName || mrz.givenName)){
        onChange({ ...value, ...mrz, _scanned:true });
        setScanning('');
      } else { setScanning('error'); }
    }catch(err){ setScanning('error'); }
    finally{ if(fileRef.current) fileRef.current.value=''; }
  }

  return (
    <div className="pax-card">
      <div className="row between" style={{ alignItems:'center' }}>
        <b style={{ fontFamily:'var(--font-display)', fontSize:14 }}>Voyageur {index+1}</b>
        <div className="pax-actions">
          {saved && saved.length>0 && (
            <select className="pax-saved" value="" onChange={e=>{ const t=saved[+e.target.value]; if(t) onChange({ ...value, givenName:t.givenName||'', familyName:t.familyName||'', bornOn:t.bornOn||'', gender:t.gender||'' }); }}>
              <option value="">Voyageur enregistré…</option>
              {saved.map((t,i)=><option key={i} value={i}>{(t.givenName||'')+' '+(t.familyName||'')}</option>)}
            </select>
          )}
          <button type="button" className="pax-scan" onClick={()=>fileRef.current && fileRef.current.click()}>
            <Icon n="shield" size={14} /> Scanner
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={onFile} />
        </div>
      </div>
      {scanning==='reading' && <div className="micro pax-scan-state"><Icon n="sparkles" size={12} /> Lecture du passeport…</div>}
      {scanning==='error' && <div className="micro pax-scan-state err">Lecture impossible — réessayez en cadrant bien les 2 lignes du bas, ou saisissez à la main.</div>}
      {value._scanned && scanning==='' && <div className="micro pax-scan-state ok"><Icon n="check" size={12} /> Pré-rempli depuis le passeport — vérifiez ci-dessous.</div>}

      <div className="row gap2" style={{ marginTop:10 }}>
        <label className="pax-field" style={{ flex:1 }}><span>Prénom(s)</span>
          <input value={value.givenName||''} onChange={e=>set('givenName', e.target.value)} placeholder="Comme sur le passeport" />
        </label>
        <label className="pax-field" style={{ flex:1 }}><span>Nom</span>
          <input value={value.familyName||''} onChange={e=>set('familyName', e.target.value)} placeholder="Nom du passeport" />
        </label>
      </div>
      <div className="row gap2" style={{ marginTop:8 }}>
        <label className="pax-field" style={{ flex:1 }}><span>Date de naissance</span>
          <input type="date" value={value.bornOn||''} onChange={e=>set('bornOn', e.target.value)} />
        </label>
        <label className="pax-field" style={{ width:110 }}><span>Sexe</span>
          <select value={value.gender||''} onChange={e=>set('gender', e.target.value)}>
            <option value="">—</option><option value="m">M</option><option value="f">F</option>
          </select>
        </label>
      </div>
    </div>
  );
}

/* ── Section complète (N passagers + avertissement) ────────────────────────── */
function PaxIdentity({ count, value, onChange, saved }){
  const list = value && value.length ? value : Array.from({length:count}, ()=>({}));
  React.useEffect(()=>{
    if(!value || value.length!==count){
      const next = Array.from({length:count}, (_,i)=> (value&&value[i]) || {});
      onChange(next);
    }
  }, [count]);
  function setOne(i, v){ const next=[...list]; next[i]=v; onChange(next); }
  return (
    <div className="card card--pad">
      <h4 style={{ fontSize:15, marginBottom:4 }}>Identités des voyageurs</h4>
      <div className="pax-warn">
        <Icon n="info" size={16} />
        <span>Saisissez le <b>nom et le prénom EXACTEMENT</b> tels qu'inscrits sur le passeport utilisé pour ce voyage — <b>pas de nom marital</b> s'il n'y figure pas. Une erreur entraîne des frais de modification après émission du billet.</span>
      </div>
      <div className="micro" style={{ margin:'4px 0 12px', color:'var(--text-2)' }}>
        Facultatif maintenant — vous pourrez compléter plus tard. Renseigné, cela facilite votre enregistrement en ligne auprès de la compagnie.
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {list.map((p,i)=><PaxCard key={i} index={i} value={p||{}} onChange={v=>setOne(i,v)} saved={saved} />)}
      </div>
    </div>
  );
}

Object.assign(window, { PaxIdentity, PaxCard, parseMRZ });
