/* TravelFamily.AI — data layer (window globals) */
window.TF = window.TF || {};

TF.DESTINATIONS = [
  { id:'bali', iata:'DPS', lat:-8.409518, lng:115.188919, img:'photo-beach.jpg', name:'Bali', country:'Indonésie', tag:'Plage paradisiaque',
    meta:[['sun','Soleil garanti'],['plane','13 h de vol']], price:1240, rating:4.9, nights:14,
    ribbon:['Coup de cœur','coral'], kid:'Idéal 4–12 ans',
    desc:'Lagons turquoise, rizières et hôtels pensés pour les familles. Le dépaysement total à un prix doux.',
    match:96 },
  { id:'sicile', iata:'CTA', lat:37.502670, lng:15.087269, img:'photo-sunset.jpg', name:'Sicile', country:'Italie', tag:'Mer & culture',
    meta:[['sun','Eaux chaudes'],['plane','2 h 15']], price:790, rating:4.8, nights:8,
    ribbon:['Sans longue escale','turq'], kid:'Tous âges',
    desc:'Plages dorées, volcans et la meilleure cuisine du monde pour les enfants. Le sud dans toute sa chaleur.',
    match:92 },
  { id:'lisbonne', iata:'LIS', lat:38.722252, lng:-9.139337, img:'photo-street.jpg', name:'Lisbonne', country:'Portugal', tag:'Ville & océan',
    meta:[['sun','300 j de soleil'],['plane','2 h 30']], price:540, rating:4.7, nights:5,
    ribbon:['Petit budget','gold'], kid:'Dès 3 ans',
    desc:'Tramways, pâtisseries et plages à 30 min. Une capitale douce et lumineuse, parfaite pour une première escapade.',
    match:88 },
  { id:'annecy', iata:'GVA', lat:45.899247, lng:6.129384, img:'photo-mountain.jpg', name:'Annecy', country:'France', tag:'Lac & montagne',
    meta:[['train','3 h de Paris'],['leaf','Sans avion']], price:680, rating:4.8, nights:6,
    ribbon:['Sans avion','turq'], kid:'Tous âges',
    desc:'Le plus beau lac des Alpes, baignade, vélo et villages perchés. L\'évasion proche, zéro décalage horaire.',
    match:85 },
];

TF.PARCOURS = [
  { id:'01', ic:'calendar', c:'ocean', t:'J\'ai mes dates et ma destination', d:'On optimise chaque détail de votre voyage.' },
  { id:'02', ic:'compass', c:'coral', t:'J\'ai mes dates mais pas la destination', d:'Je vous trouve les meilleures idées.' },
  { id:'03', ic:'wallet', c:'turq', t:'J\'ai ma destination, je suis flexible', d:'On cible les meilleures périodes et prix.' },
  { id:'04', ic:'balloon', c:'gold', t:'Fais-moi rêver', d:'Laissez-moi inventer un voyage sur-mesure.' },
];

/* progressive conversation — a funnel, one question at a time, never a form.
   Order: who → ages → from where → when → how long → budget → vibe → must-haves */
TF.QUESTIONS = [
  { id:'adults', q:'Avec grand plaisir&nbsp;! Pour bien vous conseiller, j\'ai quelques questions. D\'abord&nbsp;: combien d\'adultes partent&nbsp;?', kind:'stepper', min:1, max:8, def:2, suffix:'adulte' },
  { id:'kids', q:'Et combien d\'enfants vous accompagnent&nbsp;?', kind:'stepper', min:0, max:8, def:2, suffix:'enfant' },
  { id:'ages', q:'Quel âge ont les enfants&nbsp;? Cela change tout pour les vols, les hôtels et les activités.', kind:'chips-multi',
    options:['0–2 ans','3–5 ans','6–9 ans','10–13 ans','14–17 ans'] },
  { id:'from', q:'De quelle ville partez-vous&nbsp;? Je cherche les meilleurs vols au départ de chez vous.', kind:'chips',
    options:['Paris','Marseille','Lyon','Nice','Toulouse','Bordeaux','Nantes','Genève'] },
  { id:'when', q:'Quand rêvez-vous de partir&nbsp;?', kind:'chips', options:['Cet été ☀️','Toussaint 🍂','Noël ❄️','Hiver / ski','Je suis flexible 🗓️'] },
  { id:'duration', q:'Combien de temps souhaitez-vous partir&nbsp;?', kind:'chips', options:['Un week-end','3–5 jours','1 semaine','2 semaines','Plus de 2 semaines'] },
  { id:'budget', q:'Quel budget TOTAL pour toute la famille&nbsp;? Je m\'y tiens et ne vous proposerai jamais au-dessus.', kind:'slider', min:500, max:12000, step:100, def:3000, unit:'€' },
  { id:'vibe', q:'Quelle ambiance vous fait envie&nbsp;? (plusieurs choix possibles)', kind:'chips-multi',
    options:['🏖️ Plage & farniente','🏛️ Culture & villes','🏔️ Nature & grand air','🎢 Parcs & sensations','🍽️ Gastronomie','🐠 Aventure douce','❄️ Neige & ski'] },
  { id:'musts', q:'Dernière chose&nbsp;: y a-t-il des incontournables pour vous&nbsp;?', kind:'chips-multi',
    options:['✈️ Vol direct','🕐 Peu de décalage horaire','🍽️ Tout compris','🏊 Piscine / club enfants','🚆 Sans avion','♿ Accessible'] },
];

TF.CONNECTORS = {
  flights:['Amadeus','Skyscanner','Kiwi','Duffel'],
  hotels:['Booking','Expedia','Hotelbeds'],
  activities:['Viator','GetYourGuide'],
  cars:['RentalCars'],
};

/* Subscription plan (free | premium). Stored locally for the prototype;
   in production this comes from the user's account. Free tier shows discreet
   partner (Travelpayouts) offers; Premium removes them + reduced commission. */
TF.plan = function(){ try{ return localStorage.getItem('tf_plan')||'free'; }catch(e){ return 'free'; } };
TF.setPlan = function(p){ try{ localStorage.setItem('tf_plan', p); }catch(e){} };
TF.isPremium = function(){ return TF.plan()==='premium'; };

TF.FLIGHTS = [
  { id:'f1', airline:'Qatar Airways', code:'QR', stops:0, dur:'15 h 05', via:'Direct', price:742, rating:4.6, time:'10:30 → 06:35', recommended:true,
    reason:'Seulement 38 € de plus que l\'option la moins chère, mais <b>aucune escale</b> — vous évitez 7 h d\'attente avec les enfants.' },
  { id:'f2', airline:'Emirates', code:'EK', stops:1, dur:'19 h 40', via:'via Dubaï · 2 h', price:704, rating:4.7, time:'21:15 → 21:55' },
  { id:'f3', airline:'Turkish Airlines', code:'TK', stops:1, dur:'23 h 10', via:'via Istanbul · 7 h', price:661, rating:4.4, time:'14:00 → 18:10' },
];

TF.HOTELS = [
  { id:'h1', name:'Padma Resort Legian', img:'photo-hotel.jpg', stars:5, rating:9.1, reviews:2840, price:148, family:true, recommended:true,
    perks:['Club enfants gratuit','Pension complète','Plage privée'],
    reason:'Le <b>club enfants gratuit</b> et la pension complète couvrent repas + activités : sur 14 nuits, c\'est 540 € économisés vs un 4★ sans extras.' },
  { id:'h2', name:'The Anvaya Beach Resort', img:'photo-beach.jpg', stars:5, rating:8.9, reviews:1920, price:132, family:true,
    perks:['Piscine lagon','Petit-déjeuner','Navette aéroport'] },
  { id:'h3', name:'Sol Beach House Benoa', img:'photo-street.jpg', stars:4, rating:8.6, reviews:1450, price:96, family:false,
    perks:['Adultes & ados','Spa','Bord de mer'] },
];

TF.ITINERARY = [
  { day:1, title:'Arrivée & douceur à Jimbaran', weather:['sun',31], items:[
    ['plane','11:20','Atterrissage à Denpasar','Navette privée incluse vers l\'hôtel'],
    ['bed','14:00','Installation au Padma Resort','Chambre familiale vue jardin'],
    ['utensils','19:30','Dîner de poisson grillé','Sur la plage de Jimbaran · adapté enfants'] ] },
  { day:2, title:'Temples & singes d\'Uluwatu', weather:['sun',32], items:[
    ['compass','09:00','Temple d\'Uluwatu','Falaises spectaculaires, prévoir chapeaux'],
    ['utensils','12:30','Déjeuner balinais','Warung familial recommandé par Webbina'],
    ['sun','16:00','Plage de Padang Padang','Eaux calmes, idéale baignade enfants'] ] },
  { day:3, title:'Lagon turquoise & snorkeling', weather:['sun',30], items:[
    ['compass','08:30','Snorkeling à Nusa','Sortie encadrée dès 6 ans · gilets fournis'],
    ['utensils','13:00','Pique-nique sur l\'île','Fruits frais & grillades'],
    ['star','18:00','Coucher de soleil & glaces','Moment détente en famille'] ] },
];

TF.FORMALITES = {
  trip:'France → Indonésie (Bali)', family:'2 adultes · 3 enfants',
  globalStatus:'orange',
  items:[
    { id:'passport', ic:'briefcase', label:'Passeports', status:'green',
      detail:'Tous valides plus de 6 mois après le retour. ✓ Conforme pour les 5 voyageurs.' },
    { id:'visa', ic:'globe', label:'Visa / eVisa', status:'orange',
      detail:'Un <b>e-VOA</b> (visa à l\'arrivée électronique) est requis. 35 $/pers. — je peux le pré-remplir pour vous.' },
    { id:'vaccin', ic:'shield', label:'Vaccins & santé', status:'green',
      detail:'Aucun vaccin obligatoire. Hépatite A et traitement anti-moustiques recommandés.' },
    { id:'kids', ic:'users', label:'Enfants mineurs', status:'red',
      detail:'Vos enfants voyagent : une <b>autorisation de sortie du territoire</b> (AST) est nécessaire si un seul parent accompagne. Action requise.' },
    { id:'security', ic:'info', label:'Sécurité & conseils', status:'green',
      detail:'Vigilance normale (Quai d\'Orsay). Saison sèche idéale en août.' },
  ],
};

/* Programme de fidélité « Récompenses Webbina » + Cagnotte voyage.
   Moteur : une part de chaque voyage VALIDÉ est créditée en cagnotte, déductible
   du prochain voyage. Taux volontairement bas en gratuit (pousse vers Premium),
   financé par notre marge, plafonné et soumis à conditions strictes anti-abus. */
TF.LOYALTY = {
  balance: 38,          /* solde démo (€) */
  rate: 0.5,            /* % crédité par voyage validé — GRATUIT */
  ratePremium: 2,       /* % crédité — PREMIUM (4× plus incitatif) */
  capFree: 25,          /* plafond € crédité par réservation — gratuit */
  capPrem: 150,         /* plafond € par réservation — premium */
  minBooking: 150,      /* montant min. d'une réservation pour compter (€) */
  useMaxPct: 30,        /* % max. de la cagnotte utilisable sur une réservation */
  expiryMonths: 24,     /* validité de la cagnotte */
};

/* Règles du programme (transparence + anti-abus). */
TF.LOYALTY_RULES = [
  'Un voyage ne compte que s\'il est payé, réalisé (non annulé) et d\'un montant d\'au moins 150 € incluant un transport ou au moins une nuit d\'hébergement. Un simple billet à bas prix ne compte pas comme un voyage.',
  'Le palier « Famille Voyageuse » exige des voyages réalisés avec au moins 2 voyageurs.',
  'La cagnotte est créditée après votre retour (jamais à la réservation), plafonnée par réservation, et valable 24 mois.',
  'Plafond de cagnotte par réservation : 25 € en gratuit, relevé à 150 € en Premium.',
  'Cagnotte déductible jusqu\'à 30 % d\'une réservation en gratuit, relevé à 50 % en Premium.',
  'Premium : taux de cagnotte doublé (2 % au lieu de 0,5 %). Offres cumulables sauf mention contraire.',
];

TF.BADGES = [
  { id:'explorer', ic:'compass', name:'Explorateur', desc:'1er voyage validé', earned:true, color:'ocean',
    reward:'10 € de bienvenue crédités en cagnotte 🎁',
    detail:'Dès votre 1ᵉʳ voyage validé : 10 € crédités en cagnotte de bienvenue, plus l\'accès aux « Bons plans du jour ». Votre point de départ.' },
  { id:'adventurer', ic:'balloon', name:'Aventurier', desc:'3 voyages validés', earned:true, color:'coral',
    reward:'1 mois Premium offert + cagnotte ×1,5',
    detail:'Après 3 voyages validés : un mois de Webbina Premium vous est offert (cagnotte 2 %, zéro pub, bons plans exclusifs, alerte prix), et votre cagnotte est boostée à ×1,5 pendant cette période.' },
  { id:'globe', ic:'globe', name:'Globe Trotter', desc:'3 continents explorés', earned:false, progress:66, color:'turq',
    reward:'Commission réduite à vie',
    detail:'Après avoir voyagé sur 3 continents différents : Webbina réduit sa commission sur CHACUNE de vos réservations, à vie. Concrètement, vous payez vos voyages moins cher, pour toujours.' },
  { id:'family', ic:'users', name:'Famille Voyageuse', desc:'5 voyages validés en famille', earned:false, progress:40, color:'gold',
    reward:'Cagnotte au taux max (2 %) à vie + 50 € offerts + statut VIP',
    detail:'Le palier ultime, après 5 voyages validés en famille (au moins 2 voyageurs) : votre cagnotte passe au taux maximum (2 %, comme le Premium) à vie, 50 € vous sont offerts au passage du palier, et vous obtenez le statut VIP — SAV prioritaire et bons plans exclusifs. Vos voyages vous rapportent toujours plus.' },
];

/* Centre d'aide — questions fréquentes (self-service, déflecte le SAV). */
TF.FAQ = [
  { q:'Comment modifier ou annuler une réservation ?',
    a:'Ouvrez « Mes voyages », sélectionnez la réservation puis « Gérer ». Les conditions (gratuit, payant, non modifiable) dépendent du prestataire (compagnie, hôtel) et sont affichées avant tout achat. Webbina vous guide pas à pas.' },
  { q:'Où se trouve ma réservation ?',
    a:'Toutes vos réservations sont dans l\'onglet « Mes voyages », avec le détail, les billets et le récapitulatif. Un e-mail de confirmation vous est aussi envoyé.' },
  { q:'Le prix a changé entre ma recherche et le paiement, pourquoi ?',
    a:'Les tarifs proviennent en temps réel des compagnies et hôtels ; ils peuvent évoluer jusqu\'à la confirmation. Le prix définitif est toujours celui affiché à l\'étape de paiement.' },
  { q:'Mes formalités (visa, passeport) sont-elles garanties ?',
    a:'Webbina vérifie et vous alerte (feux vert / orange / rouge) à titre indicatif, avant même de réserver. La vérification officielle reste de votre responsabilité auprès de France Diplomatie.' },
  { q:'Comment fonctionne le paiement ?',
    a:'Le paiement est sécurisé et chiffré (Stripe). Nous ne stockons jamais votre numéro de carte.' },
  { q:'Un problème pendant le voyage (vol annulé, souci à l\'hôtel) ?',
    a:'Pour un incident en cours de voyage, contactez d\'abord le prestataire concerné (compagnie, hôtel) dont les coordonnées figurent sur votre confirmation — c\'est lui qui gère l\'opérationnel. Webbina vous aide à trouver la bonne démarche, et notre équipe reste joignable par écrit.' },
];

TF.MEMORY = [
  { ic:'briefcase', label:'Passeports', value:'Aucun enregistré', status:null },
  { ic:'plane', label:'Aéroport favori', value:'À définir', status:null },
  { ic:'star', label:'Compagnies préférées', value:'À définir', status:null },
  { ic:'wallet', label:'Budget habituel', value:'À définir', status:null },
  { ic:'users', label:'Voyageurs', value:'Ajoutez votre famille', status:null },
];
