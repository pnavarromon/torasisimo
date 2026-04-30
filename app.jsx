// app.jsx — QuizArena prototype
// Live trivia game for 4º ESO — Informática

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ─── Tweak defaults ──────────────────────────────────────────────
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accentHue": 280,
  "questionTime": 20,
  "playerCount": 8,
  "showConfetti": true,
  "soundWaves": true,
  "highContrast": false
}/*EDITMODE-END*/;

// ─── Sample data ─────────────────────────────────────────────────
const QUESTIONS = [
  {
    q: "¿Qué significan las siglas CPU?",
    options: [
      "Central Processing Unit",
      "Computer Personal Use",
      "Control Power Unit",
      "Common Public Utility",
    ],
    correct: 0,
    category: "Hardware",
  },
  {
    q: "¿Cuál de estos NO es un lenguaje de programación?",
    options: ["Python", "JavaScript", "HTML", "Ruby"],
    correct: 2,
    category: "Programación",
    explain: "HTML es un lenguaje de marcado, no de programación.",
  },
  {
    q: "¿Cuántos bits tiene un byte?",
    options: ["4", "8", "16", "32"],
    correct: 1,
    category: "Fundamentos",
  },
  {
    q: "¿Qué protocolo se usa para enviar páginas web de forma segura?",
    options: ["FTP", "SMTP", "HTTPS", "SSH"],
    correct: 2,
    category: "Redes",
  },
  {
    q: "¿Qué dispositivo conecta varias redes entre sí?",
    options: ["Switch", "Hub", "Router", "Repetidor"],
    correct: 2,
    category: "Redes",
  },
  {
    q: "¿En binario, cuánto vale el número decimal 10?",
    options: ["1010", "1100", "0101", "1001"],
    correct: 0,
    category: "Sistemas",
  },
];

const PLAYER_NAMES = [
  "Lucía R.", "Mateo G.", "Sofía P.", "Hugo M.",
  "Valeria L.", "Daniel F.", "Emma C.", "Adrián V.",
  "Carla T.", "Iván S.", "Noa B.", "Leo D.",
];
const AVATAR_EMOJIS = ["🦊","🐼","🦁","🐸","🦄","🐙","🦉","🐧","🐺","🦋","🐢","🐝"];

// ─── Helpers ─────────────────────────────────────────────────────
const SHAPES = ["triangle", "diamond", "circle", "square"];
const SHAPE_COLORS = ["coral", "turquoise", "sun", "lavender"];

function Shape({ kind, size = 22 }) {
  if (kind === "triangle") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24"><polygon points="12,3 22,21 2,21" fill="white"/></svg>
    );
  }
  if (kind === "diamond") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24"><polygon points="12,2 22,12 12,22 2,12" fill="white"/></svg>
    );
  }
  if (kind === "circle") {
    return <svg width={size} height={size} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="white"/></svg>;
  }
  return <svg width={size} height={size} viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" fill="white"/></svg>;
}

function generateRoomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function pickRandom(arr, n) {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < n && copy.length; i++) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

// ─── Root ────────────────────────────────────────────────────────
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = useState("login"); // login | host | join | lobby | question | reveal | leaderboard | final | stats
  const [user, setUser] = useState({ name: "", avatar: "🦊", role: "host" });
  const [roomCode, setRoomCode] = useState(generateRoomCode());
  const [players, setPlayers] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [scores, setScores] = useState({}); // name -> { score, streak, lastDelta }
  const [myAnswer, setMyAnswer] = useState(null); // for the human user

  // Generate fake players based on tweak count
  useEffect(() => {
    const list = pickRandom(PLAYER_NAMES, t.playerCount).map((name, i) => ({
      name,
      avatar: AVATAR_EMOJIS[(i * 3) % AVATAR_EMOJIS.length],
    }));
    setPlayers(list);
  }, [t.playerCount]);

  const startGame = () => {
    const initial = {};
    [user.name || "Tú", ...players.map(p => p.name)].forEach(n => {
      initial[n] = { score: 0, streak: 0, lastDelta: 0, lastCorrect: null };
    });
    setScores(initial);
    setQIndex(0);
    setMyAnswer(null);
    setScreen("question");
  };

  const submitAnswers = (myChoice, msLeft) => {
    const q = QUESTIONS[qIndex];
    const next = { ...scores };

    // user
    const youName = user.name || "Tú";
    const youCorrect = myChoice === q.correct;
    const youSpeedBonus = youCorrect ? Math.round((msLeft / (t.questionTime * 1000)) * 500) : 0;
    const youStreak = youCorrect ? (next[youName]?.streak || 0) + 1 : 0;
    const youMult = 1 + Math.min(youStreak, 5) * 0.2;
    const youDelta = youCorrect ? Math.round((500 + youSpeedBonus) * youMult) : 0;
    next[youName] = {
      score: (next[youName]?.score || 0) + youDelta,
      streak: youStreak,
      lastDelta: youDelta,
      lastCorrect: youCorrect,
      lastChoice: myChoice,
    };

    // bots
    players.forEach((p, i) => {
      const skill = 0.55 + ((i * 31) % 40) / 100; // 0.55–0.94
      const correct = Math.random() < skill;
      const choice = correct ? q.correct : (q.correct + 1 + Math.floor(Math.random() * 3)) % 4;
      const ms = correct ? Math.random() * t.questionTime * 1000 * 0.8 : 0;
      const speedBonus = correct ? Math.round((ms / (t.questionTime * 1000)) * 500) : 0;
      const streak = correct ? (next[p.name]?.streak || 0) + 1 : 0;
      const mult = 1 + Math.min(streak, 5) * 0.2;
      const delta = correct ? Math.round((500 + speedBonus) * mult) : 0;
      next[p.name] = {
        score: (next[p.name]?.score || 0) + delta,
        streak,
        lastDelta: delta,
        lastCorrect: correct,
        lastChoice: choice,
      };
    });

    setScores(next);
    setMyAnswer(myChoice);
    setScreen("reveal");
  };

  const advance = () => {
    if (qIndex + 1 >= QUESTIONS.length) {
      setScreen("final");
    } else {
      setQIndex(qIndex + 1);
      setMyAnswer(null);
      setScreen("question");
    }
  };

  // CSS vars from tweaks
  const cssVars = {
    "--accent-h": t.accentHue,
    "--bg-deep": t.highContrast ? "#0a0613" : "#1a0f2e",
    "--bg-mid": t.highContrast ? "#140926" : "#241845",
  };

  return (
    <div className="qa-root" style={cssVars}>
      <BackgroundFX hue={t.accentHue} />
      {screen === "login" && <LoginScreen onContinue={(name, avatar, role) => {
        setUser({ name, avatar, role });
        setScreen(role === "host" ? "lobby" : "join");
      }} />}
      {screen === "join" && <JoinScreen onJoin={() => setScreen("lobby")} initialCode={roomCode} />}
      {screen === "lobby" && <LobbyScreen
        code={roomCode}
        players={players}
        host={user}
        onStart={startGame}
        onShuffle={() => setRoomCode(generateRoomCode())}
      />}
      {screen === "question" && <QuestionScreen
        q={QUESTIONS[qIndex]}
        index={qIndex}
        total={QUESTIONS.length}
        seconds={t.questionTime}
        playerCount={players.length + 1}
        myStreak={scores[user.name || "Tú"]?.streak || 0}
        myScore={scores[user.name || "Tú"]?.score || 0}
        onSubmit={submitAnswers}
      />}
      {screen === "reveal" && <RevealScreen
        q={QUESTIONS[qIndex]}
        scores={scores}
        myName={user.name || "Tú"}
        myChoice={myAnswer}
        playerCount={players.length + 1}
        showConfetti={t.showConfetti}
        onNext={() => setScreen("leaderboard")}
      />}
      {screen === "leaderboard" && <LeaderboardScreen
        scores={scores}
        myName={user.name || "Tú"}
        myAvatar={user.avatar}
        players={players}
        isLast={qIndex + 1 >= QUESTIONS.length}
        onNext={advance}
      />}
      {screen === "final" && <FinalScreen
        scores={scores}
        myName={user.name || "Tú"}
        myAvatar={user.avatar}
        players={players}
        showConfetti={t.showConfetti}
        onStats={() => setScreen("stats")}
        onAgain={() => { setScreen("lobby"); setRoomCode(generateRoomCode()); }}
      />}
      {screen === "stats" && <StatsScreen
        myName={user.name || "Tú"}
        myAvatar={user.avatar}
        scores={scores}
        onBack={() => setScreen("final")}
      />}

      <TweaksPanel>
        <TweakSection label="Tema" />
        <TweakSlider label="Tono de acento" value={t.accentHue} min={0} max={360} step={5} unit="°"
                     onChange={(v) => setTweak('accentHue', v)} />
        <TweakToggle label="Alto contraste" value={t.highContrast}
                     onChange={(v) => setTweak('highContrast', v)} />
        <TweakSection label="Juego" />
        <TweakSlider label="Tiempo por pregunta" value={t.questionTime} min={5} max={45} step={1} unit="s"
                     onChange={(v) => setTweak('questionTime', v)} />
        <TweakSlider label="Nº de jugadores" value={t.playerCount} min={2} max={12} step={1}
                     onChange={(v) => setTweak('playerCount', v)} />
        <TweakSection label="Efectos" />
        <TweakToggle label="Confeti al acertar" value={t.showConfetti}
                     onChange={(v) => setTweak('showConfetti', v)} />
        <TweakToggle label="Ondas de sonido" value={t.soundWaves}
                     onChange={(v) => setTweak('soundWaves', v)} />
      </TweaksPanel>
    </div>
  );
}

// ─── Background FX ───────────────────────────────────────────────
function BackgroundFX({ hue }) {
  return (
    <div className="qa-bg">
      <div className="qa-blob qa-blob-1" style={{ background: `oklch(0.65 0.22 ${hue})` }} />
      <div className="qa-blob qa-blob-2" style={{ background: `oklch(0.7 0.2 ${(hue + 60) % 360})` }} />
      <div className="qa-blob qa-blob-3" style={{ background: `oklch(0.6 0.22 ${(hue + 180) % 360})` }} />
      <div className="qa-grid" />
    </div>
  );
}

// ─── Login ───────────────────────────────────────────────────────
function LoginScreen({ onContinue }) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🦊");
  const [role, setRole] = useState("host");

  return (
    <div className="qa-screen qa-center">
      <div className="qa-login-card">
        <div className="qa-logo">
          <div className="qa-logo-mark">
            <svg viewBox="0 0 60 60" width="56" height="56">
              <polygon points="30,6 54,42 6,42" fill="oklch(0.78 0.22 var(--accent-h))" />
              <circle cx="30" cy="46" r="6" fill="oklch(0.85 0.18 calc(var(--accent-h) + 60))" />
            </svg>
          </div>
          <div>
            <div className="qa-wordmark">QuizArena</div>
            <div className="qa-tagline">Trivia en directo · 4º ESO</div>
          </div>
        </div>

        <div className="qa-field">
          <label>Tu nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Escribe tu nombre"
            maxLength={16}
          />
        </div>

        <div className="qa-field">
          <label>Elige avatar</label>
          <div className="qa-avatar-grid">
            {AVATAR_EMOJIS.map((a) => (
              <button
                key={a}
                className={`qa-avatar ${avatar === a ? "is-active" : ""}`}
                onClick={() => setAvatar(a)}
              >{a}</button>
            ))}
          </div>
        </div>

        <div className="qa-field">
          <label>¿Qué quieres hacer?</label>
          <div className="qa-role-toggle">
            <button
              className={`qa-role ${role === "host" ? "is-active" : ""}`}
              onClick={() => setRole("host")}
            >
              <div className="qa-role-icon">🎤</div>
              <div>
                <div className="qa-role-title">Crear sala</div>
                <div className="qa-role-sub">Soy el profe / anfitrión</div>
              </div>
            </button>
            <button
              className={`qa-role ${role === "player" ? "is-active" : ""}`}
              onClick={() => setRole("player")}
            >
              <div className="qa-role-icon">🎮</div>
              <div>
                <div className="qa-role-title">Unirme</div>
                <div className="qa-role-sub">Tengo un código</div>
              </div>
            </button>
          </div>
        </div>

        <button
          className="qa-btn qa-btn-primary qa-btn-block"
          disabled={!name.trim()}
          onClick={() => onContinue(name.trim(), avatar, role)}
        >
          Continuar →
        </button>
      </div>
    </div>
  );
}

// ─── Join with code ──────────────────────────────────────────────
function JoinScreen({ onJoin, initialCode }) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const refs = useRef([]);

  const setDigit = (i, v) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
  };

  const allFilled = digits.every(d => d !== "");

  return (
    <div className="qa-screen qa-center">
      <div className="qa-join-card">
        <div className="qa-join-domain">torasisimo.com/test</div>
        <div className="qa-join-title">Introduce el código</div>
        <div className="qa-join-sub">El profesor lo está mostrando en pantalla</div>
        <div className="qa-pin">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => refs.current[i] = el}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => { if (e.key === "Backspace" && !d && i > 0) refs.current[i - 1]?.focus(); }}
              maxLength={1}
              inputMode="numeric"
              className="qa-pin-cell"
            />
          ))}
        </div>
        <button className="qa-btn qa-btn-primary qa-btn-block" disabled={!allFilled} onClick={onJoin}>
          Entrar a la sala
        </button>
        <button className="qa-pin-hint" onClick={() => setDigits(initialCode.split(""))}>
          (demo) usar código <b>{initialCode}</b>
        </button>
      </div>
    </div>
  );
}

// ─── QR code (visual, deterministic from input) ─────────────────
function QRCode({ text, size = 180 }) {
  // Deterministic pseudo-QR pattern derived from the input string.
  // Looks like a QR code (finder squares + data modules) and changes
  // when the URL changes. Not a real QR — purely visual for the prototype.
  const grid = 25;
  const cells = useMemo(() => {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const out = [];
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        // Reserve finder squares (3 corners) and timing pattern
        const inFinder = (a, b) => x >= a && x < a + 7 && y >= b && y < b + 7;
        if (inFinder(0, 0) || inFinder(grid - 7, 0) || inFinder(0, grid - 7)) continue;
        h = Math.imul(h ^ (x * 73856093) ^ (y * 19349663), 16777619);
        if ((h >>> 0) % 100 < 48) out.push([x, y]);
      }
    }
    return out;
  }, [text]);

  const finder = (x, y) => (
    <g key={`f-${x}-${y}`}>
      <rect x={x} y={y} width="7" height="7" fill="#0a0613" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
      <rect x={x + 2} y={y + 2} width="3" height="3" fill="#0a0613" />
    </g>
  );

  return (
    <div className="qa-qr" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${grid} ${grid}`} width={size} height={size} shapeRendering="crispEdges">
        <rect width={grid} height={grid} fill="#fff" />
        {cells.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#0a0613" />
        ))}
        {finder(0, 0)}
        {finder(grid - 7, 0)}
        {finder(0, grid - 7)}
      </svg>
    </div>
  );
}

// ─── Lobby ───────────────────────────────────────────────────────
function LobbyScreen({ code, players, host, onStart, onShuffle }) {
  const domain = "torasisimo.com/test";
  const joinUrl = `https://${domain}?c=${code}`;

  return (
    <div className="qa-screen">
      <div className="qa-lobby">
        <div className="qa-lobby-left">
          <div className="qa-eyebrow">SALA #{code.slice(0,3)}</div>
          <h1 className="qa-h1">Únete a la partida</h1>

          <div className="qa-join-panel">
            <div className="qa-join-steps">
              <div className="qa-join-step">
                <div className="qa-join-step-num">1</div>
                <div>
                  <div className="qa-join-step-lbl">Entra en</div>
                  <div className="qa-join-step-val">torasisimo.com/test</div>
                </div>
              </div>
              <div className="qa-join-step">
                <div className="qa-join-step-num">2</div>
                <div>
                  <div className="qa-join-step-lbl">Introduce el código</div>
                  <div className="qa-code">
                    {code.split("").map((d, i) => (
                      <span key={i} className="qa-code-digit qa-code-digit-sm">{d}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="qa-qr-wrap">
              <QRCode text={joinUrl} size={170} />
              <div className="qa-qr-cap">o escanea</div>
            </div>
          </div>

          <div className="qa-lobby-info">
            <div className="qa-info-row">
              <span className="qa-info-bullet" />
              <span><b>Informática</b> · 6 preguntas · 4º ESO</span>
            </div>
            <div className="qa-info-row">
              <span className="qa-info-bullet" />
              <span>Sistema de rachas con multiplicador hasta <b>×2.0</b></span>
            </div>
            <button className="qa-code-shuffle qa-code-shuffle-inline" onClick={onShuffle}>↻ generar nuevo código</button>
          </div>
        </div>

        <div className="qa-lobby-right">
          <div className="qa-players-head">
            <div>
              <div className="qa-players-count">{players.length}<span>/12</span></div>
              <div className="qa-players-label">jugadores conectados</div>
            </div>
            <div className="qa-host-chip">
              <span className="qa-host-avatar">{host.avatar}</span>
              <span><b>{host.name}</b><br/><small>anfitrión</small></span>
            </div>
          </div>

          <div className="qa-players-grid">
            {players.map((p, i) => (
              <div
                key={p.name}
                className="qa-player-chip"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <span className="qa-player-avatar">{p.avatar}</span>
                <span className="qa-player-name">{p.name}</span>
              </div>
            ))}
            {Array.from({ length: Math.max(0, 12 - players.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="qa-player-chip qa-player-empty">
                <span className="qa-player-avatar">·</span>
                <span className="qa-player-name">esperando…</span>
              </div>
            ))}
          </div>

          <button className="qa-btn qa-btn-primary qa-btn-xl qa-btn-block" onClick={onStart}>
            Empezar partida ▶
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Question screen ─────────────────────────────────────────────
function QuestionScreen({ q, index, total, seconds, playerCount, myStreak, myScore, onSubmit }) {
  const [msLeft, setMsLeft] = useState(seconds * 1000);
  const [picked, setPicked] = useState(null);
  const [answered, setAnswered] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    setMsLeft(seconds * 1000);
    setPicked(null);
    setAnswered(0);
    startRef.current = Date.now();
  }, [q]);

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const left = Math.max(0, seconds * 1000 - elapsed);
      setMsLeft(left);
      // simulate other players answering
      setAnswered(prev => Math.min(playerCount - 1, prev + (Math.random() < 0.35 ? 1 : 0)));
      if (left === 0) {
        clearInterval(id);
        onSubmit(picked ?? -1, 0);
      }
    }, 100);
    return () => clearInterval(id);
  }, [q, seconds, picked]);

  const pct = msLeft / (seconds * 1000);
  const secondsDisplay = Math.ceil(msLeft / 1000);
  const urgent = pct < 0.3;

  const choose = (i) => {
    if (picked !== null) return;
    setPicked(i);
    // small delay to let animation play
    setTimeout(() => onSubmit(i, msLeft), 600);
  };

  return (
    <div className="qa-screen">
      <div className="qa-q">
        {/* Top bar */}
        <div className="qa-q-topbar">
          <div className="qa-q-progress">
            <span className="qa-q-num">{String(index + 1).padStart(2, "0")}</span>
            <span className="qa-q-of">/ {String(total).padStart(2, "0")}</span>
            <span className="qa-q-cat">{q.category}</span>
          </div>
          <div className="qa-q-stats">
            <div className="qa-stat">
              <span className="qa-stat-lbl">racha</span>
              <span className="qa-stat-val">×{(1 + Math.min(myStreak, 5) * 0.2).toFixed(1)}</span>
              {myStreak > 0 && <span className="qa-flames">{"🔥".repeat(Math.min(myStreak, 3))}</span>}
            </div>
            <div className="qa-stat">
              <span className="qa-stat-lbl">puntos</span>
              <span className="qa-stat-val">{myScore.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Timer + question */}
        <div className="qa-q-main">
          <div className={`qa-timer ${urgent ? "is-urgent" : ""}`}>
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="6" />
              <circle
                cx="50" cy="50" r="44" fill="none"
                stroke={urgent ? "oklch(0.7 0.25 25)" : `oklch(0.78 0.22 var(--accent-h))`}
                strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 44}`}
                strokeDashoffset={`${2 * Math.PI * 44 * (1 - pct)}`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                style={{ transition: "stroke-dashoffset .1s linear, stroke .3s" }}
              />
            </svg>
            <div className="qa-timer-num">{secondsDisplay}</div>
          </div>

          <div className="qa-q-text-wrap">
            <div className="qa-q-eyebrow">PREGUNTA {index + 1}</div>
            <h2 className="qa-q-text">{q.q}</h2>
            <div className="qa-q-meter">
              <div className="qa-q-meter-bar">
                <div
                  className="qa-q-meter-fill"
                  style={{ width: `${(answered / Math.max(1, playerCount - 1)) * 100}%` }}
                />
              </div>
              <span className="qa-q-meter-label">
                {answered} de {playerCount - 1} ya respondieron
              </span>
            </div>
          </div>
        </div>

        {/* Answer grid */}
        <div className="qa-answers">
          {q.options.map((opt, i) => (
            <button
              key={i}
              className={`qa-answer qa-answer-${SHAPE_COLORS[i]} ${picked === i ? "is-picked" : ""} ${picked !== null && picked !== i ? "is-dimmed" : ""}`}
              onClick={() => choose(i)}
              disabled={picked !== null}
            >
              <div className="qa-answer-shape">
                <Shape kind={SHAPES[i]} size={28} />
              </div>
              <div className="qa-answer-text">{opt}</div>
              <div className="qa-answer-key">{["A","B","C","D"][i]}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Reveal ──────────────────────────────────────────────────────
function RevealScreen({ q, scores, myName, myChoice, playerCount, showConfetti, onNext }) {
  const myEntry = scores[myName] || {};
  const correct = myEntry.lastCorrect;
  const delta = myEntry.lastDelta || 0;
  const streak = myEntry.streak || 0;

  // distribution of answers among bots
  const dist = useMemo(() => {
    const counts = [0, 0, 0, 0];
    Object.entries(scores).forEach(([name, s]) => {
      if (typeof s.lastChoice === "number" && s.lastChoice >= 0) counts[s.lastChoice]++;
    });
    return counts;
  }, [scores]);

  const total = dist.reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="qa-screen">
      <div className="qa-reveal">
        <div className={`qa-reveal-banner ${correct ? "is-correct" : "is-wrong"}`}>
          <div className="qa-reveal-icon">
            {correct ? (
              <svg viewBox="0 0 24 24" width="48" height="48"><path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="48" height="48"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"/></svg>
            )}
          </div>
          <div className="qa-reveal-title">
            {correct ? "¡Correcto!" : myChoice === -1 ? "Se acabó el tiempo" : "Fallaste"}
          </div>
          {correct && (
            <div className="qa-reveal-points">
              +{delta.toLocaleString()} pts
              {streak > 1 && <span className="qa-reveal-mult">racha ×{(1 + Math.min(streak, 5) * 0.2).toFixed(1)} 🔥</span>}
            </div>
          )}
        </div>

        <div className="qa-reveal-question">
          <div className="qa-reveal-eyebrow">RESPUESTA CORRECTA</div>
          <div className="qa-reveal-q">{q.q}</div>
          {q.explain && <div className="qa-reveal-explain">{q.explain}</div>}
        </div>

        <div className="qa-reveal-bars">
          {q.options.map((opt, i) => {
            const count = dist[i];
            const w = (count / total) * 100;
            const isCorrect = i === q.correct;
            const isMine = myChoice === i;
            return (
              <div key={i} className={`qa-revbar qa-answer-${SHAPE_COLORS[i]} ${isCorrect ? "is-correct" : "is-fade"}`}>
                <div className="qa-revbar-shape"><Shape kind={SHAPES[i]} size={20} /></div>
                <div className="qa-revbar-track">
                  <div className="qa-revbar-fill" style={{ width: `${w}%` }}>
                    <span className="qa-revbar-text">{opt}</span>
                  </div>
                  {isMine && <span className="qa-revbar-mine">tu respuesta</span>}
                </div>
                <div className="qa-revbar-count">{count}</div>
              </div>
            );
          })}
        </div>

        <button className="qa-btn qa-btn-primary qa-btn-xl" onClick={onNext}>
          Ver clasificación →
        </button>
      </div>
      {correct && showConfetti && <Confetti />}
    </div>
  );
}

// ─── Confetti ────────────────────────────────────────────────────
function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 60 }).map((_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    duration: 1.6 + Math.random() * 1.2,
    rot: Math.random() * 360,
    hue: Math.floor(Math.random() * 360),
    size: 6 + Math.random() * 8,
  })), []);
  return (
    <div className="qa-confetti">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="qa-confetto"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            background: `oklch(0.75 0.2 ${p.hue})`,
            width: p.size,
            height: p.size,
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Leaderboard ─────────────────────────────────────────────────
function LeaderboardScreen({ scores, myName, myAvatar, players, isLast, onNext }) {
  const ranked = useMemo(() => {
    return Object.entries(scores)
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => b.score - a.score);
  }, [scores]);

  const avatarFor = (name) => {
    if (name === myName) return myAvatar;
    return players.find(p => p.name === name)?.avatar || "🎮";
  };

  return (
    <div className="qa-screen">
      <div className="qa-leader">
        <div className="qa-leader-head">
          <div className="qa-eyebrow">CLASIFICACIÓN</div>
          <h1 className="qa-h1">Top de la sala</h1>
          <div className="qa-leader-sub">
            {isLast ? "Resumen final tras la última pregunta" : "Vamos a por la siguiente pregunta…"}
          </div>
        </div>

        <div className="qa-leader-list">
          {ranked.slice(0, 8).map((p, i) => (
            <div
              key={p.name}
              className={`qa-leader-row ${p.name === myName ? "is-me" : ""} ${i < 3 ? `is-podium-${i+1}` : ""}`}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="qa-leader-rank">{String(i + 1).padStart(2, "0")}</div>
              <div className="qa-leader-avatar">{avatarFor(p.name)}</div>
              <div className="qa-leader-name">
                {p.name}
                {p.name === myName && <span className="qa-you-tag">tú</span>}
                {p.streak >= 3 && <span className="qa-leader-fire">🔥 racha {p.streak}</span>}
              </div>
              <div className="qa-leader-delta">
                {p.lastDelta > 0 ? `+${p.lastDelta}` : "—"}
              </div>
              <div className="qa-leader-score">{p.score.toLocaleString()}</div>
            </div>
          ))}
        </div>

        <button className="qa-btn qa-btn-primary qa-btn-xl" onClick={onNext}>
          {isLast ? "Resultados finales 🏆" : "Siguiente pregunta →"}
        </button>
      </div>
    </div>
  );
}

// ─── Final podium ────────────────────────────────────────────────
function FinalScreen({ scores, myName, myAvatar, players, showConfetti, onStats, onAgain }) {
  const ranked = useMemo(() => {
    return Object.entries(scores)
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => b.score - a.score);
  }, [scores]);

  const avatarFor = (name) => {
    if (name === myName) return myAvatar;
    return players.find(p => p.name === name)?.avatar || "🎮";
  };

  const top3 = ranked.slice(0, 3);
  const myRank = ranked.findIndex(r => r.name === myName) + 1;

  return (
    <div className="qa-screen">
      <div className="qa-final">
        <div className="qa-final-head">
          <div className="qa-eyebrow">PARTIDA TERMINADA</div>
          <h1 className="qa-final-title">El podio</h1>
        </div>

        <div className="qa-podium">
          {[1, 0, 2].map(idx => {
            const p = top3[idx];
            if (!p) return <div key={idx} className="qa-podium-slot qa-podium-empty" />;
            const place = idx + 1;
            return (
              <div key={p.name} className={`qa-podium-slot qa-podium-${place}`}>
                <div className="qa-podium-medal">{place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉"}</div>
                <div className="qa-podium-avatar">{avatarFor(p.name)}</div>
                <div className="qa-podium-name">{p.name}{p.name === myName && <span className="qa-you-tag">tú</span>}</div>
                <div className="qa-podium-bar">
                  <div className="qa-podium-place">{place}</div>
                  <div className="qa-podium-score">{p.score.toLocaleString()}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="qa-final-me">
          <div className="qa-final-me-row">
            <div>
              <div className="qa-eyebrow">TU RESULTADO</div>
              <div className="qa-final-me-rank">#{myRank}<span>de {ranked.length}</span></div>
            </div>
            <div className="qa-final-me-stats">
              <div><span className="qa-stat-lbl">puntos</span><span className="qa-stat-val">{(scores[myName]?.score || 0).toLocaleString()}</span></div>
              <div><span className="qa-stat-lbl">racha máx.</span><span className="qa-stat-val">{scores[myName]?.streak || 0}🔥</span></div>
            </div>
          </div>
        </div>

        <div className="qa-final-actions">
          <button className="qa-btn qa-btn-ghost" onClick={onStats}>Ver mis estadísticas</button>
          <button className="qa-btn qa-btn-primary qa-btn-xl" onClick={onAgain}>Jugar otra vez ↻</button>
        </div>
      </div>
      {showConfetti && myRank <= 3 && <Confetti />}
    </div>
  );
}

// ─── Stats ───────────────────────────────────────────────────────
function StatsScreen({ myName, myAvatar, scores, onBack }) {
  const me = scores[myName] || {};
  const myScore = me.score || 0;
  const allScores = Object.values(scores).map(s => s.score);
  const max = Math.max(...allScores, 1);
  const avg = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);

  return (
    <div className="qa-screen">
      <div className="qa-stats">
        <button className="qa-back" onClick={onBack}>← volver</button>
        <div className="qa-stats-head">
          <div className="qa-stats-avatar">{myAvatar}</div>
          <div>
            <div className="qa-eyebrow">PERFIL DE JUGADOR</div>
            <h1 className="qa-h1">{myName}</h1>
          </div>
        </div>

        <div className="qa-stats-grid">
          <div className="qa-stat-card">
            <div className="qa-stat-card-lbl">Puntos totales</div>
            <div className="qa-stat-card-val">{myScore.toLocaleString()}</div>
            <div className="qa-stat-card-foot">vs media de sala: <b>{avg.toLocaleString()}</b></div>
          </div>
          <div className="qa-stat-card">
            <div className="qa-stat-card-lbl">Racha máxima</div>
            <div className="qa-stat-card-val">{me.streak || 0} 🔥</div>
            <div className="qa-stat-card-foot">multiplicador hasta ×{(1 + Math.min(me.streak || 0, 5) * 0.2).toFixed(1)}</div>
          </div>
          <div className="qa-stat-card">
            <div className="qa-stat-card-lbl">% del líder</div>
            <div className="qa-stat-card-val">{Math.round((myScore / max) * 100)}%</div>
            <div className="qa-stat-card-bar">
              <div className="qa-stat-card-fill" style={{ width: `${(myScore / max) * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="qa-stats-categories">
          <div className="qa-eyebrow">DOMINIO POR CATEGORÍA</div>
          {[
            { name: "Hardware", val: 80 },
            { name: "Programación", val: 65 },
            { name: "Redes", val: 50 },
            { name: "Sistemas", val: 90 },
            { name: "Fundamentos", val: 75 },
          ].map(c => (
            <div key={c.name} className="qa-cat-row">
              <span className="qa-cat-name">{c.name}</span>
              <div className="qa-cat-track">
                <div className="qa-cat-fill" style={{ width: `${c.val}%` }} />
              </div>
              <span className="qa-cat-val">{c.val}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Mount
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
