/* ============================================================================
   WEBBINA CONSOLE — the central conversational component.
   Layout:  [ Avatar Stage ]  [ Conversation ]   (desktop)
            stacked                                (mobile)
   ========================================================================== */
function WIcon({ n, size = 22, sw = 1.75, style }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', ...style }}
    dangerouslySetInnerHTML={{ __html: tfIcon(n, { size, sw }) }} />;
}

/* ── Dedicated Avatar Stage (the swappable zone) ──────────────────────────── */
function AvatarStage({ emotion, state, audioLevel, rendererId, onRenderer, onContext }) {
  const def = getAvatarRenderer(rendererId);
  const Renderer = def.Component;
  const emo = WEBBINA_EMOTIONS[emotion] || WEBBINA_EMOTIONS.happy;
  const st = WEBBINA_STATES[state] || WEBBINA_STATES.idle;
  const [ctx, setCtx] = useState('welcome');
  return (
    <div className="stage">
      <div className="stage-bg" />
      <div className="stage-particles">{Array.from({ length: 10 }).map((_, i) =>
        <span key={i} style={{ left: `${(i * 11 + 6) % 100}%`, animationDelay: `${(i % 5) * 0.6}s`, animationDuration: `${5 + (i % 4)}s` }} />)}
      </div>

      <div className="stage-avatar">
        <Renderer emotion={emotion} state={state} audioLevel={audioLevel} size={260} />
      </div>

      {/* state + emotion read-outs */}
      <div className="stage-readouts">
        <span className="stage-state"><span className="state-dot" style={{ background: st.dot }} />{st.label}</span>
        <span className={`stage-emotion emo-${emo.color}`}>{emo.label}</span>
      </div>

      {/* context director — the 5 product contexts drive her emotion automatically */}
      {onContext && (
        <div className="ctx-strip" role="tablist" aria-label="Contexte">
          {Object.entries(WEBBINA_CONTEXTS).map(([key, c]) => (
            <button key={key} className={`ctx-btn ${ctx === key ? 'on' : ''}`} onClick={() => { setCtx(key); onContext(key); }} title={c.label}>
              <WIcon n={c.icon} size={15} /><span>{c.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* renderer switcher — the future-engine seam, made tangible */}
      <div className="renderer-switch" role="tablist" aria-label="Moteur d'avatar">
        {AVATAR_RENDERERS.map((r) => (
          <button key={r.id} className={`rs-btn ${rendererId === r.id ? 'on' : ''}`} onClick={() => onRenderer(r.id)} title={r.label}>
            <WIcon n={r.icon} size={17} />
            <span>{r.label}</span>
            {r.status === 'soon' && <em className="rs-soon">à venir</em>}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Conversation panel (text + voice + dynamic responses) ────────────────── */
function ConversationPanel({ wb, transportId, onTransport }) {
  const { messages, streaming, state, suggestions, status, error, sendText, startVoice, stopVoice } = wb;
  const [input, setInput] = useState('');
  const [voiceOn, setVoiceOn] = useState(false);
  const scroller = useRef(null);

  useEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; }, [messages, streaming, suggestions]);

  function submit(e) { e?.preventDefault(); if (!input.trim()) return; sendText(input); setInput(''); }
  function toggleVoice() {
    if (voiceOn) { stopVoice(); setVoiceOn(false); }
    else { startVoice(); setVoiceOn(true); }
  }

  return (
    <div className="convo">
      {/* transport bar */}
      <div className="convo-top">
        <div className="convo-id">
          <img src="assets/webbina-circle.png" alt="" className="convo-ava" />
          <div>
            <b>Webbina</b>
            <div className="convo-status"><span className={`s-dot ${status.connected ? 'ok' : 'off'}`} />{status.label}</div>
          </div>
        </div>
        <div className="transport-switch">
          {WEBBINA_TRANSPORTS.map((t) => (
            <button key={t.id} className={`tr-btn ${transportId === t.id ? 'on' : ''}`} onClick={() => onTransport(t.id)} title={t.label}>
              <WIcon n={t.icon} size={15} /><span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="convo-error"><WIcon n="info" size={16} />{error.message}</div>
      )}

      {/* messages + dynamic streaming */}
      <div className="convo-body" ref={scroller}>
        {messages.map((m) => (
          m.who === 'webbina'
            ? <div key={m.id} className="row-w"><img className="msg-ava" src={`assets/webbina-${(WEBBINA_EMOTIONS[m.emotion] || WEBBINA_EMOTIONS.happy).img}.png`} alt="" /><div className="bub bub-w" dangerouslySetInnerHTML={{ __html: m.text }} /></div>
            : <div key={m.id} className="row-u"><div className="bub bub-u">{m.text}</div></div>
        ))}
        {streaming && (
          <div className="row-w"><img className="msg-ava" src="assets/webbina-focused.png" alt="" />
            <div className="bub bub-w">
              <span dangerouslySetInnerHTML={{ __html: streaming.text }} />
              <span className="cursor" />
            </div>
          </div>
        )}
        {state === 'thinking' && !streaming && (
          <div className="row-w"><img className="msg-ava" src="assets/webbina-focused.png" alt="" /><div className="bub bub-w typing3"><span /><span /><span /></div></div>
        )}
      </div>

      {/* quick suggestions */}
      {suggestions.length > 0 && (
        <div className="convo-suggest">
          {suggestions.map((s) => <button key={s} className="sg" onClick={() => sendText(s)}>{s}</button>)}
        </div>
      )}

      {/* input row: text + voice */}
      <form className="convo-input" onSubmit={submit}>
        <button type="button" className={`mic ${voiceOn ? 'live' : ''}`} onClick={toggleVoice} aria-label="Parler à Webbina">
          <WIcon n="mic" size={20} />
        </button>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={voiceOn ? 'Webbina vous écoute…' : 'Écrivez à Webbina…'} />
        <button type="submit" className="send" disabled={!input.trim()} aria-label="Envoyer"><WIcon n="send" size={19} /></button>
      </form>
    </div>
  );
}

window.AvatarStage = AvatarStage;
window.ConversationPanel = ConversationPanel;
window.WIcon = WIcon;
