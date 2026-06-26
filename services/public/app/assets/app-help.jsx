/* TravelFamily.AI — Centre d'aide & SAV PERSONNALISÉ.
   Principe : Webbina ne donne jamais un lien générique. Pour un souci sur une
   réservation, elle oriente vers LE prestataire réellement réservé (la compagnie
   du vol, l'hôtel précis…), avec sa référence de dossier. Modèle tenable solo :
   1) Webbina (IA) niveau 1, 24/7 — bouton « Demander à Webbina »
   2) Self-service FAQ
   3) Routage personnalisé vers le bon prestataire de CHAQUE réservation
   4) Demande écrite asynchrone (délai annoncé) */

/* Annuaire SAV des prestataires (contact officiel par compagnie/marque). */
const PROVIDER_CONTACTS = {
  // compagnies aériennes (code IATA)
  'AF':{ name:'Air France', url:'https://www.airfrance.fr/contact', tel:'3654' },
  'TO':{ name:'Transavia', url:'https://www.transavia.com/aide', tel:'+33 1 80 84 11 44' },
  'U2':{ name:'easyJet', url:'https://www.easyjet.com/fr/aide', tel:'+33 9 77 40 77 70' },
  'FR':{ name:'Ryanair', url:'https://www.ryanair.com/fr/fr/centre-aide', tel:'' },
  'VY':{ name:'Vueling', url:'https://www.vueling.com/fr/service-client', tel:'' },
  'IB':{ name:'Iberia', url:'https://www.iberia.com/fr/service-client/', tel:'' },
  'LH':{ name:'Lufthansa', url:'https://www.lufthansa.com/fr/fr/contact', tel:'' },
  'EK':{ name:'Emirates', url:'https://www.emirates.com/fr/french/help/', tel:'' },
  'QR':{ name:'Qatar Airways', url:'https://www.qatarairways.com/fr/help.html', tel:'' },
  'TK':{ name:'Turkish Airlines', url:'https://www.turkishairlines.com/fr-fr/contact/', tel:'' },
};

/* Récupère les réservations de l'utilisateur (persistées à la réservation).
   Structure attendue par réservation : { id, type:'flight|hotel|car|train|ferry',
   providerName, providerCode, ref, dateStr, contactUrl, contactTel } */
function getBookings(){
  try{ return JSON.parse(localStorage.getItem('tf_bookings_v1')) || []; }catch(e){ return []; }
}
function resolveContact(bk){
  const dir = bk.providerCode && PROVIDER_CONTACTS[bk.providerCode];
  return {
    name: bk.providerName || (dir && dir.name) || 'le prestataire',
    url: bk.contactUrl || (dir && dir.url) || null,
    tel: bk.contactTel || (dir && dir.tel) || '',
  };
}
const TYPE_ICON = { flight:'plane', hotel:'bed', car:'car', train:'train', ferry:'anchor' };

function FaqItem({ item }){
  const [open, setOpen] = React.useState(false);
  return (
    <div className={`faq-item ${open?'open':''}`}>
      <button className="faq-q" onClick={()=>setOpen(o=>!o)}><span>{item.q}</span><Icon n="chevronRight" size={18} /></button>
      {open && <div className="faq-a">{item.a}</div>}
    </div>
  );
}

/* Carte SAV d'une réservation précise → routage vers le bon prestataire. */
function BookingSupportCard({ bk, openChat }){
  const c = resolveContact(bk);
  return (
    <div className="card card--pad" style={{ marginTop:10 }}>
      <div className="row gap3" style={{ alignItems:'center' }}>
        <div className="mem-ic" style={{ flex:'none' }}><Icon n={TYPE_ICON[bk.type]||'briefcase'} size={20} /></div>
        <div style={{ flex:1, minWidth:0 }}>
          <b style={{ fontFamily:'var(--font-display)', fontSize:14.5 }}>{c.name}</b>
          <div className="micro">{bk.dateStr || ''}{bk.ref ? ` · Dossier ${bk.ref}` : ''}</div>
        </div>
      </div>
      <div className="row gap2" style={{ marginTop:11, flexWrap:'wrap' }}>
        <button className="btn btn--secondary btn--sm" onClick={()=> openChat && openChat('sav', { mode:'sav', booking:bk })}>
          <Icon n="sparkles" size={15} /> Demander à Webbina
        </button>
        {c.url && <a className="btn btn--ghost btn--sm" href={c.url} target="_blank" rel="noopener" style={{ textDecoration:'none' }}><Icon n="phone" size={15} /> Contacter {c.name}</a>}
        {c.tel && <a className="btn btn--ghost btn--sm" href={`tel:${c.tel.replace(/\s/g,'')}`} style={{ textDecoration:'none' }}>{c.tel}</a>}
      </div>
    </div>
  );
}

function HelpScreen({ go, openChat }){
  const SUPPORT_EMAIL = (window.LEGAL_INFO && window.LEGAL_INFO.email) || 'webbinadesign@gmail.com';
  const bookings = getBookings();
  return (
    <div className="screen" style={{ paddingBottom:30 }}>
      <div className="sub-head">
        <button className="icon-btn" onClick={()=>go('profil')} aria-label="Retour"><Icon n="arrowLeft" size={22} /></button>
        <div style={{ flex:1 }}><b style={{ fontFamily:'var(--font-display)', fontSize:17 }}>Aide & SAV</b></div>
      </div>

      <div style={{ padding:'16px 16px 0' }}>
        {/* 1 — Webbina niveau 1 */}
        <button className="card card--pad help-hero" onClick={()=>openChat && openChat('sav', { mode:'sav' })}>
          <Avatar size={56} ring expr="reassuring" style={{ flex:'none' }} />
          <div style={{ flex:1, textAlign:'left' }}>
            <b style={{ fontFamily:'var(--font-display)', fontSize:16 }}>Demander à Webbina</b>
            <div className="micro" style={{ marginTop:2 }}>Elle répond à vos questions <b>24/7, en direct</b>, et vous oriente vers le bon interlocuteur.</div>
          </div>
          <Icon n="chevronRight" size={20} style={{ color:'var(--text-muted)' }} />
        </button>

        {/* 2 — Réservations : routage personnalisé */}
        <div style={{ marginTop:18 }}>
          <h4 style={{ fontSize:15, padding:'0 4px 4px' }}>Un souci avec une réservation&nbsp;?</h4>
          {bookings.length ? (
            <>
              <p className="micro" style={{ padding:'0 4px 6px', lineHeight:1.5 }}>Webbina vous met en relation avec <b>le prestataire exact</b> de votre réservation — jamais un contact générique.</p>
              {bookings.map((bk,i)=><BookingSupportCard key={bk.id||i} bk={bk} openChat={openChat} />)}
            </>
          ) : (
            <div className="card card--pad" style={{ background:'var(--surface-sunk)' }}>
              <p className="micro" style={{ lineHeight:1.5 }}>Vos réservations apparaîtront ici. En cas de souci, Webbina vous orientera directement vers <b>la compagnie ou l'hôtel concerné</b> par votre dossier — avec sa référence — et non vers un lien général.</p>
            </div>
          )}
        </div>

        {/* 3 — FAQ */}
        <div style={{ marginTop:18 }}>
          <h4 style={{ fontSize:15, padding:'0 4px 8px' }}>Questions fréquentes</h4>
          <div className="faq-list">
            {(window.TF && TF.FAQ ? TF.FAQ : []).map((f,i)=><FaqItem key={i} item={f} />)}
          </div>
        </div>

        {/* 4 — Écrire (async, délai honnête) */}
        <div className="card card--pad" style={{ marginTop:18 }}>
          <b style={{ fontFamily:'var(--font-display)', fontSize:15 }}>Nous écrire</b>
          <p className="micro" style={{ marginTop:4, lineHeight:1.5 }}>Une demande complexe que Webbina n'a pas résolue&nbsp;? Écrivez-nous : nous répondons <b>par e-mail sous 24 à 48&nbsp;h ouvrées</b>.</p>
          <a className="btn btn--secondary btn--block" href={`mailto:${SUPPORT_EMAIL}?subject=Aide%20TravelFamily.AI`} style={{ marginTop:12, textDecoration:'none' }}>
            <Icon n="send" size={17} /> Envoyer un message
          </a>
          <div className="micro" style={{ textAlign:'center', color:'var(--text-muted)', marginTop:8 }}>Membres <b>VIP</b> & <b>Premium</b> : réponse prioritaire.</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { HelpScreen, PROVIDER_CONTACTS, getBookings });
