/* TravelFamily.AI — Pages légales (Mentions · Confidentialité · CGV) + bandeau cookies.
   Pré-rempli avec les infos Webbina Design. Les [À COMPLÉTER] attendent un choix
   de l'éditrice. Non juridique — à faire valider par un juriste tourisme avant ouverture. */

const LEGAL_INFO = {
  societe:   'Webbina Design',
  statut:    'Entrepreneur individuel (auto-entrepreneur)',
  siret:     '994 762 185 00019',
  marque:    'TravelFamily.AI',
  email:     'webbinadesign@gmail.com',
  tel:       '06 18 20 34 59',
  resp:      'Sabrina Majri',
  adresse:   '75 rue René Cassin, 34570 Montarnaud, France',
  hebergeur: 'Render Services, Inc. — 525 Brannan St Ste 300, San Francisco, CA 94107, USA',
  maj:       'Juin 2026',
};

function LegalDoc({ children }) {
  return <div className="legal-doc">{children}</div>;
}
function LH({ children }) { return <h3 className="legal-h">{children}</h3>; }
function LP({ children }) { return <p className="legal-p">{children}</p>; }
function LRow({ k, v }) {
  return (
    <div className="legal-row">
      <span className="legal-k">{k}</span>
      <span className="legal-v">{v}</span>
    </div>
  );
}
function ToDo({ children }) {
  return <span className="legal-todo">[{children}]</span>;
}

/* ---- 1. Mentions légales ---- */
function MentionsDoc() {
  const I = LEGAL_INFO;
  return (
    <LegalDoc>
      <LP>Conformément à la loi n°2004-575 du 21 juin 2004 (LCEN), voici les informations relatives à l'éditeur et à l'hébergeur du service {I.marque}.</LP>
      <LH>Éditeur du service</LH>
      <LRow k="Société" v={I.societe} />
      <LRow k="Statut" v={I.statut} />
      <LRow k="SIRET" v={I.siret} />
      <LRow k="Responsable de publication" v={I.resp} />
      <LRow k="Adresse" v={I.adresse} />
      <LRow k="E-mail" v={I.email} />
      <LRow k="Téléphone" v={I.tel} />
      <LH>Hébergeur</LH>
      <LRow k="Hébergeur" v={I.hebergeur} />
      <LH>Propriété intellectuelle</LH>
      <LP>La marque {I.marque}, le personnage Webbina, les textes, visuels et l'interface sont la propriété exclusive de {I.societe}. Toute reproduction sans autorisation est interdite.</LP>
      <LH>Médiation & litiges</LH>
      <LP>En cas de litige, et après avoir saisi notre service client sans solution satisfaisante, vous pouvez recourir gratuitement à un médiateur de la consommation. Pour le secteur du voyage, il s'agit de <b>MTV — Médiation Tourisme Voyage</b> (BP 80 303, 75823 Paris Cedex 17 — mtv.travel), applicable dès lors que {I.marque} vend directement des prestations de voyage. Pour les réservations effectuées chez un partenaire, le médiateur compétent est celui désigné par ce partenaire. Plateforme européenne de règlement des litiges : ec.europa.eu/consumers/odr.</LP>
      <LP className="legal-maj">Dernière mise à jour : {I.maj}</LP>
    </LegalDoc>
  );
}

/* ---- 2. Confidentialité / RGPD ---- */
function ConfidentialiteDoc() {
  const I = LEGAL_INFO;
  return (
    <LegalDoc>
      <div className="legal-callout">
        <Icon n="shield" size={18} />
        <span>Vos passeports et les données de vos enfants sont des données sensibles. Elles ne servent qu'à préparer vos voyages et ne sont jamais revendues.</span>
      </div>
      <LH>Responsable du traitement</LH>
      <LP>{I.societe} ({I.statut}), SIRET {I.siret}. Contact : {I.email}.</LP>
      <LH>Données collectées</LH>
      <LP>• Compte : e-mail, mot de passe (chiffré).<br/>• Profil voyage : composition familiale, prénoms et âges des enfants, aéroports favoris, préférences.<br/>• Passeports : numéro, dates de validité, nationalité (saisis volontairement).<br/>• Conversations avec Webbina (texte et, si activé, voix).<br/>• Données techniques : appareil, langue.</LP>
      <LH>Pourquoi (finalités & base légale)</LH>
      <LP>Préparer et personnaliser vos voyages, vérifier les formalités, mémoriser vos préférences (exécution du service et votre consentement). Les passeports et données des enfants reposent sur votre <b>consentement explicite</b>, retirable à tout moment.</LP>
      <LH>Durée de conservation</LH>
      <LP>• <b>Compte & profil voyage</b> : conservés tant que votre compte est actif, puis effacés sous <b>30 jours</b> après sa suppression.<br/>• <b>Passeports</b> : supprimables immédiatement depuis votre profil ; sinon effacés avec le compte.<br/>• <b>Conversations avec Webbina</b> : conservées <b>12 mois</b>, puis anonymisées.<br/>• <b>Documents de réservation et pièces comptables</b> : conservés <b>3 ans</b> (obligation légale), voire plus si la loi l'impose.</LP>
      <LH>Sous-traitants (destinataires)</LH>
      <LP>Nous utilisons des prestataires qui traitent certaines données pour notre compte :</LP>
      <LRow k="Supabase" v="Hébergement base de données (UE/US)" />
      <LRow k="OpenAI / Google Gemini" v="Génération des réponses de Webbina" />
      <LRow k="ElevenLabs" v="Voix de Webbina (si activée)" />
      <LRow k="Stripe" v="Paiements (aucune carte stockée par nous)" />
      <LRow k="Google" v="Cartes, lieux & activités" />
      <LH>Vos droits (RGPD)</LH>
      <LP>Accès, rectification, suppression, portabilité, opposition et retrait du consentement. Pour les exercer : <b>{I.email}</b>. Réclamation possible auprès de la CNIL (cnil.fr).</LP>
      <LH>Mineurs</LH>
      <LP>Les données concernant des enfants sont saisies par un parent ou tuteur, qui en assume la responsabilité.</LP>
      <LP className="legal-maj">Dernière mise à jour : {I.maj}</LP>
    </LegalDoc>
  );
}

/* ---- 3. CGV / CGU ---- */
function CGVDoc() {
  const I = LEGAL_INFO;
  return (
    <LegalDoc>
      <LH>Objet</LH>
      <LP>{I.marque} est un service édité par {I.societe} qui aide les familles à préparer leurs voyages avec l'assistance de Webbina, et oriente vers des partenaires de réservation.</LP>
      <LH>Rôle de TravelFamily.AI</LH>
      <LP>Selon les services, {I.marque} agit comme :<br/>• <b>Apporteur d'affaires / affilié</b> : la réservation et le paiement se font chez le partenaire (vols, activités, voiture). Le contrat vous lie alors directement au partenaire et à ses conditions.<br/>• <ToDo>Le cas échéant — vente directe : à n'activer qu'une fois l'immatriculation Atout France obtenue.</ToDo></LP>
      <LH>Liens partenaires & rémunération</LH>
      <LP>Certains liens sont des liens partenaires : {I.societe} peut percevoir une commission, sans surcoût pour vous. Cela n'influence pas les prix affichés par les partenaires.</LP>
      <LH>Prix</LH>
      <LP>Les prix affichés proviennent des partenaires et sont indicatifs au moment de la recherche ; ils peuvent varier jusqu'à la confirmation chez le partenaire. Le prix définitif est celui validé lors du paiement.</LP>
      <LH>Droit de rétractation</LH>
      <LP>⚠️ Les prestations de transport et d'hébergement à date déterminée <b>ne bénéficient pas</b> du droit de rétractation de 14 jours (art. L221-28 du Code de la consommation). Les conditions d'annulation sont celles du partenaire.</LP>
      <LH>Formalités & responsabilité</LH>
      <LP>Les informations de formalités (visa, passeport, vaccins) sont fournies à titre indicatif. Il vous appartient de vérifier auprès des sources officielles (France Diplomatie). {I.societe} ne saurait être tenue responsable d'un refus d'embarquement lié à un document non conforme.</LP>
      <LH>Contact & réclamations</LH>
      <LP>{I.email} — {I.tel}.</LP>
      <LP className="legal-maj">Dernière mise à jour : {I.maj}</LP>
    </LegalDoc>
  );
}

const LEGAL_TABS = [
  ['mentions', 'Mentions légales', MentionsDoc],
  ['confidentialite', 'Confidentialité', ConfidentialiteDoc],
  ['cgv', 'CGV', CGVDoc],
];

function LegalScreen({ go, tab }) {
  const [active, setActive] = React.useState(tab || 'mentions');
  const Doc = (LEGAL_TABS.find(t=>t[0]===active) || LEGAL_TABS[0])[2];
  return (
    <div className="screen" style={{ paddingBottom:30 }}>
      <div className="sub-head">
        <button className="icon-btn" onClick={()=>go('profil')} aria-label="Retour"><Icon n="arrowLeft" size={22} /></button>
        <div style={{ flex:1 }}><b style={{ fontFamily:'var(--font-display)', fontSize:17 }}>Informations légales</b></div>
      </div>
      <div className="legal-tabs">
        {LEGAL_TABS.map(t=>(
          <button key={t[0]} className={`legal-tab ${active===t[0]?'on':''}`} onClick={()=>setActive(t[0])}>{t[1]}</button>
        ))}
      </div>
      <div style={{ padding:'4px 18px 0' }}><Doc /></div>
    </div>
  );
}

/* ---- Bandeau cookies / consentement ---- */
const COOKIE_KEY = 'tf_cookie_consent_v1';
function CookieBanner({ onOpenLegal }) {
  const [show, setShow] = React.useState(()=>{ try{ return !localStorage.getItem(COOKIE_KEY); }catch(e){ return true; } });
  if(!show) return null;
  function decide(v){ try{ localStorage.setItem(COOKIE_KEY, v); }catch(e){} setShow(false); }
  return (
    <div className="cookie-banner">
      <div className="cookie-body">
        <b className="cookie-title">🍪 Vos données vous appartiennent</b>
        <p className="cookie-text">
          Nous utilisons le strict nécessaire pour faire fonctionner l'app, et des mesures d'audience anonymes pour l'améliorer.
          {onOpenLegal && <> <button className="cookie-link" onClick={onOpenLegal}>En savoir plus</button></>}
        </p>
      </div>
      <div className="cookie-actions">
        <button className="btn btn--ghost cookie-btn" onClick={()=>decide('essential')}>Nécessaire uniquement</button>
        <button className="btn btn--primary cookie-btn" onClick={()=>decide('all')}>Tout accepter</button>
      </div>
    </div>
  );
}

Object.assign(window, { LegalScreen, CookieBanner, LEGAL_INFO });
