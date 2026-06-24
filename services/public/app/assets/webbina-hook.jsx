/* ============================================================================
   useWebbina — the hook the UI binds to. Owns the conversation state and wires
   a Transport's normalized events into React state.
   ========================================================================== */
function useWebbina(transportId) {
  const [messages, setMessages] = useState([]);      // {id, who:'webbina'|'user', text, emotion}
  const [streaming, setStreaming] = useState(null);   // {text, emotion} while she speaks
  const [state, setState] = useState('idle');
  const [emotion, setEmotion] = useState('happy');
  const [audioLevel, setAudioLevel] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [status, setStatus] = useState({ connected: false, label: 'Connexion…' });
  const [error, setError] = useState(null);
  const transportRef = useRef(null);
  const streamRef = useRef('');

  useEffect(() => {
    const def = getTransportDef(transportId);
    streamRef.current = '';
    setMessages([]); setStreaming(null); setSuggestions([]); setError(null);
    setState('idle'); setEmotion('happy');

    const handlers = {
      onState: (s) => setState(s),
      onEmotion: (e) => setEmotion(e),
      onAudioLevel: (l) => setAudioLevel(l),
      onStatus: (connected, label) => setStatus({ connected, label }),
      onError: (code, message) => { setError({ code, message }); },
      onUserMessage: (text) => {
        setSuggestions([]);
        setMessages((m) => [...m, { id: Date.now() + Math.random(), who: 'user', text }]);
      },
      onAgentStart: () => { streamRef.current = ''; setStreaming({ text: '', emotion: 'focused' }); },
      onAgentChunk: (chunk) => {
        streamRef.current += chunk;
        setStreaming({ text: streamRef.current, emotion: 'focused' });
      },
      onAgentDone: ({ suggestions: sug } = {}) => {
        const text = streamRef.current;
        setStreaming(null);
        setMessages((m) => [...m, { id: Date.now() + Math.random(), who: 'webbina', text, emotion: deriveEmotion(text) }]);
        setSuggestions(sug || []);
      },
    };

    const transport = def.make(handlers);
    transportRef.current = transport;
    transport.connect();
    return () => { transport.disconnect(); };
  }, [transportId]);

  const sendText = useCallback((text) => {
    const t = (text || '').trim();
    if (!t || !transportRef.current) return;
    setError(null);
    transportRef.current.sendText(t);
  }, []);

  const startVoice = useCallback(() => { transportRef.current?.startVoice(); }, []);
  const stopVoice = useCallback(() => { transportRef.current?.stopVoice(); }, []);

  // Context director: the app sets a product context, Webbina's emotion follows.
  const setContext = useCallback((ctx) => {
    const e = contextToEmotion(ctx);
    setEmotion(e);
    // a celebration is a momentary state; settle back to a warm idle after.
    if (e === 'celebrate') setTimeout(() => setEmotion('happy'), 4200);
  }, []);
  const pushEmotion = useCallback((e) => setEmotion(e), []);

  return {
    messages, streaming, state, emotion, audioLevel, suggestions, status, error,
    sendText, startVoice, stopVoice, setContext, pushEmotion,
    transport: transportRef.current,
  };
}

window.useWebbina = useWebbina;
