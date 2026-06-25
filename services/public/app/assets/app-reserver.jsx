/* TravelFamily.AI — Réservation directe.
   • ReserverHub : grille de cartes stylisées posée juste après le globe.
   • ReserverScreen : intake riche (routes filtrées, A/R, options) → résultats réels
     (Duffel vols, Google activités) ou UI premium « prête à brancher ». */

/* ── Aéroports de départ (multi-aéroports) ───────────── */
const RES_ORIGINS = [
  { code:'CDG', label:'Paris CDG' }, { code:'ORY', label:'Paris Orly' },
  { code:'MPL', label:'Montpellier' }, { code:'BCN', label:'Barcelone' },
  { code:'MRS', label:'Marseille' }, { code:'LYS', label:'Lyon' },
  { code:'NCE', label:'Nice' }, { code:'TLS', label:'Toulouse' },
  { code:'BOD', label:'Bordeaux' }, { code:'NTE', label:'Nantes' },
  { code:'GVA', label:'Genève' }, { code:'BRU', label:'Bruxelles' }, { code:'LUX', label:'Luxembourg' },
];

/* ── Affiliations (liens trackés réels) ──────────────────
   Revenu sur réservation partenaire. Remplacer/ajouter au fil des validations. */
const AFFILIATES = {
  getyourguide: { id:'Q2FL4D9', cmp:'share_to_earn' },
  discovercars: { aid:'TravelFamily' },
};
function gygUrl(city){
  const base = 'https://www.getyourguide.fr/s/';
  const q = new URLSearchParams({ q: city||'', partner_id: AFFILIATES.getyourguide.id, cmp: AFFILIATES.getyourguide.cmp });
  return base + '?' + q.toString();
}
function discoverCarsUrl(){
  return 'https://www.discovercars.com/?a_aid=' + encodeURIComponent(AFFILIATES.discovercars.aid);
}

/* Destinations dans le monde entier (IATA + coordonnées + région) pour vols / hôtels / activités. */
const REGION_ORDER = ['Europe','Maghreb','Moyen-Orient','Afrique & Océan Indien','Amériques','Asie','Océanie'];
const RES_DESTS = [
  // Europe
  { iata:'LIS', name:'Lisbonne',  country:'Portugal',  region:'Europe', lat:38.7223, lng:-9.1393 },
  { iata:'OPO', name:'Porto',     country:'Portugal',  region:'Europe', lat:41.1579, lng:-8.6291 },
  { iata:'FAO', name:'Algarve (Faro)', country:'Portugal', region:'Europe', lat:37.0194, lng:-7.9304 },
  { iata:'BCN', name:'Barcelone', country:'Espagne',   region:'Europe', lat:41.3874, lng:2.1686 },
  { iata:'MAD', name:'Madrid',    country:'Espagne',   region:'Europe', lat:40.4168, lng:-3.7038 },
  { iata:'AGP', name:'Malaga',    country:'Espagne',   region:'Europe', lat:36.7213, lng:-4.4214 },
  { iata:'PMI', name:'Majorque',  country:'Espagne',   region:'Europe', lat:39.5696, lng:2.6502 },
  { iata:'CTA', name:'Sicile (Catane)', country:'Italie', region:'Europe', lat:37.5079, lng:15.0830 },
  { iata:'NAP', name:'Naples',    country:'Italie',    region:'Europe', lat:40.8518, lng:14.2681 },
  { iata:'FCO', name:'Rome',      country:'Italie',    region:'Europe', lat:41.9028, lng:12.4964 },
  { iata:'VCE', name:'Venise',    country:'Italie',    region:'Europe', lat:45.4408, lng:12.3155 },
  { iata:'MXP', name:'Milan',     country:'Italie',    region:'Europe', lat:45.4642, lng:9.1900 },
  { iata:'ATH', name:'Athènes',   country:'Grèce',     region:'Europe', lat:37.9838, lng:23.7275 },
  { iata:'JMK', name:'Mykonos',   country:'Grèce',     region:'Europe', lat:37.4467, lng:25.3289 },
  { iata:'DBV', name:'Dubrovnik', country:'Croatie',   region:'Europe', lat:42.6507, lng:18.0944 },
  { iata:'LHR', name:'Londres',   country:'Royaume-Uni', region:'Europe', lat:51.5074, lng:-0.1278 },
  { iata:'AMS', name:'Amsterdam', country:'Pays-Bas',  region:'Europe', lat:52.3676, lng:4.9041 },
  { iata:'BER', name:'Berlin',    country:'Allemagne', region:'Europe', lat:52.5200, lng:13.4050 },
  { iata:'PRG', name:'Prague',    country:'Tchéquie',  region:'Europe', lat:50.0755, lng:14.4378 },
  { iata:'VIE', name:'Vienne',    country:'Autriche',  region:'Europe', lat:48.2082, lng:16.3738 },
  { iata:'CPH', name:'Copenhague',country:'Danemark',  region:'Europe', lat:55.6761, lng:12.5683 },
  { iata:'KEF', name:'Reykjavik', country:'Islande',   region:'Europe', lat:64.1466, lng:-21.9426 },
  { iata:'IST', name:'Istanbul',  country:'Turquie',   region:'Europe', lat:41.0082, lng:28.9784 },
  { iata:'GVA', name:'Annecy / Genève', country:'France/Suisse', region:'Europe', lat:45.8992, lng:6.1294 },
  // Maghreb
  { iata:'RAK', name:'Marrakech', country:'Maroc',     region:'Maghreb', lat:31.6295, lng:-7.9811 },
  { iata:'CMN', name:'Casablanca',country:'Maroc',     region:'Maghreb', lat:33.5731, lng:-7.5898 },
  { iata:'TUN', name:'Tunis',     country:'Tunisie',   region:'Maghreb', lat:36.8065, lng:10.1815 },
  { iata:'DJE', name:'Djerba',    country:'Tunisie',   region:'Maghreb', lat:33.8076, lng:10.8451 },
  // Moyen-Orient
  { iata:'DXB', name:'Dubaï',     country:'Émirats',   region:'Moyen-Orient', lat:25.2048, lng:55.2708 },
  { iata:'DOH', name:'Doha',      country:'Qatar',     region:'Moyen-Orient', lat:25.2854, lng:51.5310 },
  { iata:'AUH', name:'Abu Dhabi', country:'Émirats',   region:'Moyen-Orient', lat:24.4539, lng:54.3773 },
  // Afrique & Océan Indien
  { iata:'CAI', name:'Le Caire',  country:'Égypte',    region:'Afrique & Océan Indien', lat:30.0444, lng:31.2357 },
  { iata:'DKR', name:'Dakar',     country:'Sénégal',   region:'Afrique & Océan Indien', lat:14.7167, lng:-17.4677 },
  { iata:'NBO', name:'Nairobi',   country:'Kenya',     region:'Afrique & Océan Indien', lat:-1.2921, lng:36.8219 },
  { iata:'JNB', name:'Johannesburg', country:'Afrique du Sud', region:'Afrique & Océan Indien', lat:-26.2041, lng:28.0473 },
  { iata:'MRU', name:'Maurice',   country:'Maurice',   region:'Afrique & Océan Indien', lat:-20.1609, lng:57.5012 },
  { iata:'RUN', name:'La Réunion',country:'France',    region:'Afrique & Océan Indien', lat:-20.8789, lng:55.4481 },
  { iata:'SEZ', name:'Seychelles',country:'Seychelles',region:'Afrique & Océan Indien', lat:-4.6796, lng:55.4920 },
  { iata:'ZNZ', name:'Zanzibar',  country:'Tanzanie',  region:'Afrique & Océan Indien', lat:-6.1659, lng:39.2026 },
  // Amériques
  { iata:'JFK', name:'New York',  country:'États-Unis',region:'Amériques', lat:40.7128, lng:-74.0060 },
  { iata:'LAX', name:'Los Angeles',country:'États-Unis',region:'Amériques', lat:34.0522, lng:-118.2437 },
  { iata:'MIA', name:'Miami',     country:'États-Unis',region:'Amériques', lat:25.7617, lng:-80.1918 },
  { iata:'YUL', name:'Montréal',  country:'Canada',    region:'Amériques', lat:45.5019, lng:-73.5674 },
  { iata:'CUN', name:'Cancún',    country:'Mexique',   region:'Amériques', lat:21.1619, lng:-86.8515 },
  { iata:'MEX', name:'Mexico',    country:'Mexique',   region:'Amériques', lat:19.4326, lng:-99.1332 },
  { iata:'PUJ', name:'Punta Cana',country:'Rép. dom.', region:'Amériques', lat:18.5601, lng:-68.3725 },
  { iata:'HAV', name:'La Havane', country:'Cuba',      region:'Amériques', lat:23.1136, lng:-82.3666 },
  { iata:'GIG', name:'Rio de Janeiro', country:'Brésil', region:'Amériques', lat:-22.9068, lng:-43.1729 },
  { iata:'EZE', name:'Buenos Aires', country:'Argentine', region:'Amériques', lat:-34.6037, lng:-58.3816 },
  { iata:'LIM', name:'Lima',      country:'Pérou',     region:'Amériques', lat:-12.0464, lng:-77.0428 },
  { iata:'SJO', name:'San José',  country:'Costa Rica',region:'Amériques', lat:9.9281, lng:-84.0907 },
  // Asie
  { iata:'BKK', name:'Bangkok',   country:'Thaïlande', region:'Asie', lat:13.7563, lng:100.5018 },
  { iata:'HKT', name:'Phuket',    country:'Thaïlande', region:'Asie', lat:7.8804, lng:98.3923 },
  { iata:'DPS', name:'Bali',      country:'Indonésie', region:'Asie', lat:-8.4095, lng:115.1889 },
  { iata:'SIN', name:'Singapour', country:'Singapour', region:'Asie', lat:1.3521, lng:103.8198 },
  { iata:'KUL', name:'Kuala Lumpur', country:'Malaisie', region:'Asie', lat:3.1390, lng:101.6869 },
  { iata:'HAN', name:'Hanoï',     country:'Vietnam',   region:'Asie', lat:21.0278, lng:105.8342 },
  { iata:'NRT', name:'Tokyo',     country:'Japon',     region:'Asie', lat:35.6762, lng:139.6503 },
  { iata:'ICN', name:'Séoul',     country:'Corée du Sud', region:'Asie', lat:37.5665, lng:126.9780 },
  { iata:'DEL', name:'Delhi',     country:'Inde',      region:'Asie', lat:28.6139, lng:77.2090 },
  { iata:'MLE', name:'Maldives',  country:'Maldives',  region:'Asie', lat:4.1755, lng:73.5093 },
  { iata:'CMB', name:'Colombo',   country:'Sri Lanka', region:'Asie', lat:6.9271, lng:79.8612 },
  // Océanie
  { iata:'SYD', name:'Sydney',    country:'Australie', region:'Océanie', lat:-33.8688, lng:151.2093 },
  { iata:'AKL', name:'Auckland',  country:'Nouvelle-Zélande', region:'Océanie', lat:-36.8485, lng:174.7633 },
  { iata:'PPT', name:'Tahiti',    country:'Polynésie', region:'Océanie', lat:-17.5516, lng:-149.5585 },
];
const RES_DEST_BY = Object.fromEntries(RES_DESTS.map(d=>[d.iata,d]));

/* Réseau réaliste : grands hubs desservent le monde ; petits aéroports surtout l'Europe.
   On ne fige plus une liste à la mode — tout le monde est accessible depuis un hub. */
const HUB_ALL = new Set(['CDG','ORY','BRU']);                 // monde entier
const HUB_WIDE = new Set(['LYS','NCE','MRS','GVA']);          // Europe+Maghreb+M-O + long-courriers populaires
const POPULAR_LONGHAUL = new Set(['JFK','MIA','CUN','DXB','DOH','BKK','HKT','DPS','MRU','RUN','PUJ','SEZ','NRT']);
const NEAR_REGIONS = new Set(['Europe','Maghreb','Moyen-Orient']);
/* Toutes les destinations sont réservables depuis tout aéroport (Duffel assemble les escales).
   On distingue seulement vol DIRECT vs itinéraire AVEC ESCALE. */
function flightDestsFor(origin){
  return RES_DESTS.filter(d=>d.iata!==origin);
}
function flightIsDirect(origin, d){
  if(!d) return true;
  if(HUB_ALL.has(origin)) return true;
  if(HUB_WIDE.has(origin)) return NEAR_REGIONS.has(d.region) || POPULAR_LONGHAUL.has(d.iata);
  return d.region==='Europe' || d.region==='Maghreb';
}
/* <optgroup> par région pour un select de destinations. */
function GroupedDestOptions({ dests }){
  const by = {}; dests.forEach(d=>{ (by[d.region]=by[d.region]||[]).push(d); });
  return REGION_ORDER.filter(r=>by[r]).map(r=>(
    <optgroup key={r} label={r}>{by[r].map(d=><option key={d.iata} value={d.iata}>{d.name} ({d.iata})</option>)}</optgroup>
  ));
}

/* Ports ferry + routes valides (traversées réelles). */
const FERRY_ROUTES = {
  'Marseille':['Bastia','Ajaccio','Porto-Vecchio','Tanger Med','Palma de Majorque'],
  'Toulon':['Bastia','Ajaccio','Porto-Vecchio','Calvi'],
  'Nice':['Bastia','Ajaccio','Calvi'],
  'Sète':['Tanger Med','Palma de Majorque'],
  'Barcelone':['Palma de Majorque','Civitavecchia (Rome)','Gênes','Tanger Med','Algésiras'],
  'Gênes':['Bastia','Palma de Majorque','Barcelone','Tanger Med'],
  'Civitavecchia (Rome)':['Barcelone','Palma de Majorque'],
  'Bastia':['Marseille','Toulon','Nice','Gênes'],
  'Ajaccio':['Marseille','Toulon','Nice'],
  'Calvi':['Toulon','Nice'],
  'Porto-Vecchio':['Marseille','Toulon'],
  'Palma de Majorque':['Barcelone','Marseille','Sète','Gênes','Civitavecchia (Rome)'],
  'Tanger Med':['Marseille','Sète','Barcelone','Gênes','Algésiras'],
  'Algésiras':['Tanger Med','Barcelone'],
};
const FERRY_PORTS = Object.keys(FERRY_ROUTES);

/* Gares & villes location. */
const RES_STATIONS = ['Paris','Lyon','Marseille','Montpellier','Bordeaux','Lille','Nantes','Strasbourg','Nice','Toulouse','Rennes','Genève','Bruxelles','Londres','Barcelone','Milan'];
/* Villes location voiture + pays (pour règle permis international). */
const CAR_CITIES = [
  ['Paris','France'],['Lyon','France'],['Marseille','France'],['Nice','France'],['Montpellier','France'],
  ['Bordeaux','France'],['Toulouse','France'],['Genève','Suisse'],['Lisbonne','Portugal'],['Barcelone','Espagne'],
  ['Malaga','Espagne'],['Rome','Italie'],['Naples','Italie'],['Athènes','Grèce'],['Marrakech','Maroc'],
];
const CAR_INTL_PERMIT = new Set(['Maroc']); // permis international requis
const CAR_CATS = ['Citadine','Compacte','Familiale','Monospace 7 places','SUV','Premium / automatique'];

/* ── Pays du monde (formalités) ──────────────────────── */
/* grp = exigence pour un voyageur FR/UE : schengen | eu | visafree | eta | evisa | voa | visa */
/* h = vigilance santé (zone tropicale / vaccins conseillés) */
const COUNTRIES = [
  ['FR','🇫🇷 France','schengen'],['DE','🇩🇪 Allemagne','schengen'],['ES','🇪🇸 Espagne','schengen'],
  ['IT','🇮🇹 Italie','schengen'],['PT','🇵🇹 Portugal','schengen'],['BE','🇧🇪 Belgique','schengen'],
  ['NL','🇳🇱 Pays-Bas','schengen'],['CH','🇨🇭 Suisse','schengen'],['AT','🇦🇹 Autriche','schengen'],
  ['GR','🇬🇷 Grèce','schengen'],['HR','🇭🇷 Croatie','schengen'],['PL','🇵🇱 Pologne','schengen'],
  ['SE','🇸🇪 Suède','schengen'],['NO','🇳🇴 Norvège','schengen'],['IS','🇮🇸 Islande','schengen'],
  ['LU','🇱🇺 Luxembourg','schengen'],['IE','🇮🇪 Irlande','eu'],
  ['GB','🇬🇧 Royaume-Uni','eta'],['US','🇺🇸 États-Unis','eta',],['CA','🇨🇦 Canada','eta'],
  ['MA','🇲🇦 Maroc','visafree',true],['TN','🇹🇳 Tunisie','visafree'],['SN','🇸🇳 Sénégal','visafree',true],
  ['TR','🇹🇷 Turquie','visafree'],['RS','🇷🇸 Serbie','visafree'],['AL','🇦🇱 Albanie','visafree'],
  ['ME','🇲🇪 Monténégro','visafree'],['JP','🇯🇵 Japon','visafree'],['KR','🇰🇷 Corée du Sud','eta'],
  ['SG','🇸🇬 Singapour','visafree'],['MX','🇲🇽 Mexique','visafree',true],['BR','🇧🇷 Brésil','visafree',true],
  ['AR','🇦🇷 Argentine','visafree'],['CL','🇨🇱 Chili','visafree'],['ZA','🇿🇦 Afrique du Sud','visafree',true],
  ['MU','🇲🇺 Maurice','visafree',true],['MV','🇲🇻 Maldives','voa',true],['TH','🇹🇭 Thaïlande','visafree',true],
  ['ID','🇮🇩 Indonésie','voa',true],['VN','🇻🇳 Vietnam','evisa',true],['LK','🇱🇰 Sri Lanka','eta',true],
  ['EG','🇪🇬 Égypte','evisa',true],['KE','🇰🇪 Kenya','eta',true],['TZ','🇹🇿 Tanzanie','voa',true],
  ['AE','🇦🇪 Émirats arabes unis','visafree'],['JO','🇯🇴 Jordanie','voa'],['IL','🇮🇱 Israël','visafree'],
  ['IN','🇮🇳 Inde','evisa',true],['CN','🇨🇳 Chine','visa'],['RU','🇷🇺 Russie','visa'],
  ['AU','🇦🇺 Australie','eta'],['NZ','🇳🇿 Nouvelle-Zélande','eta'],['CU','🇨🇺 Cuba','visa',true],
  ['DO','🇩🇴 Rép. dominicaine','visafree',true],['CR','🇨🇷 Costa Rica','visafree',true],
  ['PE','🇵🇪 Pérou','visafree',true],['CO','🇨🇴 Colombie','visafree',true],['NG','🇳🇬 Nigeria','visa',true],
];
const NAT_LIST = [
  ['FR','🇫🇷 France'],['BE','🇧🇪 Belgique'],['CH','🇨🇭 Suisse'],['LU','🇱🇺 Luxembourg'],
  ['CA','🇨🇦 Canada'],['GB','🇬🇧 Royaume-Uni'],['DE','🇩🇪 Allemagne'],['ES','🇪🇸 Espagne'],
  ['IT','🇮🇹 Italie'],['PT','🇵🇹 Portugal'],['US','🇺🇸 États-Unis'],['MA','🇲🇦 Maroc'],
  ['DZ','🇩🇿 Algérie'],['TN','🇹🇳 Tunisie'],['SN','🇸🇳 Sénégal'],
];
const EU_NAT = new Set(['FR','BE','CH','LU','DE','ES','IT','PT','NL','AT','GR','IE','PL','SE','NO','IS','HR']);

function formalityRules(natCode, c){
  const [code,label,grp,health] = c;
  const isEU = EU_NAT.has(natCode);
  const out = [];
  // Document + visa selon le groupe (cas voyageur UE ; non-UE → vérification requise)
  if(grp==='schengen'){
    if(isEU){
      out.push({ k:'doc', status:'green', title:'Pièce d\'identité', detail:'CNI ou passeport en cours de validité — libre circulation Schengen.' });
      out.push({ k:'visa', status:'green', title:'Visa', detail:'Aucun visa requis dans l\'espace Schengen.' });
    } else {
      out.push({ k:'doc', status:'orange', title:'Passeport', detail:'Passeport valide requis.' });
      out.push({ k:'visa', status:'orange', title:'Visa Schengen', detail:'Selon votre nationalité, un visa Schengen court séjour peut être exigé.' });
    }
  } else if(grp==='eu'){
    out.push({ k:'doc', status: isEU?'green':'orange', title:'Pièce d\'identité', detail: isEU?'CNI ou passeport valide.':'Passeport valide requis.' });
    out.push({ k:'visa', status:'green', title:'Visa', detail:'Court séjour touristique sans visa.' });
  } else if(grp==='eta'){
    out.push({ k:'doc', status:'orange', title:'Passeport', detail:'Passeport valide requis (souvent 6 mois après le retour).' });
    out.push({ k:'visa', status:'orange', title:'Autorisation électronique (ESTA/ETA/AVE)', detail:'Pas de visa, mais une autorisation en ligne payante à obtenir AVANT le départ.' });
  } else if(grp==='evisa'){
    out.push({ k:'doc', status:'orange', title:'Passeport', detail:'Passeport valide 6 mois + page vierge.' });
    out.push({ k:'visa', status:'orange', title:'e-Visa', detail:'Visa électronique à demander en ligne avant le voyage.' });
  } else if(grp==='voa'){
    out.push({ k:'doc', status:'orange', title:'Passeport', detail:'Passeport valide 6 mois + page vierge.' });
    out.push({ k:'visa', status:'orange', title:'Visa à l\'arrivée (VOA)', detail:'Visa délivré à l\'arrivée (payant) ou e-VOA en ligne avant le départ.' });
  } else if(grp==='visafree'){
    out.push({ k:'doc', status:'orange', title:'Passeport', detail:'Passeport valide requis (durée résiduelle à vérifier).' });
    out.push({ k:'visa', status: isEU?'green':'orange', title:'Visa', detail: isEU?'Séjour touristique court sans visa.':'À vérifier selon votre nationalité.' });
  } else { // visa
    out.push({ k:'doc', status:'orange', title:'Passeport', detail:'Passeport valide requis.' });
    out.push({ k:'visa', status:'red', title:'Visa obligatoire', detail:'Visa à obtenir avant le départ (consulat / e-visa). Délais possibles — anticipez.' });
  }
  // Santé
  if(health) out.push({ k:'health', status:'orange', title:'Santé', detail:'Vaccins universels à jour ; selon zones : hépatite A/typhoïde conseillés, parfois fièvre jaune ou anti-paludéen. Demandez conseil avant le départ.' });
  else out.push({ k:'health', status:'green', title:'Santé', detail:'Aucun vaccin obligatoire. Couverture santé voyage conseillée.' });
  // Enfants
  out.push({ k:'kids', status:'orange', title:'Enfants mineurs', detail:'Document d\'identité individuel obligatoire. Autorisation de sortie de territoire (AST) si l\'enfant voyage sans l\'un de ses parents.' });
  return out;
}

/* ── Hub de cartes ───────────────────────────────────── */
const RESERVER_MODES = [
  { mode:'vol',        icon:'plane',   tone:'ocean', title:'Vol',            sub:'Aller, A/R ou multi · devis réel' },
  { mode:'hotel',      icon:'bed',     tone:'turq',  title:'Hôtel',          sub:'Ville, dates, voyageurs' },
  { mode:'train',      icon:'train',   tone:'gold',  title:'Train',          sub:'Gare → gare, A/R' },
  { mode:'bateau',     icon:'anchor',  tone:'ocean', title:'Bateau / Ferry', sub:'Traversée, véhicule, cabine' },
  { mode:'voiture',    icon:'car',     tone:'turq',  title:'Location voiture', sub:'Ville, catégorie, A/R' },
  { mode:'activites',  icon:'compass', tone:'coral', title:'Activités',      sub:'Date, voyageurs · temps réel' },
  { mode:'formalites', icon:'shield',  tone:'gold',  title:'Formalités',     sub:'Visa & passeport · monde entier' },
];

function ReserverHub({ openReserver, openChat }) {
  return (
    <div style={{ padding:'4px 18px 4px' }}>
      <div className="res-eyebrow"><Icon n="grid" size={13} />Réserver soi-même</div>
      <h3 style={{ fontSize:19, marginTop:6 }}>Que voulez-vous réserver&nbsp;?</h3>
      <p className="micro" style={{ color:'var(--text-2)', margin:'4px 0 14px', lineHeight:1.5 }}>
        Vous savez ce que vous cherchez&nbsp;? Choisissez et réservez en quelques étapes. Sinon, <b style={{ color:'var(--ocean-700)', cursor:'pointer' }} onClick={()=>openChat&&openChat('home')}>demandez conseil à Webbina.</b>
      </p>
      <div className="res-grid">
        {RESERVER_MODES.map(m=>(
          <button key={m.mode} className="res-card" onClick={()=>openReserver(m.mode)}>
            <span className={`res-ic u-${m.tone}`}><Icon n={m.icon} size={22} /></span>
            <span className="res-meta">
              <b>{m.title}</b>
              <span className="res-sub">{m.sub}</span>
            </span>
            <Icon n="chevronRight" size={18} style={{ color:'var(--text-muted)', flex:'none' }} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Contrôles ───────────────────────────────────────── */
const resInput = { width:'100%', padding:'12px 14px', borderRadius:'var(--r-md)', border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:15, fontFamily:'inherit', WebkitAppearance:'none', appearance:'none' };
function Field({ label, children }){
  return (
    <label style={{ display:'block' }}>
      <span className="micro" style={{ display:'block', marginBottom:6, fontWeight:700, color:'var(--text-2)' }}>{label}</span>
      {children}
    </label>
  );
}
function Stepper({ label, value, set, min=0, max=9 }){
  return (
    <div className="row between" style={{ alignItems:'center', padding:'10px 4px' }}>
      <span style={{ fontSize:14.5, color:'var(--text)' }}>{label}</span>
      <div className="pkg-step">
        <button type="button" onClick={()=>set(Math.max(min,value-1))} aria-label="moins">−</button>
        <b style={{ minWidth:22, textAlign:'center' }}>{value}</b>
        <button type="button" onClick={()=>set(Math.min(max,value+1))} aria-label="plus">+</button>
      </div>
    </div>
  );
}
function Segmented({ value, set, options }){
  return (
    <div className="res-seg">
      {options.map(([v,l])=>(
        <button key={v} type="button" className={value===v?'on':''} onClick={()=>set(v)}>{l}</button>
      ))}
    </div>
  );
}

/* ── Écran de réservation directe ────────────────────── */
function ReserverScreen({ mode, go, book }){
  const meta = RESERVER_MODES.find(m=>m.mode===mode) || RESERVER_MODES[0];
  return (
    <div className="screen" style={{ paddingBottom:30 }}>
      <div className="sub-head">
        <button className="icon-btn" onClick={()=>go('home')} aria-label="Retour"><Icon n="arrowLeft" size={22} /></button>
        <div style={{ flex:1 }}>
          <b style={{ fontFamily:'var(--font-display)', fontSize:17 }}>Réserver · {meta.title}</b>
          <div className="micro">{meta.sub}</div>
        </div>
        <span className={`res-ic u-${meta.tone}`} style={{ width:40, height:40 }}><Icon n={meta.icon} size={20} /></span>
      </div>
      <div style={{ padding:'16px 16px 0' }}>
        {mode==='vol' && <VolIntake book={book} go={go} />}
        {mode==='hotel' && <HotelIntake />}
        {mode==='activites' && <ActIntake />}
        {mode==='formalites' && <FormalitesTool />}
        {mode==='train' && <SoonIntake mode="train" />}
        {mode==='bateau' && <SoonIntake mode="bateau" />}
        {mode==='voiture' && <CarIntake />}
      </div>
    </div>
  );
}

function defaultDep(){ const d=new Date(); d.setDate(d.getDate()+42); return d.toISOString().slice(0,10); }
function defaultRet(){ const d=new Date(); d.setDate(d.getDate()+49); return d.toISOString().slice(0,10); }

/* VOL : type de trajet + routes filtrées + A/R → VolsTab réel */
function VolIntake({ book, go }){
  const [tripType, setTripType] = React.useState('rt'); // ow | rt | multi
  const [origin, setOrigin] = React.useState(()=>{ try{ return localStorage.getItem('tf_deal_origin')||'CDG'; }catch(e){ return 'CDG'; } });
  const dests = React.useMemo(()=>flightDestsFor(origin), [origin]);
  const [destIata, setDestIata] = React.useState(()=>dests[0] && dests[0].iata || 'LIS');
  const [dep, setDep] = React.useState(defaultDep());
  const [ret, setRet] = React.useState(defaultRet());
  const [adults, setAdults] = React.useState(2);
  const [children, setChildren] = React.useState(2);
  const [go_, setGo] = React.useState(false);
  // Multi-destinations : liste de segments
  const [segs, setSegs] = React.useState([{ from:origin, to:(dests[1]&&dests[1].iata)||(dests[0]&&dests[0].iata), date:defaultDep() }]);

  // si l'origine change, la destination doit rester desservie
  React.useEffect(()=>{ if(!dests.find(d=>d.iata===destIata)){ setDestIata(dests[0] && dests[0].iata); setGo(false); } }, [origin]);

  const dest = React.useMemo(()=>{ const d=RES_DEST_BY[destIata]||RES_DESTS[0]; return { id:'res-'+d.iata, iata:d.iata, name:d.name, country:d.country, lat:d.lat, lng:d.lng, nights:7, _dealOrigin:origin, _depDate:dep, _retDate: tripType==='rt'?ret:undefined, _pax:adults+children, _kids:children }; }, [destIata,origin,dep,ret,tripType,adults,children]);
  function submit(){ try{ localStorage.setItem('tf_deal_origin', origin); }catch(e){} setGo(true); }

  const segFrom = (i)=> i===0 ? RES_ORIGINS.map(o=>[o.code,o.label]) : flightDestsFor(segs[i-1].to).map(d=>[d.iata,d.name]);
  function setSeg(i,k,v){ setSegs(s=>s.map((x,j)=> j===i?{...x,[k]:v}:x)); }
  function addSeg(){ setSegs(s=>{ const last=s[s.length-1]; const opts=flightDestsFor(last.to); return [...s,{ from:last.to, to:(opts[0]&&opts[0].iata)||last.to, date:last.date }]; }); }
  function rmSeg(i){ setSegs(s=> s.length>1 ? s.filter((_,j)=>j!==i) : s); }

  return (
    <React.Fragment>
      <div className="res-form">
        <Segmented value={tripType} set={(v)=>{setTripType(v); setGo(false);}} options={[['ow','Aller simple'],['rt','Aller-retour'],['multi','Multi-destinations']]} />

        {tripType!=='multi' && (
          <React.Fragment>
            <div className="row gap3">
              <Field label="Départ"><select style={resInput} value={origin} onChange={e=>{setOrigin(e.target.value); setGo(false);}}>{RES_ORIGINS.map(o=><option key={o.code} value={o.code}>{o.label} ({o.code})</option>)}</select></Field>
              <Field label="Arrivée"><select style={resInput} value={destIata} onChange={e=>{setDestIata(e.target.value); setGo(false);}}><GroupedDestOptions dests={dests} /></select></Field>
            </div>
            <p className="micro" style={{ color: flightIsDirect(origin, RES_DEST_BY[destIata])?'var(--success)':'var(--text-muted)', margin:'-4px 2px 0', lineHeight:1.4 }}>{flightIsDirect(origin, RES_DEST_BY[destIata])
              ? <span><Icon n="check" size={12} /> Vol direct disponible depuis {RES_ORIGINS.find(o=>o.code===origin).label}.</span>
              : <span>Pas de vol direct depuis {RES_ORIGINS.find(o=>o.code===origin).label} — <b>itinéraire avec escale</b> (Duffel optimise les correspondances).</span>}</p>
            <div className="row gap3">
              <Field label="Départ"><input type="date" style={resInput} value={dep} onChange={e=>{setDep(e.target.value); setGo(false);}} /></Field>
              {tripType==='rt' && <Field label="Retour"><input type="date" style={resInput} value={ret} min={dep} onChange={e=>{setRet(e.target.value); setGo(false);}} /></Field>}
            </div>
          </React.Fragment>
        )}

        {tripType==='multi' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {segs.map((s,i)=>(
              <div key={i} className="res-seg-row">
                <div className="row between" style={{ marginBottom:8 }}>
                  <b style={{ fontFamily:'var(--font-display)', fontSize:13.5 }}>Vol {i+1}</b>
                  {segs.length>1 && <button type="button" className="res-seg-rm" onClick={()=>rmSeg(i)}><Icon n="x" size={14} />Retirer</button>}
                </div>
                <div className="row gap3">
                  <Field label="De"><select style={resInput} value={s.from} onChange={e=>setSeg(i,'from',e.target.value)}>{segFrom(i).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
                  <Field label="Vers"><select style={resInput} value={s.to} onChange={e=>setSeg(i,'to',e.target.value)}><GroupedDestOptions dests={flightDestsFor(s.from)} /></select></Field>
                </div>
                <Field label="Date"><input type="date" style={resInput} value={s.date} onChange={e=>setSeg(i,'date',e.target.value)} /></Field>
              </div>
            ))}
            {segs.length<4 && <button type="button" className="res-add" onClick={addSeg}><Icon n="plus" size={16} />Ajouter un vol</button>}
          </div>
        )}

        <div className="res-pax">
          <Stepper label="Adultes" value={adults} set={setAdults} min={1} />
          <Stepper label="Enfants" value={children} set={setChildren} min={0} />
        </div>
        <button className="btn btn--primary btn--block" onClick={()=>{ if(tripType==='multi'){ setGo(true); } else { submit(); } }}><Icon n="search" size={18} />{tripType==='multi'?'Préparer le multi-destinations':'Voir les vols réels'}</button>
      </div>

      {go_ && tripType!=='multi' && <div style={{ marginTop:16 }}>
        {tripType==='rt' && <div className="micro" style={{ color:'var(--text-muted)', padding:'0 2px 8px' }}><Icon n="check" size={13} style={{ color:'var(--success)' }} /> Aller-retour · retour le {new Date(ret).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</div>}
        <VolsTab dest={dest} book={book} />
      </div>}

      {go_ && tripType==='multi' && (
        <div style={{ marginTop:16 }}>
          <div className="webbina-reco" style={{ marginBottom:12 }}>
            <Avatar size={28} expr="enthusiastic" />
            <div className="micro" style={{ lineHeight:1.5, color:'var(--text-2)' }}>Votre itinéraire multi-destinations est prêt. Je vérifie que chaque correspondance tombe juste et j'assemble le meilleur prix pour l'ensemble. ✨</div>
          </div>
          <div className="card card--pad" style={{ marginBottom:12 }}>
            {segs.map((s,i)=>{ const f=RES_ORIGINS.find(o=>o.code===s.from)||RES_DEST_BY[s.from]; const t=RES_DEST_BY[s.to]; return (
              <div key={i} className="row gap3" style={{ alignItems:'center', padding:'8px 0', borderBottom: i<segs.length-1?'1px solid var(--border)':'none' }}>
                <span className="res-ic u-ocean" style={{ width:34, height:34 }}><Icon n="plane" size={16} /></span>
                <div style={{ flex:1 }}>
                  <b style={{ fontFamily:'var(--font-display)', fontSize:14 }}>{(f&&(f.label||f.name))||s.from} → {(t&&t.name)||s.to}</b>
                  <div className="micro">{new Date(s.date).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'})}</div>
                </div>
              </div>
            ); })}
          </div>
          <button className="btn btn--primary btn--block" onClick={()=>go && go('chat')}><Icon n="sparkles" size={18} />Faire assembler par Webbina</button>
          <p className="micro" style={{ textAlign:'center', color:'var(--text-muted)', marginTop:8 }}>Le multi-destinations combine plusieurs compagnies — Webbina optimise prix et correspondances pour vous.</p>
        </div>
      )}
    </React.Fragment>
  );
}

/* HÔTEL → HotelsTab réel */
function HotelIntake(){
  const [destIata, setDestIata] = React.useState('LIS');
  const [dep, setDep] = React.useState(defaultDep());
  const [nights, setNights] = React.useState(5);
  const [adults, setAdults] = React.useState(2);
  const [children, setChildren] = React.useState(2);
  const [go, setGo] = React.useState(false);
  const dest = React.useMemo(()=>{ const d=RES_DEST_BY[destIata]||RES_DESTS[0]; return { id:'resh-'+d.iata, iata:d.iata, name:d.name, country:d.country, lat:d.lat, lng:d.lng, nights, _depDate:dep, _pax:adults+children, _kids:children }; }, [destIata,dep,nights,adults,children]);
  return (
    <React.Fragment>
      <div className="res-form">
        <Field label="Ville / destination"><select style={resInput} value={destIata} onChange={e=>{setDestIata(e.target.value); setGo(false);}}><GroupedDestOptions dests={RES_DESTS} /></select></Field>
        <div className="row gap3">
          <Field label="Arrivée"><input type="date" style={resInput} value={dep} onChange={e=>{setDep(e.target.value); setGo(false);}} /></Field>
          <Field label="Nuits"><select style={resInput} value={nights} onChange={e=>{setNights(+e.target.value); setGo(false);}}>{[2,3,4,5,6,7,8,10,14].map(n=><option key={n} value={n}>{n} nuits</option>)}</select></Field>
        </div>
        <div className="res-pax">
          <Stepper label="Adultes" value={adults} set={setAdults} min={1} />
          <Stepper label="Enfants" value={children} set={setChildren} min={0} />
        </div>
        <button className="btn btn--primary btn--block" onClick={()=>setGo(true)}><Icon n="search" size={18} />Voir les hébergements</button>
      </div>
      {go && <div style={{ marginTop:16 }}><HotelsTab dest={dest} /></div>}
    </React.Fragment>
  );
}

/* ACTIVITÉS : date + voyageurs → Google Places réel (+ GetYourGuide à brancher) */
function ActIntake(){
  const [destIata, setDestIata] = React.useState('LIS');
  const [date, setDate] = React.useState(defaultDep());
  const [adults, setAdults] = React.useState(2);
  const [children, setChildren] = React.useState(2);
  const [go, setGo] = React.useState(false);
  const dest = React.useMemo(()=>{ const d=RES_DEST_BY[destIata]||RES_DESTS[0]; return { id:'resa-'+d.iata, name:d.name, country:d.country, lat:d.lat, lng:d.lng }; }, [destIata]);
  return (
    <React.Fragment>
      <div className="res-form">
        <Field label="Où cherchez-vous des activités ?"><select style={resInput} value={destIata} onChange={e=>{setDestIata(e.target.value); setGo(false);}}><GroupedDestOptions dests={RES_DESTS} /></select></Field>
        <Field label="Date"><input type="date" style={resInput} value={date} onChange={e=>{setDate(e.target.value); setGo(false);}} /></Field>
        <div className="res-pax">
          <Stepper label="Adultes" value={adults} set={setAdults} min={1} />
          <Stepper label="Enfants" value={children} set={setChildren} min={0} />
        </div>
        <button className="btn btn--primary btn--block" onClick={()=>setGo(true)}><Icon n="search" size={18} />Trouver des activités</button>
      </div>
      {go && (
        <div style={{ marginTop:16 }}>
          <div className="ai-note" style={{ background:'var(--surface)', border:'1px solid var(--warning-border)', marginBottom:12 }}>
            <Icon n="info" size={16} style={{ color:'var(--warning)', flex:'none', marginTop:2 }} />
            <div className="micro" style={{ color:'var(--text-2)', lineHeight:1.45 }}>Idées d'activités <b>en temps réel</b> près de {dest.name} pour {adults+children} personne{adults+children>1?'s':''}. Réservez vos billets datés sur <b>GetYourGuide</b>. 💙</div>
          </div>
          <ActivitiesSection dest={dest} />
          <a className="btn btn--primary btn--block" href={gygUrl(dest.name)} target="_blank" rel="noopener" style={{ marginTop:12, textDecoration:'none' }}><Icon n="star" size={18} />Réserver des activités à {dest.name}</a>
          <p className="micro" style={{ textAlign:'center', color:'var(--text-muted)', marginTop:6 }}>Billets réservables sur GetYourGuide · annulation gratuite sur la plupart des activités.</p>
        </div>
      )}
    </React.Fragment>
  );
}

/* VOITURE : retour (même ville ou autre) + catégorie + alertes permis/CB */
function CarIntake(){
  const [pickup, setPickup] = React.useState('Paris');
  const [sameReturn, setSameReturn] = React.useState(true);
  const [dropoff, setDropoff] = React.useState('Lyon');
  const [dep, setDep] = React.useState(defaultDep());
  const [ret, setRet] = React.useState(defaultRet());
  const [cat, setCat] = React.useState('Familiale');
  const [show, setShow] = React.useState(false);
  const pickupCountry = (CAR_CITIES.find(c=>c[0]===pickup)||[])[1] || 'France';
  const needIntl = CAR_INTL_PERMIT.has(pickupCountry);
  return (
    <React.Fragment>
      {/* alertes essentielles AVANT la recherche */}
      <div className="card card--pad" style={{ borderLeft:'4px solid var(--error)', marginBottom:14, background:'var(--error-bg)', borderColor:'var(--error-border)' }}>
        <div className="row gap2" style={{ alignItems:'center', marginBottom:8 }}><Icon n="info" size={16} style={{ color:'var(--error)' }} /><b style={{ fontFamily:'var(--font-display)', fontSize:14.5, color:'var(--error)' }}>À savoir avant de réserver</b></div>
        <div className="micro" style={{ color:'var(--text-2)', lineHeight:1.55 }}>
          <div className="row gap2" style={{ alignItems:'flex-start', marginBottom:6 }}><StatusDot status="red" size={9} /><span><b>Carte de crédit obligatoire</b> au nom du conducteur (empreinte de caution). Une carte de débit / prépayée est souvent refusée à la prise en charge.</span></div>
          <div className="row gap2" style={{ alignItems:'flex-start' }}><StatusDot status={needIntl?'red':'green'} size={9} /><span>{needIntl ? <span><b>Permis de conduire international requis</b> en plus du permis national pour {pickupCountry}.</span> : <span>Permis national suffisant pour {pickupCountry} (permis international non requis).</span>}</span></div>
        </div>
      </div>

      <div className="res-form">
        <Field label="Ville de prise en charge"><select style={resInput} value={pickup} onChange={e=>{setPickup(e.target.value); setShow(false);}}>{CAR_CITIES.map(([c])=><option key={c} value={c}>{c}</option>)}</select></Field>
        <label className="res-toggle">
          <input type="checkbox" checked={sameReturn} onChange={e=>{setSameReturn(e.target.checked); setShow(false);}} />
          <span>Restituer la voiture dans la même ville</span>
        </label>
        {!sameReturn && <Field label="Ville de restitution"><select style={resInput} value={dropoff} onChange={e=>{setDropoff(e.target.value); setShow(false);}}>{CAR_CITIES.filter(([c])=>c!==pickup).map(([c])=><option key={c} value={c}>{c}</option>)}</select></Field>}
        <div className="row gap3">
          <Field label="Prise en charge"><input type="date" style={resInput} value={dep} onChange={e=>{setDep(e.target.value); setShow(false);}} /></Field>
          <Field label="Restitution"><input type="date" style={resInput} value={ret} min={dep} onChange={e=>{setRet(e.target.value); setShow(false);}} /></Field>
        </div>
        <Field label="Catégorie de véhicule"><select style={resInput} value={cat} onChange={e=>{setCat(e.target.value); setShow(false);}}>{CAR_CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></Field>
        <button className="btn btn--primary btn--block" onClick={()=>setShow(true)}><Icon n="search" size={18} />Voir les voitures</button>
      </div>

      {show && (
        <div style={{ marginTop:16 }}>
          <div className="ai-note" style={{ background:'var(--surface)', border:'1px solid var(--warning-border)', marginBottom:12 }}>
            <Icon n="info" size={16} style={{ color:'var(--warning)', flex:'none', marginTop:2 }} />
            <div className="micro" style={{ color:'var(--text-2)', lineHeight:1.45 }}><b>{pickup}</b>{sameReturn?'':` → ${dropoff}`} · {cat} · comparez et réservez sur <b>Discover Cars</b> (assurance + annulation gratuite incluses). Prix indicatifs ci-dessous. 💙</div>
          </div>
          {[0,1,2].map(i=>(
            <div key={i} className="compare-card" style={{ cursor:'default' }}>
              <div className="row between">
                <div className="row gap3">
                  <span className="res-ic u-turq" style={{ width:44, height:44 }}><Icon n="car" size={20} /></span>
                  <div>
                    <b style={{ fontFamily:'var(--font-display)', fontSize:15 }}>{cat} {['ou similaire','automatique','+ GPS'][i]}</b>
                    <div className="micro">{['Annulation gratuite','Siège enfant dispo','Kilométrage illimité'][i]}</div>
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <b style={{ fontFamily:'var(--font-display)', fontSize:17, color:'var(--text-muted)' }}>dès {[34,42,58][i]} €</b>
                  <div className="micro">/ jour · estimatif</div>
                </div>
              </div>
            </div>
          ))}
          <div className="uni-providers" style={{ marginTop:6 }}>
            <span className="micro">Partenaires :</span>
            {['Discover Cars','Rentalcars','Hertz','Europcar'].map(p=><span key={p} className="uni-prov">{p}</span>)}
          </div>
          <a className="btn btn--primary btn--block" href={discoverCarsUrl()} target="_blank" rel="noopener" style={{ marginTop:12, textDecoration:'none' }}><Icon n="car" size={18} />Réserver sur Discover Cars</a>
          <p className="micro" style={{ textAlign:'center', color:'var(--text-muted)', marginTop:6 }}>Comparateur mondial · annulation gratuite · assurance tous risques en option.</p>
        </div>
      )}
    </React.Fragment>
  );
}

/* TRAIN / BATEAU : intake réel (routes valides, options) + résultats premium « prêts à brancher » */
function SoonIntake({ mode }){
  const isBoat = mode==='bateau';
  const fromList = isBoat ? FERRY_PORTS : RES_STATIONS;
  const [tripType, setTripType] = React.useState('rt');
  const [from, setFrom] = React.useState(fromList[0]);
  const toList = isBoat ? (FERRY_ROUTES[from]||[]) : RES_STATIONS.filter(s=>s!==from);
  const [to, setTo] = React.useState(toList[0]);
  const [dep, setDep] = React.useState(defaultDep());
  const [ret, setRet] = React.useState(defaultRet());
  const [vehicle, setVehicle] = React.useState('none');   // bateau
  const [vehModel, setVehModel] = React.useState('');     // bateau : modèle
  const [vehLen, setVehLen] = React.useState('4-5');      // bateau : longueur
  const [vehHigh, setVehHigh] = React.useState(false);    // bateau : > 1,85 m
  const [trailer, setTrailer] = React.useState(false);    // bateau : remorque
  const [roofbox, setRoofbox] = React.useState(false);    // bateau : coffre de toit
  const [accom, setAccom] = React.useState('fauteuil');   // bateau
  const [adults, setAdults] = React.useState(2);
  const [children, setChildren] = React.useState(2);
  const [show, setShow] = React.useState(false);

  React.useEffect(()=>{ const opts = isBoat ? (FERRY_ROUTES[from]||[]) : RES_STATIONS.filter(s=>s!==from); if(!opts.includes(to)){ setTo(opts[0]); setShow(false); } }, [from]);

  const partners = isBoat ? ['Direct Ferries','Ferryhopper','Corsica Linea','Baléaria'] : ['Trainline','SNCF Connect','Trenitalia','Renfe'];
  const tone = isBoat ? 'ocean' : 'gold';
  const icon = isBoat ? 'anchor' : 'train';
  const VEH = [['none','Sans véhicule'],['voiture','Voiture'],['moto','Moto'],['van','Van / fourgon'],['camping','Camping-car']];
  const ACC = [['fauteuil','Fauteuil'],['cabine_int','Cabine intérieure'],['cabine_ext','Cabine extérieure'],['cabine_lux','Cabine premium']];

  return (
    <React.Fragment>
      <div className="res-form">
        <Segmented value={tripType} set={(v)=>{setTripType(v); setShow(false);}} options={[['ow','Aller simple'],['rt','Aller-retour']]} />
        <div className="row gap3">
          <Field label={isBoat?'Port de départ':'Gare de départ'}><select style={resInput} value={from} onChange={e=>{setFrom(e.target.value); setShow(false);}}>{fromList.map(x=><option key={x} value={x}>{x}</option>)}</select></Field>
          <Field label={isBoat?'Port d\'arrivée':'Gare d\'arrivée'}><select style={resInput} value={to} onChange={e=>{setTo(e.target.value); setShow(false);}}>{toList.map(x=><option key={x} value={x}>{x}</option>)}</select></Field>
        </div>
        {isBoat && <p className="micro" style={{ color:'var(--text-muted)', margin:'-4px 2px 0' }}>Seules les <b>traversées existantes</b> depuis {from} sont proposées.</p>}
        <div className="row gap3">
          <Field label="Départ"><input type="date" style={resInput} value={dep} onChange={e=>{setDep(e.target.value); setShow(false);}} /></Field>
          {tripType==='rt' && <Field label="Retour"><input type="date" style={resInput} value={ret} min={dep} onChange={e=>{setRet(e.target.value); setShow(false);}} /></Field>}
        </div>
        {isBoat && (
          <div className="row gap3">
            <Field label="Véhicule embarqué"><select style={resInput} value={vehicle} onChange={e=>{setVehicle(e.target.value); setShow(false);}}>{VEH.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
            <Field label="Installation"><select style={resInput} value={accom} onChange={e=>{setAccom(e.target.value); setShow(false);}}>{ACC.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
          </div>
        )}
        {isBoat && vehicle!=='none' && (
          <div className="res-seg-row">
            <b style={{ fontFamily:'var(--font-display)', fontSize:13.5 }}>Détails du véhicule</b>
            <p className="micro" style={{ color:'var(--text-muted)', margin:'-4px 0 2px', lineHeight:1.4 }}>La compagnie facture selon la <b>longueur</b> et la <b>hauteur</b> du véhicule — indiquez-les précisément pour un devis juste.</p>
            <Field label="Modèle (ex. Renault Scénic, VW California…)"><input type="text" style={resInput} value={vehModel} placeholder="Marque et modèle" onChange={e=>{setVehModel(e.target.value); setShow(false);}} /></Field>
            <div className="row gap3">
              <Field label="Longueur"><select style={resInput} value={vehLen} onChange={e=>{setVehLen(e.target.value); setShow(false);}}>{[['<4','moins de 4 m'],['4-5','4 à 5 m'],['5-6','5 à 6 m'],['6-7','6 à 7 m'],['>7','plus de 7 m']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
              <Field label="Hauteur"><select style={resInput} value={vehHigh?'high':'low'} onChange={e=>{setVehHigh(e.target.value==='high'); setShow(false);}}><option value="low">jusqu'à 1,85 m</option><option value="high">plus de 1,85 m</option></select></Field>
            </div>
            <label className="res-toggle"><input type="checkbox" checked={trailer} onChange={e=>{setTrailer(e.target.checked); setShow(false);}} /><span>Avec remorque / caravane</span></label>
            <label className="res-toggle"><input type="checkbox" checked={roofbox} onChange={e=>{setRoofbox(e.target.checked); setShow(false);}} /><span>Coffre de toit / porte-vélos</span></label>
          </div>
        )}
        <div className="res-pax">
          <Stepper label="Adultes" value={adults} set={setAdults} min={1} />
          <Stepper label="Enfants" value={children} set={setChildren} min={0} />
        </div>
        <button className="btn btn--primary btn--block" onClick={()=>setShow(true)}><Icon n="search" size={18} />{isBoat?'Voir les traversées':'Voir les trains'}</button>
      </div>

      {show && (
        <div style={{ marginTop:16 }}>
          <div className="webbina-reco" style={{ marginBottom:12 }}>
            <Avatar size={28} expr="happy" />
            <div className="micro" style={{ lineHeight:1.5, color:'var(--text-2)' }}>{isBoat ? 'Je cale les horaires de traversée sur le reste de votre voyage (vol, hôtel…).' : 'Je vérifie que votre train arrive à temps pour la suite (vol, ferry…).'}</div>
          </div>
          <div className="ai-note" style={{ background:'var(--surface)', border:'1px solid var(--warning-border)', marginBottom:12 }}>
            <Icon n="info" size={16} style={{ color:'var(--warning)', flex:'none', marginTop:2 }} />
            <div className="micro" style={{ color:'var(--text-2)', lineHeight:1.45 }}>
              <b>{from}</b> → <b>{to}</b>{tripType==='rt'?' · aller-retour':''}{isBoat && vehicle!=='none'?` · ${VEH.find(v=>v[0]===vehicle)[1]}${vehModel?' ('+vehModel+')':''}${trailer?' + remorque':''}${roofbox?' + coffre de toit':''}`:''} · connexion partenaire en cours d'activation — exemples représentatifs. La réservation en direct arrive très bientôt. 💙
            </div>
          </div>
          {[0,1,2].map(i=>(
            <div key={i} className="compare-card" style={{ cursor:'default' }}>
              <div className="row between">
                <div className="row gap3">
                  <span className={`res-ic u-${tone}`} style={{ width:44, height:44 }}><Icon n={icon} size={20} /></span>
                  <div>
                    <b style={{ fontFamily:'var(--font-display)', fontSize:15 }}>{partners[i]}</b>
                    <div className="micro">{isBoat?['Traversée jour · 6 h','Traversée nuit · cabine','Express · 3 h 30'][i]:['Direct · 3 h 10','1 corresp. · 4 h','Direct · 2 h 50'][i]}</div>
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <b style={{ fontFamily:'var(--font-display)', fontSize:17, color:'var(--text-muted)' }}>dès {isBoat?[89,129,69][i]:[29,24,39][i]} €</b>
                  <div className="micro">estimatif</div>
                </div>
              </div>
            </div>
          ))}
          <div className="uni-providers" style={{ marginTop:6 }}>
            <span className="micro">Partenaires :</span>
            {partners.map(p=><span key={p} className="uni-prov">{p}</span>)}
          </div>
        </div>
      )}
    </React.Fragment>
  );
}

/* FORMALITÉS : pays du monde entier + nationalité → feux tricolores */
const RES_STATUS_META = {
  green:  { label:'Conforme',     bg:'var(--success-bg)', border:'var(--success-border)', fg:'var(--success)' },
  orange: { label:'À vérifier',   bg:'var(--warning-bg)', border:'var(--warning-border)', fg:'var(--warning)' },
  red:    { label:'Action requise', bg:'var(--error-bg)', border:'var(--error-border)', fg:'var(--error)' },
};
function FormalitesTool(){
  const [code, setCode] = React.useState('US');
  const [nat, setNat] = React.useState('FR');
  const [done, setDone] = React.useState(false);
  const country = COUNTRIES.find(c=>c[0]===code) || COUNTRIES[0];
  const items = React.useMemo(()=> done ? formalityRules(nat, country) : [], [done, nat, code]);
  const worst = items.reduce((a,r)=> a==='red'||r.status==='red'?'red':(a==='orange'||r.status==='orange'?'orange':'green'),'green');
  return (
    <React.Fragment>
      <div className="ai-note" style={{ marginBottom:14, background:'var(--surface)', border:'1px solid var(--border)', boxShadow:'var(--sh-sm)' }}>
        <Avatar size={36} expr="reassuring" />
        <div className="micro" style={{ color:'var(--text-2)', lineHeight:1.5 }}>Vérifiez les formalités d'entrée <b>avant même de réserver</b> : choisissez le <b>pays</b> de destination et la nationalité du passeport. Je vérifie visa, passeport, santé et règles pour les enfants. 💪</div>
      </div>
      <div className="res-form">
        <div className="row gap3">
          <Field label="Pays de destination"><select style={resInput} value={code} onChange={e=>{setCode(e.target.value); setDone(false);}}>{COUNTRIES.map(c=><option key={c[0]} value={c[0]}>{c[1]}</option>)}</select></Field>
          <Field label="Passeport (nationalité)"><select style={resInput} value={nat} onChange={e=>{setNat(e.target.value); setDone(false);}}>{NAT_LIST.map(([c,l])=><option key={c} value={c}>{l}</option>)}</select></Field>
        </div>
        <button className="btn btn--primary btn--block" onClick={()=>setDone(true)}><Icon n="shield" size={18} />Vérifier les formalités</button>
      </div>
      {done && (
        <div style={{ marginTop:16 }}>
          <div className="card card--pad" style={{ borderLeft:`4px solid ${RES_STATUS_META[worst].fg}`, marginBottom:12 }}>
            <div className="row gap2" style={{ alignItems:'center' }}>
              <StatusDot status={worst} />
              <b style={{ fontFamily:'var(--font-display)', fontSize:15.5 }}>{country[1]} · passeport {NAT_LIST.find(([c])=>c===nat)[1]}</b>
            </div>
          </div>
          <div className="row gap4 micro" style={{ justifyContent:'center', marginBottom:12 }}>
            <span className="row gap2"><StatusDot status="green" size={10} />Conforme</span>
            <span className="row gap2"><StatusDot status="orange" size={10} />À vérifier</span>
            <span className="row gap2"><StatusDot status="red" size={10} />Action requise</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {items.map((it,i)=>{ const m=RES_STATUS_META[it.status]; return (
              <div key={i} className="row gap3" style={{ alignItems:'flex-start', padding:'12px 14px', borderRadius:'var(--r-md)', background:m.bg, border:'1px solid '+m.border }}>
                <div style={{ width:34, height:34, borderRadius:9, background:'var(--surface)', display:'grid', placeItems:'center', flex:'none' }}>
                  <Icon n={it.k==='visa'?'mapPin':it.k==='health'?'shield':it.k==='kids'?'users':'shield'} size={16} style={{ color:m.fg }} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div className="row between"><b style={{ fontFamily:'var(--font-display)', fontSize:14.5 }}>{it.title}</b><span className="micro" style={{ color:m.fg, fontWeight:700 }}>{m.label}</span></div>
                  <div className="micro" style={{ color:'var(--text-2)', marginTop:3, lineHeight:1.45 }}>{it.detail}</div>
                </div>
              </div>
            ); })}
          </div>
          <p className="micro" style={{ textAlign:'center', marginTop:14, color:'var(--text-muted)' }}>Indicatif · à confirmer sur <b>France Diplomatie</b> et l'<b>IATA Travel Centre</b> avant le départ.</p>
        </div>
      )}
    </React.Fragment>
  );
}

Object.assign(window, { ReserverHub, ReserverScreen });
