/* TravelFamily.AI app — LIVING Webbina presence (breathing, blink, sway, react)
   A compact, self-contained living avatar for the mobile app. One rAF loop per
   mounted instance writes CSS vars on the wrapper; CSS does the rest.
   Props: expr (happy|focused|reassuring|enthusiastic|surprised), state
   (idle|listening|thinking|speaking), size, ring, celebrate.                  */

/* Context → expression director (mirrors the brief's 5 moments). */
const APP_CONTEXT_EXPR = {
  welcome:'happy', home:'happy', chat:'focused', results:'enthusiastic',
  detail:'happy', formalites:'reassuring', dashboard:'happy', booked:'enthusiastic',
  favoris:'happy', profil:'reassuring', auth:'happy', badges:'enthusiastic',
};
function screenToExpr(screen){ return APP_CONTEXT_EXPR[screen] || 'happy'; }

function LivingWebbina({ expr='happy', state='idle', size=120, ring=false, celebrate=false, onClick, style }) {
  const wrapRef = React.useRef(null);
  const stateRef = React.useRef(state);
  stateRef.current = state;

  React.useEffect(()=>{
    const el = wrapRef.current; if(!el) return;
    let raf; const t0 = performance.now();
    let nextBlink = 900 + Math.random()*2200, blinkUntil = -1;
    let nextMicro = 4000 + Math.random()*4000, microUntil = -1, microKind = 0;
    let swayX=0, swayRot=0, tgtX=0, tgtRot=0, reTarget=0;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const frame = (now)=>{
      const t = now - t0; const st = stateRef.current;
      const period = st==='speaking'?1700 : st==='listening'?2100 : 3000;
      const breath = reduce ? 0 : Math.sin((t/period)*Math.PI*2);
      if(t>reTarget){ tgtX=Math.random()*2-1; tgtRot=Math.random()*2-1; reTarget=t+2400+Math.random()*2600; }
      const ease = st==='thinking'?0.05:0.022;
      swayX += (tgtX-swayX)*ease; swayRot += (tgtRot-swayRot)*ease;
      const think = st==='thinking' ? Math.sin(t/700) : 0;
      if(t>nextBlink){ blinkUntil=t+120; nextBlink=t+2200+Math.random()*3400; if(Math.random()<0.22) nextBlink=t+300; }
      const blink = t<blinkUntil ? Math.sin(((t-(blinkUntil-120))/120)*Math.PI) : 0;
      if(st==='idle' && t>nextMicro){ microUntil=t+620; microKind=Math.floor(Math.random()*2); nextMicro=t+5200+Math.random()*5200; }
      const micro = t<microUntil ? Math.sin(((t-(microUntil-620))/620)*Math.PI) : 0;

      const tx = swayX*3 + (microKind===1?micro*2:0);
      const ty = breath*-2 - (microKind===0?micro*2.5:0);
      const rot = swayRot*1.4 + think*1.6 + (microKind===1?micro*1.4:0);
      const sy = 1 + breath*0.012;
      el.style.setProperty('--tx', tx.toFixed(2)+'px');
      el.style.setProperty('--ty', ty.toFixed(2)+'px');
      el.style.setProperty('--rot', rot.toFixed(2)+'deg');
      el.style.setProperty('--sy', sy.toFixed(3));
      el.style.setProperty('--blink', blink.toFixed(2));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return ()=>cancelAnimationFrame(raf);
  }, []);

  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag ref={wrapRef} onClick={onClick}
      className={`lwb state-${state} ${ring?'lwb--ring':''} ${celebrate?'lwb--party':''}`}
      style={{ width:size, height:size, ...style }} aria-label={onClick?'Parler à Webbina':undefined}>
      <span className="lwb-aura" />
      <span className="lwb-ring" />
      <span className="lwb-body">
        <img src={`assets/webbina-${expr}.png`} alt="Webbina" />
        <span className="lwb-lid" aria-hidden="true" />
      </span>
      {state==='speaking' && <span className="lwb-wave" aria-hidden="true"><i/><i/><i/><i/></span>}
      {celebrate && <span className="lwb-confetti" aria-hidden="true">{Array.from({length:12}).map((_,i)=>
        <i key={i} style={{ left:`${(i*8+4)%100}%`, background:['var(--ocean)','var(--turq)','var(--coral)','var(--gold)'][i%4], animationDelay:`${(i%5)*0.12}s` }} />)}</span>}
    </Tag>
  );
}

Object.assign(window, { LivingWebbina, screenToExpr, APP_CONTEXT_EXPR });
