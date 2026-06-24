/* TravelFamily.AI prototype — App shell, navigation, phone frame */

function StatusBar() {
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

function TabBar({ active, go, openChat }) {
  return (
    <div className="tabbar">
      {TABS.map(t=>{
        if(t.id==='__fab') return (
          <button key="fab" className="tab-fab" onClick={()=>openChat('home')} aria-label="Parler à Webbina">
            <img src="assets/webbina-circle.png" alt="Webbina" />
          </button>
        );
        const on = active===t.id;
        return (
          <button key={t.id} className={`tab ${on?'on':''}`} onClick={()=>go(t.id)}>
            <Icon n={t.ic} size={23} />
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function App() {
  const [screen, setScreen] = React.useState('home');
  const [trip, setTrip] = React.useState(null);
  const [chatCtx, setChatCtx] = React.useState('home');
  const [favs, setFavs] = React.useState(['annecy']);
  const [anim, setAnim] = React.useState(0);

  const go = (s, t) => { if(t) setTrip(t); setScreen(s); setAnim(a=>a+1); };
  const openChat = (ctx) => { setChatCtx(ctx); setScreen('chat'); setAnim(a=>a+1); };
  const toggleFav = (id) => setFavs(f=> f.includes(id) ? f.filter(x=>x!==id) : [...f, id]);

  const tabActive = ['home','favoris','dashboard','profil'].includes(screen) ? screen : null;
  const showChrome = screen!=='chat';

  let view;
  if(screen==='home') view=<HomeScreen go={go} openChat={openChat} favs={favs} toggleFav={toggleFav} />;
  else if(screen==='chat') view=<ChatScreen ctx={chatCtx} go={go} favs={favs} toggleFav={toggleFav} />;
  else if(screen==='results') view=<ResultsScreen go={go} favs={favs} toggleFav={toggleFav} />;
  else if(screen==='detail') view=<DetailScreen trip={trip} go={go} favs={favs} toggleFav={toggleFav} />;
  else if(screen==='dashboard') view=<DashboardScreen go={go} />;
  else if(screen==='favoris') view=<FavorisScreen go={go} favs={favs} toggleFav={toggleFav} />;
  else if(screen==='profil') view=<ProfilScreen />;

  return (
    <div className={`phone-screen ${screen==='chat'?'is-chat':''}`}>
      <StatusBar />
      <div className="scroll-area" key={anim}>
        {view}
      </div>
      {showChrome && <TabBar active={tabActive} go={(s)=>go(s)} openChat={openChat} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('app')).render(<App />);
