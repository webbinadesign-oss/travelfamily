/* GlobeParcours — holographic wireframe globe presenting the 4 parcours.
   • néon/hologram wireframe sphere on a spatial backdrop
   • the 4 choice cards are mounted ON the globe faces and ROTATE WITH the globe
   • each card has its own colour so every rotation step is clearly distinct
   • rotation happens ONLY when the user taps the ‹ / › arrows (or a dot) — never automatic
   • Webbina speaks ONLY in response to a user tap — never on her own
   • tapping the front card starts that parcours.
   Self-contained: injects its own <style> once; uses global Voice + LivingWebbina + Icon. */

(function injectGlobeCSS(){
  if(document.getElementById('tf-globe-css')) return;
  const css = `
  .globe-hero{ position:relative; margin:8px 14px 4px; border-radius:24px; overflow:hidden;
    background:
      radial-gradient(120% 80% at 50% -10%, rgba(124,92,255,.28), transparent 55%),
      radial-gradient(90% 70% at 50% 120%, rgba(56,232,255,.18), transparent 60%),
      linear-gradient(180deg, #070b1f 0%, #0a1233 55%, #070a22 100%);
    border:1px solid rgba(120,160,255,.20);
    box-shadow:0 18px 50px -22px rgba(10,18,60,.9), inset 0 0 70px rgba(80,120,255,.10);
  }
  .globe-hero .gh-stars{ position:absolute; inset:0; pointer-events:none; opacity:.9;
    background-image:
      radial-gradient(1.4px 1.4px at 20% 24%, #cfe6ff 60%, transparent),
      radial-gradient(1.2px 1.2px at 72% 16%, #9fd8ff 60%, transparent),
      radial-gradient(1px 1px at 42% 64%, #ffffff 60%, transparent),
      radial-gradient(1.3px 1.3px at 84% 58%, #bcd4ff 60%, transparent),
      radial-gradient(1px 1px at 12% 76%, #aee9ff 60%, transparent),
      radial-gradient(1px 1px at 60% 86%, #ffffff 60%, transparent);
    animation:ghTwinkle 5.5s ease-in-out infinite; }
  @keyframes ghTwinkle{ 0%,100%{opacity:.55} 50%{opacity:1} }

  .globe-hero .gh-head{ position:relative; z-index:3; padding:15px 18px 0; display:flex; align-items:center; gap:12px; }
  .globe-hero .gh-head .gh-txt{ flex:1; }
  .globe-hero .gh-kicker{ font-size:11px; letter-spacing:.16em; text-transform:uppercase; font-weight:700; color:#7fe6ff; }
  .globe-hero .gh-h{ font-family:var(--font-display); font-size:18px; line-height:1.18; color:#fff; margin-top:3px; }
  .globe-hero .gh-web{ flex:none; }

  .globe-stage{ position:relative; height:344px; perspective:1150px; z-index:2; }
  .globe-atmo{ position:absolute; left:50%; top:50%; width:340px; height:340px; transform:translate(-50%,-50%);
    border-radius:50%; background:radial-gradient(circle, rgba(56,232,255,.16) 0%, rgba(124,92,255,.10) 44%, transparent 66%);
    filter:blur(2px); pointer-events:none; }
  .globe-wrap{ position:absolute; left:50%; top:50%; width:280px; height:280px; transform:translate(-50%,-50%);
    transform-style:preserve-3d; }
  .globe-rot{ position:absolute; inset:0; transform-style:preserve-3d;
    transition:transform 1.0s cubic-bezier(.22,.85,.28,1); }
  .gl-ring{ position:absolute; left:50%; top:50%; border-radius:50%; border:1px solid rgba(86,214,255,.24);
    transform:translate(-50%,-50%); }
  .gl-mrd{ width:280px; height:280px; }

  .globe-nav{ position:absolute; top:50%; transform:translateY(-50%); z-index:8; width:44px; height:44px; border-radius:50%;
    display:grid; place-items:center; border:1px solid rgba(140,180,255,.40); color:#eaf6ff;
    background:rgba(14,22,55,.6); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); cursor:pointer;
    transition:transform .15s, background .2s, box-shadow .2s; box-shadow:0 6px 18px -8px rgba(0,0,0,.7); }
  .globe-nav:hover{ background:rgba(34,52,110,.8); box-shadow:0 0 0 1px rgba(127,230,255,.4); }
  .globe-nav:active{ transform:translateY(-50%) scale(.88); }
  .globe-nav.prev{ left:8px; } .globe-nav.next{ right:8px; }

  /* a parcours card mounted on a globe face — rotates with the sphere */
  .globe-face{ position:absolute; left:50%; top:50%; width:200px; margin-left:-100px; margin-top:-118px;
    padding:17px 19px 18px; border-radius:46px; text-align:left; cursor:default;
    transform-origin:center center; backface-visibility:hidden; -webkit-backface-visibility:hidden;
    background:linear-gradient(180deg, rgba(16,24,58,.90), rgba(9,14,38,.88));
    transition:opacity .55s ease, box-shadow .55s ease; }
  .globe-face .gf-top{ display:flex; align-items:center; gap:9px; }
  .globe-face .gf-num{ font-family:var(--font-display); font-weight:800; font-size:13px; color:#0a1024;
    width:28px; height:28px; border-radius:8px; display:grid; place-items:center; flex:none; }
  .globe-face .gf-ic{ width:30px; height:30px; border-radius:9px; display:grid; place-items:center; flex:none; }
  .globe-face .gf-title{ font-family:var(--font-display); font-weight:700; font-size:15px; color:#fff; line-height:1.22; margin-top:11px; }
  .globe-face .gf-desc{ font-size:12px; color:rgba(214,230,255,.78); margin-top:6px; line-height:1.44; }
  .globe-face .gf-cta{ display:inline-flex; align-items:center; gap:6px; margin-top:12px; font-size:12.5px; font-weight:700; }
  .globe-face.is-active{ cursor:pointer; }
  .globe-face.is-active:active{ filter:brightness(1.08); }

  .globe-dots{ display:flex; gap:7px; justify-content:center; padding:2px 0 14px; position:relative; z-index:3; }
  .globe-dots i{ width:7px; height:7px; border-radius:50%; background:rgba(160,190,255,.30); transition:all .3s; cursor:pointer; }
  .globe-dots i.on{ width:22px; border-radius:6px; }

  @media (prefers-reduced-motion: reduce){ .gh-stars{ animation:none; } .globe-rot{ transition:none; } }
  `;
  const s=document.createElement('style'); s.id='tf-globe-css'; s.textContent=css; document.head.appendChild(s);
})();

/* per-parcours spoken line (only ever played after a user tap) */
const GLOBE_LINES = {
  '01': "Vous avez déjà vos dates et votre destination ? Parfait, je m'occupe d'optimiser chaque réservation.",
  '02': "Vous connaissez vos dates mais pas encore où aller ? Je vous trouve les plus belles idées en famille.",
  '03': "Vous avez une destination en tête et vous êtes flexible ? On cible la meilleure période et le meilleur prix.",
  '04': "Laissez-moi vous surprendre : j'imagine pour vous un voyage en famille sur mesure, de A à Z.",
};

/* one distinct colour palette per card so each rotation step reads differently */
const GLOBE_PALETTE = [
  { a:'#38bdf8', b:'#0ea5e9', glow:'rgba(56,189,248,.95)' },   // 01 cyan
  { a:'#a78bfa', b:'#7c5cff', glow:'rgba(167,139,250,.95)' },  // 02 violet
  { a:'#34e3b8', b:'#10b981', glow:'rgba(52,227,184,.95)' },   // 03 teal
  { a:'#fbbf24', b:'#fb7185', glow:'rgba(251,146,60,.95)' },   // 04 amber/coral
];

function GlobeParcours({ openParcours, items, onPick, lines, kicker, heading }) {
  const P = items || TF.PARCOURS;
  const LINES = lines || GLOBE_LINES;
  const pick = onPick || openParcours;
  const N = P.length;
  const R = 150; // card distance from centre
  const [turn, setTurn] = React.useState(0);     // monotonic; rotation only on tap
  const [speaking, setSpeaking] = React.useState(false);
  const active = ((turn % N) + N) % N;

  React.useEffect(()=>()=>{ try{ Voice.cancel(); }catch(e){} }, []); // stop voice on unmount

  // On ARRIVAL at the globe, Webbina announces ONLY the first card, once.
  // The other cards are still spoken only when the user taps an arrow/dot.
  const introRef = React.useRef(false);
  React.useEffect(()=>{
    if(introRef.current) return;
    introRef.current = true;
    const t = setTimeout(()=>{ try{ narrate(0); }catch(e){} }, 650);
    return ()=>clearTimeout(t);
  }, []);

  function narrate(idx){
    const p = P[idx];
    try{ Voice.cancel(); }catch(e){}
    try{
      Voice.speak(LINES[p.id] || p.line || p.t, {
        emotion:'happy',
        onstart:()=>setSpeaking(true),
        onend:()=>setSpeaking(false),
      });
    }catch(e){ setSpeaking(false); }
  }

  function go(dir){ const next = turn + dir; setTurn(next); narrate(((next % N)+N)%N); }
  function jump(i){ if(i===active) return; const next = turn + ((((i-active)%N)+N)%N); setTurn(next); narrate(i); }

  const pal = GLOBE_PALETTE[active];

  return (
    <div className="globe-hero">
      <div className="gh-stars" aria-hidden="true"></div>
      <div className="gh-head">
        <div className="gh-txt">
          <div className="gh-kicker">{kicker || 'Par où commencer ?'}</div>
          <div className="gh-h">{heading || 'Tournez le globe avec les flèches, puis touchez la carte.'}</div>
        </div>
        <span className="gh-web"><LivingWebbina size={46} state={speaking?'speaking':'idle'} expr={speaking?'enthusiastic':'happy'} /></span>
      </div>

      <div className="globe-stage">
        <div className="globe-atmo" aria-hidden="true" style={{ boxShadow:`0 0 90px 10px ${pal.glow.replace('.95','.12')}` }}></div>
        <button className="globe-nav prev" aria-label="Carte précédente" onClick={()=>go(-1)}><Icon n="chevronLeft" size={22} /></button>
        <button className="globe-nav next" aria-label="Carte suivante" onClick={()=>go(1)}><Icon n="chevronRight" size={22} /></button>

        <div className="globe-wrap">
          <div className="globe-rot" style={{ transform:`rotateX(-12deg) rotateY(${-turn*(360/N)}deg)` }}>
            {/* meridians */}
            {Array.from({length:9}).map((_,i)=>(
              <div key={'m'+i} className="gl-ring gl-mrd" style={{ transform:`translate(-50%,-50%) rotateY(${i*20}deg)` }} />
            ))}
            {/* parallels */}
            {[-66,-40,0,40,66].map((lat,i)=>{
              const r=140, rad=r*Math.cos(lat*Math.PI/180), z=r*Math.sin(lat*Math.PI/180), d=rad*2;
              return <div key={'p'+i} className="gl-ring" style={{ width:d, height:d, transform:`translate(-50%,-50%) rotateX(90deg) translateZ(${z}px)`, borderColor:'rgba(124,92,255,.24)' }} />;
            })}
            {/* the 4 parcours cards, mounted on the globe faces — rotate with the sphere */}
            {P.map((p,i)=>{
              const c = GLOBE_PALETTE[i];
              const isActive = i===active;
              return (
                <button key={p.id} className={`globe-face ${isActive?'is-active':''}`}
                  onClick={()=>{ if(isActive) pick(p.id); }}
                  aria-hidden={!isActive}
                  style={{
                    transform:`rotateY(${i*(360/N)}deg) translateZ(${R}px)`,
                    opacity:isActive?1:0.16,
                    pointerEvents:isActive?'auto':'none',
                    border:`1px solid ${isActive?c.a:'rgba(127,160,220,.25)'}`,
                    boxShadow:isActive
                      ? `0 0 0 1px ${c.a}55, 0 0 30px -4px ${c.glow}, 0 18px 42px -16px rgba(0,0,0,.8), inset 0 0 26px ${c.glow.replace('.95','.14')}`
                      : 'none',
                  }}>
                  <div className="gf-top">
                    <span className="gf-num" style={{ background:`linear-gradient(135deg, ${c.a}, ${c.b})` }}>{p.id}</span>
                    <span className="gf-ic" style={{ background:`${c.a}22`, color:c.a, border:`1px solid ${c.a}55` }}><Icon n={p.ic} size={18} /></span>
                  </div>
                  <div className="gf-title">{p.t}</div>
                  <div className="gf-desc">{p.d}</div>
                  <span className="gf-cta" style={{ color:c.a }}>{p.cta || 'Choisir ce parcours'} <Icon n="arrowRight" size={15} /></span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="globe-dots">
        {P.map((_,i)=>(
          <i key={i} className={i===active?'on':''} onClick={()=>jump(i)}
            style={ i===active ? { background:`linear-gradient(90deg, ${GLOBE_PALETTE[i].a}, ${GLOBE_PALETTE[i].b})` } : null } />
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { GlobeParcours });
