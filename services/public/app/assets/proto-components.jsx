/* TravelFamily.AI prototype — shared components + data.  Exports to window. */
const { useState, useEffect, useRef } = React;

/* icon wrapper */
function Icon({ n, size=22, sw=1.75, cls, style }) {
  return <span style={{ display:'inline-flex', alignItems:'center', ...style }}
    dangerouslySetInnerHTML={{ __html: tfIcon(n, { size, sw, cls }) }} />;
}

function Avatar({ size=40, ring=false, style }) {
  return <img src="assets/webbina-circle.png" alt="Webbina"
    style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover',
      boxShadow: ring ? '0 0 0 4px var(--turq-100)' : 'var(--sh-xs)',
      border:'2px solid #fff', flex:'none', ...style }} />;
}

/* ---- data ---- */
const DESTINATIONS = [
  { id:'bali', img:'photo-beach.jpg', name:'Bali, Indonésie', tag:'Plage paradisiaque', meta:[['sun','Soleil garanti'],['plane','13 h de vol']], price:1240, rating:4.9, ribbon:['Coup de cœur','coral'], kid:'Idéal 4–12 ans', desc:'Lagons turquoise, rizières et hôtels pensés pour les familles. Le dépaysement total à un prix doux.' },
  { id:'annecy', img:'photo-mountain.jpg', name:'Annecy, France', tag:'Lac & montagne', meta:[['train','3 h de Paris'],['leaf','Sans avion']], price:680, rating:4.8, ribbon:['Sans avion','turq'], kid:'Tous âges', desc:'Le plus beau lac des Alpes, baignade, vélo et villages perchés. L\'évasion proche, zéro décalage horaire.' },
  { id:'lisbonne', img:'photo-street.jpg', name:'Lisbonne, Portugal', tag:'Ville & océan', meta:[['sun','300 j de soleil'],['plane','2 h 30']], price:540, rating:4.7, ribbon:['Petit budget','gold'], kid:'Dès 3 ans', desc:'Tramways, pâtisseries et plages à 30 min. Une capitale douce et lumineuse, parfaite pour une première escapade.' },
  { id:'sicile', img:'photo-sunset.jpg', name:'Sicile, Italie', tag:'Mer & culture', meta:[['sun','Eaux chaudes'],['plane','2 h 15']], price:790, rating:4.8, ribbon:['Coup de cœur','coral'], kid:'Tous âges', desc:'Plages dorées, volcans et la meilleure cuisine du monde pour les enfants. Le sud dans toute sa chaleur.' },
];

const ACTIVITIES = [
  { img:'photo-kids.jpg', name:'Snorkeling au lagon turquoise', dur:'2 h', age:'dès 6 ans', rating:4.9, tag:['Adapté enfants','success'] },
  { img:'photo-beach.jpg', name:'Cours de surf en famille', dur:'1 h 30', age:'dès 8 ans', rating:4.8, tag:['Encadré','ocean'] },
  { img:'photo-mountain.jpg', name:'Balade à dos d\'éléphant éthique', dur:'3 h', age:'tous âges', rating:4.7, tag:['Nature','turq'] },
];

const PARCOURS = [
  { id:'01', ic:'calendar', c:'ocean', t:'J\'ai mes dates et ma destination', d:'Optimisons votre voyage selon vos critères.' },
  { id:'02', ic:'compass', c:'coral', t:'J\'ai mes dates mais pas la destination', d:'Je vous trouve les meilleures idées.' },
  { id:'03', ic:'wallet', c:'turq', t:'J\'ai une destination, je suis flexible', d:'On cible les meilleures périodes et prix.' },
  { id:'04', ic:'balloon', c:'gold', t:'Fais-moi rêver', d:'Laissez-moi inventer une expérience unique.' },
];

/* ---- small UI ---- */
function Badge({ tone='ocean', icon, children }) {
  return <span className={`badge badge--${tone}`}>{icon && <Icon n={icon} size={13} />}{children}</span>;
}

function Ribbon({ label, tone }) {
  return <span className="ribbon"><Badge tone={tone} icon="star">{label}</Badge></span>;
}

function DestCard({ d, onOpen, fav, onFav, compact }) {
  return (
    <div className="dest-card" onClick={onOpen} style={compact?{}:{}}>
      <div className="photo" style={{ backgroundImage:`url(assets/${d.img})`, aspectRatio: compact?'16/10':'4/3' }}>
        <Ribbon label={d.ribbon[0]} tone={d.ribbon[1]} />
        <button className="fav" onClick={(e)=>{ e.stopPropagation(); onFav&&onFav(d.id); }}
          style={{ color: fav?'#fff':'var(--coral)', background: fav?'var(--coral)':'rgba(255,255,255,.92)' }}>
          <Icon n="heart" size={18} />
        </button>
        <div className="cap"><b style={{ fontFamily:'var(--font-display)', fontSize:19 }}>{d.name}</b></div>
      </div>
      <div className="body">
        <div className="row gap3 micro" style={{ flexWrap:'wrap' }}>
          {d.meta.map(([i,t],k)=><span key={k} className="row gap2" style={{ alignItems:'center' }}><Icon n={i} size={14} />{t}</span>)}
        </div>
        <div className="row between" style={{ marginTop:10 }}>
          <b style={{ fontFamily:'var(--font-display)', fontSize:16 }}>dès {d.price} €<span className="micro" style={{ fontWeight:500 }}> /pers.</span></b>
          <span className="row gap2 micro" style={{ color:'var(--gold-700)', fontWeight:700 }}><Icon n="star" size={14} />{String(d.rating).replace('.',',')}</span>
        </div>
      </div>
    </div>
  );
}

function ParcoursCard({ p, onClick }) {
  return (
    <button className="card card--hover" onClick={onClick}
      style={{ padding:'18px 18px 16px', textAlign:'left', position:'relative', overflow:'hidden', border:'1px solid var(--border)', background:'var(--surface)', cursor:'pointer', width:'100%' }}>
      <div style={{ position:'absolute', top:-12, right:-4, fontFamily:'var(--font-display)', fontWeight:800, fontSize:62, color:`var(--${p.c}-50)`, lineHeight:1 }}>{p.id}</div>
      <div style={{ width:50, height:50, borderRadius:15, background:`var(--${p.c}-50)`, color:`var(--${p.c}-700)`, display:'grid', placeItems:'center', position:'relative' }}><Icon n={p.ic} size={24} /></div>
      <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:16.5, margin:'14px 0 6px', lineHeight:1.2, position:'relative' }}>{p.t}</div>
      <div className="micro" style={{ position:'relative' }}>{p.d}</div>
    </button>
  );
}

/* chat bubbles */
function MsgAI({ children }) {
  return <div className="msg-row"><Avatar size={34} /><div className="bubble bubble--ai">{children}</div></div>;
}
function MsgUser({ children }) {
  return <div className="msg-row msg-row--user"><div className="bubble bubble--user">{children}</div></div>;
}
function MsgSystem({ children }) {
  return <div style={{ textAlign:'center' }}><span className="bubble bubble--system" style={{ display:'inline-block' }}>{children}</span></div>;
}
function Typing() {
  return <div className="msg-row"><Avatar size={34} /><div className="bubble bubble--ai typing" style={{ padding:'12px 16px' }}><span></span><span></span><span></span></div></div>;
}

Object.assign(window, { Icon, Avatar, Badge, Ribbon, DestCard, ParcoursCard, MsgAI, MsgUser, MsgSystem, Typing, DESTINATIONS, ACTIVITIES, PARCOURS });
