/* TravelFamily.AI — Design System doc renderer */
(function(){
  const $ = s => document.querySelector(s);
  const el = (h)=>{ const t=document.createElement('template'); t.innerHTML=h.trim(); return t.content.firstElementChild; };
  const lum = (hex)=>{ const c=hex.replace('#',''); const r=parseInt(c.substr(0,2),16),g=parseInt(c.substr(2,2),16),b=parseInt(c.substr(4,2),16); return (0.299*r+0.587*g+0.114*b)/255; };
  const on = (hex)=> lum(hex)>0.62 ? '#0F172A' : '#FFFFFF';

  /* ---- 0. icon tokens ---- */
  function renderIconTokens(root){
    const re=/__I_([A-Za-z]+)(_spark)?/g;
    const walker=document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const targets=[]; while(walker.nextNode()){ if(walker.currentNode.nodeValue.indexOf('__I_')>=0) targets.push(walker.currentNode); }
    targets.forEach(node=>{
      const span=document.createElement('span'); span.style.display='contents';
      span.innerHTML=node.nodeValue.replace(re,(_,n,sp)=> tfIcon(n, sp?{cls:'spark'}:{size:20}) );
      node.parentNode.replaceChild(span,node);
    });
  }

  /* ---- 1. values ---- */
  const VALUES=[['shield','Confiance'],['compass','Expertise'],['plane','Évasion'],['users','Famille'],['sparkles','Découverte'],['star','Innovation']];
  function buildValues(){ $('#values').innerHTML = VALUES.map(([i,t])=>`<span class="value" style="color:var(--ocean-700)">${tfIcon(i,{size:18})}<span style="color:var(--text)">${t}</span></span>`).join(''); }

  /* ---- 2. colors ---- */
  const BRAND=[['Bleu Océan','#2563EB','Principale'],['Océan 600','#1D4ED8','Hover'],['Turquoise','#06B6D4','Secondaire'],['Turquoise 600','#0596B0','Hover'],['Corail','#FF7A59','Accent chaud'],['Or','#D4AF37','Premium']];
  const NEUTRAL=[['Marine','#0F172A'],['Anthracite','#334155'],['Gris','#64748B'],['Gris clair','#CBD5E1'],['Bordure','#E2E8F0'],['Brume','#F1F5F9'],['Sable','#FBF6EC'],['Blanc','#FFFFFF']];
  const STATUS=[['Succès','#15A34A'],['Attention','#E8920C'],['Erreur','#E23B3B'],['Info','#2563EB']];
  const swatch=(nm,hx,sub)=>`<div class="swatch"><div class="chip-color" style="background:${hx}"></div><div class="meta"><div class="nm">${nm}</div><div class="hx">${hx}${sub?' · '+sub:''}</div></div></div>`;
  function buildColors(){
    $('#swatchBrand').innerHTML=BRAND.map(([n,h,s])=>swatch(n,h,s)).join('');
    $('#swatchNeutral').innerHTML=NEUTRAL.map(([n,h])=>swatch(n,h)).join('');
    $('#swatchStatus').innerHTML=STATUS.map(([n,h])=>swatch(n,h)).join('');
    const GR=[['Océan','var(--grad-ocean)'],['Coucher de soleil','var(--grad-sunset)'],['Premium','var(--grad-premium)'],['Or','var(--grad-gold)'],['Ciel','var(--grad-sky)'],['Aurore','var(--grad-aurora), #1b2a4a']];
    $('#grads').innerHTML=GR.map(([n,g])=>`<div class="grad-tile" style="background:${g}; ${n==='Ciel'?'color:#0F172A;':''}">${n}</div>`).join('');
  }

  /* ---- 3. accent cards ---- */
  function buildAccents(){
    const A=[['coral','Corail','Chaleur & énergie','Le choix par défaut : joyeux, humain, donne envie de partir tout de suite.'],
             ['turquoise','Turquoise','Fraîcheur & évasion','Plus calme et aquatique — renforce le sentiment d\'évasion et de sérénité.'],
             ['gold','Or','Exclusivité','Le plus premium et feutré — idéal si l\'offre se positionne haut de gamme.']];
    $('#accentCards').innerHTML=A.map(([k,nm,tag,desc])=>`
      <div class="panel" data-accent="${k}" style="border-top:5px solid var(--accent);">
        <div class="row between"><div class="label">${nm}</div><span class="badge" style="background:var(--accent-50); color:var(--accent-600)">accent</span></div>
        <div class="micro" style="margin:2px 0 16px;">${tag}</div>
        <div class="dest-card" style="margin-bottom:14px;">
          <div class="photo" style="background-image:url(assets/photo-beach.jpg); aspect-ratio:16/9;">
            <button class="fav" style="color:var(--accent)">${tfIcon('heart',{size:18})}</button>
            <div class="cap"><b style="font-family:var(--font-display); font-size:17px;">Bali en famille</b></div>
          </div>
        </div>
        <div class="row gap2 wrap">
          <button class="btn btn--accent btn--sm">${tfIcon('heart',{size:16})} Favori</button>
          <span class="chip chip--accent chip--active">Soleil</span>
        </div>
        <p class="micro" style="margin-top:14px;">${desc}</p>
      </div>`).join('');
  }

  /* ---- 4. type scale ---- */
  function buildType(){
    const T=[['Display','--fs-display','var(--font-display)','700','Voyagez l\'esprit libre'],
      ['H1','--fs-h1','var(--font-display)','700','Voyagez l\'esprit libre'],
      ['H2','--fs-h2','var(--font-display)','700','Vos prochaines vacances'],
      ['H3','--fs-h3','var(--font-display)','600','Destinations soleil'],
      ['H4','--fs-h4','var(--font-display)','600','Hôtels familiaux'],
      ['H5','--fs-h5','var(--font-display)','600','Activités à faire'],
      ['H6','--fs-h6','var(--font-display)','600','Bon à savoir'],
      ['Lead','--fs-lg','var(--font-body)','500','Webbina vous accompagne à chaque étape.'],
      ['Body','--fs-body','var(--font-body)','500','Le texte courant reste large et reposant, pour que chacun lise sans effort.'],
      ['Label','--fs-sm','var(--font-display)','600','QUI VOYAGE ?'],
      ['Micro','--fs-xs','var(--font-body)','500','Annulation gratuite jusqu\'à 48 h avant']];
    $('#typeScale').innerHTML=T.map(([nm,sz,ff,w,sample])=>`
      <div class="type-row"><div class="tag">${nm} · <span id="px-${nm}"></span></div>
      <div style="font-family:${ff}; font-size:var(${sz}); font-weight:${w}; line-height:1.1; color:var(--text);">${sample}</div></div>`).join('');
    // fill px values
    const probe=document.createElement('div'); document.body.appendChild(probe);
    T.forEach(([nm,sz])=>{ probe.style.fontSize=`var(${sz})`; const px=getComputedStyle(probe).fontSize; const e=$('#px-'+nm); if(e)e.textContent=px; });
    probe.remove();
  }

  /* ---- 5. spacing / radii / shadows ---- */
  function buildSpace(){
    const S=[['s1',4],['s2',8],['s3',12],['s4',16],['s5',20],['s6',24],['s8',32],['s10',40],['s12',48],['s16',64],['s20',80]];
    $('#spaceScale').innerHTML=S.map(([n,px])=>`<div class="space-row"><span class="nm">${n}</span><div class="space-bar" style="width:${px}px"></div><span class="px">${px}px</span></div>`).join('');
    const R=[['sm','--r-sm'],['md','--r-md'],['lg','--r-lg'],['xl','--r-xl'],['2xl','--r-2xl'],['pill','--r-pill']];
    $('#radii').innerHTML=R.map(([n,v])=>`<div style="text-align:center"><div style="width:72px; height:56px; background:var(--ocean-100); border:1.5px solid var(--ocean-200); border-radius:var(${v});"></div><div class="micro" style="margin-top:6px">${n}</div></div>`).join('');
    const SH=[['xs','--sh-xs'],['sm','--sh-sm'],['md','--sh-md'],['lg','--sh-lg'],['océan','--sh-ocean'],['corail','--sh-coral']];
    $('#shadows').innerHTML=SH.map(([n,v])=>`<div style="text-align:center"><div style="width:72px; height:56px; background:var(--surface); border-radius:14px; box-shadow:var(${v});"></div><div class="micro" style="margin-top:10px">${n}</div></div>`).join('');
  }

  /* ---- 6. icons ---- */
  function buildIcons(){
    $('#iconGrid').innerHTML=TF_ICON_NAMES.map(n=>`<div class="icon-cell">${tfIcon(n,{size:26})}<span>${n}</span></div>`).join('');
  }

  /* ---- 7. button states ---- */
  function buildBtnStates(){
    $('#btnStates').innerHTML=`
      <button class="btn btn--primary">Normal</button>
      <button class="btn btn--primary" style="transform:translateY(-2px); box-shadow:0 22px 40px -12px rgba(37,99,235,.5)">Hover</button>
      <button class="btn btn--primary" style="box-shadow:0 0 0 4px var(--ring)">Focus</button>
      <button class="btn btn--primary" disabled>Disabled</button>`;
  }

  /* ---- 8. cards ---- */
  function buildCards(){
    const C=[['photo-beach.jpg','Bali, Indonésie','__I_sun Plage · Famille','Dès 1 240 € / pers.','ocean','Coup de cœur'],
      ['photo-mountain.jpg','Annecy, France','__I_train Nature · 3 h de Paris','Dès 680 € / pers.','turq','Sans avion'],
      ['photo-hotel.jpg','Riad Resort & Spa','__I_bed 4 nuits · Vue mer','Dès 540 € / pers.','coral','Adapté enfants']];
    $('#cardGrid').innerHTML=C.map(([img,title,meta,price,badge,ribbon])=>`
      <div class="dest-card">
        <div class="photo" style="background-image:url(assets/${img})">
          <span class="ribbon"><span class="badge badge--${badge}">${tfIcon('star',{size:13})} ${ribbon}</span></span>
          <button class="fav">${tfIcon('heart',{size:18})}</button>
          <div class="cap"><b style="font-family:var(--font-display); font-size:19px;">${title}</b></div>
        </div>
        <div class="body">
          <div class="micro" style="display:flex; gap:6px; align-items:center;">${meta}</div>
          <div class="row between" style="margin-top:10px;">
            <b style="font-family:var(--font-display); font-size:16px;">${price}</b>
            <span class="row gap2 micro" style="color:var(--gold-700)">${tfIcon('star',{size:14})} 4,9</span>
          </div>
        </div>
      </div>`).join('');
  }

  /* ---- 9. parcours ---- */
  function buildParcours(){
    const P=[['01','calendar','ocean','J\'ai mes dates et ma destination','Optimisez votre voyage selon vos critères.'],
      ['02','compass','coral','J\'ai mes dates mais pas la destination','Webbina vous trouve les meilleures idées.'],
      ['03','wallet','turq','J\'ai une destination, je suis flexible','On cible les meilleures périodes et prix.'],
      ['04','balloon','gold','Fais-moi rêver','Laissez Webbina inventer une expérience unique.']];
    $('#parcoursGrid').innerHTML=P.map(([num,ic,c,title,desc])=>`
      <div class="card card--hover card--pad" style="position:relative; overflow:hidden;">
        <div style="position:absolute; top:-10px; right:-6px; font-family:var(--font-display); font-weight:800; font-size:64px; color:var(--${c}-50); line-height:1;">${num}</div>
        <div style="width:54px; height:54px; border-radius:16px; background:var(--${c}-50); color:var(--${c}-700); display:grid; place-items:center; position:relative;">${tfIcon(ic,{size:26})}</div>
        <h5 style="margin:16px 0 8px; position:relative;">${title}</h5>
        <p class="muted" style="font-size:15px; position:relative;">${desc}</p>
        <div class="row gap2" style="margin-top:14px; color:var(--${c}-700); font-family:var(--font-display); font-weight:600; font-size:14px; position:relative;">Choisir ${tfIcon('arrowRight',{size:16})}</div>
      </div>`).join('');
  }

  /* ---- 10. avatar states + tabbar + breakpoints ---- */
  function buildAvatars(){
    const A=[['Au repos',''],['Parle','speak'],['Réfléchit','think'],['Suggère','suggest']];
    $('#avatarStates').innerHTML=A.map(([lbl,st])=>`
      <div style="text-align:center;">
        <div class="webbina-badge" style="position:relative;">
          <img class="avatar" src="assets/webbina-circle.png" style="width:60px; height:60px; ${st==='speak'?'box-shadow:0 0 0 4px var(--turq-100), 0 0 0 9px var(--turq-50);':''}" />
          ${st==='think'?'<span style="position:absolute; right:-4px; bottom:-2px; background:var(--surface); border:1px solid var(--border); border-radius:99px; padding:3px 6px; display:flex; gap:3px;"><i style="width:5px;height:5px;border-radius:50%;background:var(--slate-400);display:block;"></i><i style="width:5px;height:5px;border-radius:50%;background:var(--slate-400);display:block;"></i><i style="width:5px;height:5px;border-radius:50%;background:var(--slate-400);display:block;"></i></span>':''}
          ${st==='suggest'?'<span style="position:absolute; right:-6px; top:-6px; color:var(--gold);">'+tfIcon('sparkles',{size:22})+'</span>':''}
          ${st===''?'<span class="pulse"></span>':''}
        </div>
        <div class="micro" style="margin-top:8px;">${lbl}</div>
      </div>`).join('');
  }
  function buildTabbar(){
    const T=[['compass','Explorer',1],['sparkles','Idées',0],['__fab','',0],['briefcase','Voyages',0],['user','Profil',0]];
    $('#tabbar').innerHTML=T.map(([ic,lbl,act])=>{
      if(ic==='__fab') return `<div style="margin-top:-28px;"><div style="width:60px; height:60px; border-radius:50%; background:var(--grad-ocean); display:grid; place-items:center; box-shadow:var(--sh-ocean); border:4px solid var(--surface); overflow:hidden;"><img src="assets/webbina-circle.png" style="width:100%; height:100%;"/></div></div>`;
      return `<div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex:1; color:${act?'var(--ocean)':'var(--text-muted)'}; font-family:var(--font-display); font-weight:600; font-size:11px;">${tfIcon(ic,{size:24})}<span>${lbl}</span></div>`;
    }).join('');
  }
  function buildBreakpoints(){
    const B=[['Mobile','≤ 480 px','22'],['Tablette','481 – 1024 px','42'],['Desktop','1025 – 1440 px','64'],['Ultra-large','> 1440 px','88']];
    $('#bps').innerHTML=B.map(([nm,rng,h])=>`<div class="bp-row"><div class="dev" style="--h:${h}px; width:${h*1.6}px;"></div><div style="flex:1;"><b style="font-family:var(--font-display)">${nm}</b><div class="micro">${rng}</div></div></div>`).join('');
  }

  /* ---- toolbar: accent + theme ---- */
  function wireToolbar(){
    const root=document.documentElement;
    $('#accentSeg').addEventListener('click',e=>{
      const b=e.target.closest('[data-accent-btn]'); if(!b)return;
      root.setAttribute('data-accent', b.dataset.accentBtn);
      $('#accentSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===b));
    });
    const tb=$('#themeBtn');
    tb.addEventListener('click',()=>{
      const dark=root.getAttribute('data-theme')==='dark';
      root.setAttribute('data-theme', dark?'light':'dark');
      tb.innerHTML=dark?tfIcon('moon',{size:20}):tfIcon('sun',{size:20});
    });
  }

  /* ---- scrollspy ---- */
  function wireNav(){
    const links=[...document.querySelectorAll('#nav a')];
    const map={}; links.forEach(a=>{ const id=a.getAttribute('href').slice(1); map[id]=a; });
    const io=new IntersectionObserver((ents)=>{
      ents.forEach(en=>{ if(en.isIntersecting){ links.forEach(l=>l.classList.remove('active')); const a=map[en.target.id]; if(a)a.classList.add('active'); } });
    },{rootMargin:'-20% 0px -70% 0px'});
    document.querySelectorAll('section[id]').forEach(s=>io.observe(s));
    links.forEach(a=>a.addEventListener('click',e=>{ e.preventDefault(); const t=document.querySelector(a.getAttribute('href')); if(t){ const y=t.getBoundingClientRect().top+window.scrollY-72; window.scrollTo({top:y,behavior:'smooth'}); } }));
  }

  document.addEventListener('DOMContentLoaded',()=>{
    renderIconTokens(document.body);
    buildValues(); buildColors(); buildAccents(); buildType(); buildSpace(); buildIcons();
    buildBtnStates(); buildCards(); buildParcours(); buildAvatars(); buildTabbar(); buildBreakpoints();
    wireToolbar(); wireNav();
  });
})();
