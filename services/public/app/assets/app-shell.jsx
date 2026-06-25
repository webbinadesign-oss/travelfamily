/* TravelFamily.AI app — shell, status bar, tab nav, favoris, routing */

function StatusBar({ dark }) {
  return (
    <div className="statusbar">
      <span style={{ fontWeight:700 }}>9:41</span>
      <span className="row gap2" style={{ alignItems:'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="6" width="3" height="5" rx="1"/><rect x="4.5" y="4" width="3" height="7" rx="1"/><rect x="9" y="2" width="3" height="9" rx="1"/><rect x="13.5" y="0" width="3" height="11" rx="1"/></svg>
        <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor"><path d="M8.5 2.5c2 0 3.9.8 5.3 2.1l1.2-1.3A9.4 9.4 0 0 0 8.5 .6 9.4 9.4 0 0 0 2 3.3l1.2 1.3A7.4 7.4 0 0 1 8.5 2.5Z"/><path d="M8.5 6c1 0 2 .4 2.7 1.1l1.2-1.3A6 6 0 0 0 8.5 4 6 6 0 0 0 4.1 5.8l1.2 1.3A4 4 0 0 1 8.5 6Z"/><circle cx="8.5" cy="9.7" r="1.6"/></svg>
        <svg width="26" height="12" viewBox="0 0 26 12" fill="none"><rect x="1" y="1" width="21" height="10" rx="3" stroke="currentColor" strokeWidth="1.2" opacity=".5"/><rect x="2.5" y="2.5" width="16" height="7" rx="1.5" fill="currentColor"/><rect x="23.5" y="4" width="1.6" height="4" rx="1" fill="currentColor"/></svg>
      </span>
    </div>
  );
}

const TABS = [
  { id:'home', ic:'compass', label:'Explorer' },
  { id:'favoris', ic:'heart', label:'Favoris' },
  { id:'__fab', ic:'', label:'' },
  { id:'dashboard', ic:'briefcase', label:'Voyages' },
  { id:'profil', ic:'user', label:'Profil' },
];

function TabBar({ active, go, openChat, expr='happy' }) {
  return (
    <div className="tabbar">
      {TABS.map(t=>{
        if(t.id==='__fab') return (
          <div key="fab" className="tab-fab-wrap">
            <LivingWebbina expr={expr} state="idle" size={62} ring onClick={()=>openChat('home')} />
          </div>
        );
        const on=active===t.id;
        return (
          <button key={t.id} className={`tab ${on?'on':''}`} onClick={()=>go(t.id)}>
            <Icon n={t.ic} size={23} /><span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function FavorisScreen({ go, favs, toggleFav }) {
  const list=TF.DESTINATIONS.filter(d=>favs.includes(d.id));
  return (
    <div className="screen">
      <div style={{ padding:'16px 18px 6px' }}><h2 style={{ fontSize:26 }}>Mes favoris</h2></div>
      {list.length===0 ? (
        <div style={{ padding:'70px 34px', textAlign:'center', color:'var(--text-muted)' }}>
          <Icon n="heart" size={48} /><p style={{ marginTop:14 }}>Touchez le cœur sur une destination pour la retrouver ici.</p>
          <button className="btn btn--secondary" style={{ marginTop:18 }} onClick={()=>go('home')}>Explorer les idées</button>
        </div>
      ) : (
        <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:16 }}>
          {list.map(d=><DestCard key={d.id} d={d} onOpen={()=>go('detail', d)} fav={true} onFav={toggleFav} />)}
        </div>
      )}
    </div>
  );
}

const LS = 'tf_app_state_v1';
function load(){ try{ return JSON.parse(localStorage.getItem(LS))||{}; }catch(e){ return {}; } }

function App() {
  const saved = load();
  const auth = (typeof window.useWebbinaAuth !== 'undefined') ? window.useWebbinaAuth() : { ready:true, authEnabled:false, user:null };
  const introSeen = (()=>{ try{ return !!localStorage.getItem('tf_intro_seen'); }catch(e){ return false; } })();
  const [screen, setScreen] = React.useState(introSeen ? 'auth' : 'welcome');
  const [trip, setTrip] = React.useState(null);
  const [booking, setBooking] = React.useState(null);
  const [chatCtx, setChatCtx] = React.useState('home');
  const [chatSeed, setChatSeed] = React.useState(null);
  const [parcours, setParcours] = React.useState(null);
  const [reserverMode, setReserverMode] = React.useState('vol');
  const [favs, setFavs] = React.useState(saved.favs || ['annecy']);
  const [anim, setAnim] = React.useState(0);

  React.useEffect(()=>{ localStorage.setItem(LS, JSON.stringify({ screen, favs })); }, [screen, favs]);

  // Mandatory account: once auth is live, you cannot use the app without a session.
  React.useEffect(()=>{
    if(!auth) return;
    if(auth.user){
      if(screen==='welcome' || screen==='auth'){ setScreen('home'); setAnim(a=>a+1); }
    } else if(auth.ready && auth.authEnabled){
      if(screen!=='welcome' && screen!=='auth'){ setScreen(introSeen?'auth':'welcome'); setAnim(a=>a+1); }
    }
  }, [auth && auth.user, auth && auth.ready, auth && auth.authEnabled, screen]);

  const go=(s,t)=>{ if(t) setTrip(t); setScreen(s); setAnim(a=>a+1); };
  const book=(payload)=>{ setBooking(payload); setScreen('booking'); setAnim(a=>a+1); };
  const openChat=(ctx, seed)=>{ setChatCtx(ctx); setChatSeed(seed||null); setScreen('chat'); setAnim(a=>a+1); };
  const openParcours=(id)=>{ setParcours(id); setScreen('parcours'); setAnim(a=>a+1); };
  const openReserver=(m)=>{ setReserverMode(m); setScreen('reserver'); setAnim(a=>a+1); };
  const toggleFav=(id)=> setFavs(f=> f.includes(id)? f.filter(x=>x!==id):[...f,id]);

  const fullBleed = screen==='welcome';
  const isChat = screen==='chat';
  const tabActive = ['home','favoris','dashboard','profil'].includes(screen) ? screen : null;
  const showChrome = !fullBleed && !isChat && screen!=='auth' && screen!=='booking' && screen!=='parcours';
  const showStatus = !fullBleed;

  let view;
  if(screen==='welcome') view=<WelcomeScreen go={go} />;
  else if(screen==='auth') view=<AuthScreen go={go} />;
  else if(screen==='home') view=<HomeScreen go={go} openChat={openChat} openParcours={openParcours} openReserver={openReserver} favs={favs} toggleFav={toggleFav} />;
  else if(screen==='parcours') view=<ParcoursIntakeScreen parcours={parcours} go={go} openChat={openChat} />;
  else if(screen==='reserver') view=<ReserverScreen mode={reserverMode} go={go} book={book} />;
  else if(screen==='chat') view=<ConversationScreen ctx={chatCtx} seed={chatSeed} go={go} book={book} />;
  else if(screen==='results') view=<ResultsScreen go={go} trip={trip} favs={favs} toggleFav={toggleFav} />;
  else if(screen==='detail') view=<DetailScreen trip={trip} go={go} book={book} favs={favs} toggleFav={toggleFav} />;
  else if(screen==='booking') view=<BookingScreen booking={booking} go={go} />;
  else if(screen==='formalites') view=<FormalitesScreen go={go} />;
  else if(screen==='dashboard') view=<DashboardScreen go={go} openChat={openChat} />;
  else if(screen==='badges') view=<BadgesScreen go={go} />;
  else if(screen==='favoris') view=<FavorisScreen go={go} favs={favs} toggleFav={toggleFav} />;
  else if(screen==='profil') view=<ProfilScreen go={go} />;
  else if(screen==='passeports') view=<PassportsScreen go={go} />;
  else if(screen==='premium') view=<PremiumScreen go={go} />;

  return (
    <div className={`phone-screen ${isChat?'is-chat':''} ${fullBleed?'is-welcome':''}`}>
      {showStatus && <StatusBar />}
      <div className={`scroll-area ${fullBleed?'no-scroll':''}`} key={anim}>{view}</div>
      {showChrome && <TabBar active={tabActive} go={(s)=>go(s)} openChat={openChat} expr={screenToExpr(screen)} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('app')).render(<App />);
