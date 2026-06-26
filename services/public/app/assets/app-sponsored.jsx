/* TravelFamily.AI — Emplacements sponsorisés (offres partenaires commissionnées).
   Visibles en gratuit, masqués en Premium. Étiquetés « Sponsorisé » pour la
   transparence légale (DGCCRF/UE). Aucun réseau pub tiers : uniquement des
   partenaires affiliés contrôlés → marque protégée + commission (pas d'intérêt). */

function tpMarker(){ try{ return window.WEBBINA_TP_MARKER || null; }catch(e){ return null; } }

/* Liens trackés Travelpayouts (marker only — aucun lien à fournir manuellement). */
function tpFlightsUrl(){
  const m = tpMarker(); if(!m) return null;
  return 'https://www.aviasales.com/?marker=' + encodeURIComponent(m);
}
function tpHotelsUrl(){
  const m = tpMarker(); if(!m) return null;
  return 'https://search.hotellook.com/?marker=' + encodeURIComponent(m);
}
/* GetYourGuide (activités) — réutilise la config d'affiliation déjà câblée. */
function gygSponsoredUrl(city){
  const q = new URLSearchParams({ q: city||'', partner_id:'Q2FL4D9', cmp:'share_to_earn' });
  return 'https://www.getyourguide.fr/s/?' + q.toString();
}

/* Catalogue d'offres partenaires (rotation). Chaque offre = une source de commission. */
function sponsoredOffers(){
  return [
    { ic:'plane', tag:'Vols', title:'Comparez 1 200 compagnies', sub:'Le bon prix au bon moment — alertes incluses.', cta:'Voir les vols', url:tpFlightsUrl(), accent:'var(--ocean-700)' },
    { ic:'bed', tag:'Hôtels', title:'Jusqu\'à -60 % sur les séjours', sub:'Des millions d\'hébergements comparés en direct.', cta:'Voir les offres', url:tpHotelsUrl(), accent:'var(--turq-700, var(--ocean-700))' },
    { ic:'star', tag:'Activités', title:'Visites & billets coupe-file', sub:'Réservez vos activités en famille, annulation gratuite.', cta:'Découvrir', url:gygSponsoredUrl(''), accent:'var(--gold-700)' },
  ].filter(o=>o.url);
}

/* Une carte sponsorisée discrète, clairement étiquetée. */
function SponsoredCard({ offer }){
  if(!offer) return null;
  return (
    <a className="spons-card" href={offer.url} target="_blank" rel="noopener sponsored" style={{ '--spons-accent':offer.accent }}>
      <div className="spons-ic"><Icon n={offer.ic} size={20} /></div>
      <div className="spons-body">
        <div className="spons-top">
          <span className="spons-tag">{offer.tag}</span>
          <span className="spons-label">Sponsorisé</span>
        </div>
        <b className="spons-title">{offer.title}</b>
        <span className="spons-sub">{offer.sub}</span>
      </div>
      <span className="spons-cta">{offer.cta}<Icon n="chevronRight" size={15} /></span>
    </a>
  );
}

/* Rangée d'offres partenaires — masquée intégralement en Premium. */
function SponsoredRow({ limit=2, title='Offres de nos partenaires', onPremium }){
  const premium = (window.TF && TF.isPremium && TF.isPremium());
  if(premium) return null;
  const offers = sponsoredOffers().slice(0, limit);
  if(!offers.length) return null;
  return (
    <div className="spons-row">
      <div className="spons-head">
        <span className="spons-head-label">{title}</span>
        <span className="spons-head-note">Annonce</span>
      </div>
      <div className="spons-list">
        {offers.map((o,i)=><SponsoredCard key={i} offer={o} />)}
      </div>
      <button className="spons-remove" onClick={()=>{ if(onPremium) onPremium(); else if(window.__goPremium) window.__goPremium(); }}>
        <Icon n="crown" size={13} /> Passer Premium pour retirer les annonces
      </button>
    </div>
  );
}

Object.assign(window, { SponsoredRow, SponsoredCard });
