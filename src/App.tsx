import { useEffect, useRef, useState, useCallback } from "react";
import "./App.css";

interface Features {
  width: number;
  height: number;
  fileSize: number;
  sharpness: number;
  brightness: number;
  contrast: number;
  edgeDensity: number;
}

interface Comparison {
  psnr: number;
  compressionRatio: number;
  sizeSaved: number;
  featureMatch: {
    sharpness: number;
    brightness: number;
    contrast: number;
    edgeDensity: number;
  };
  matchingPercentage: number;
}

interface Message {
  id: number;
  sender: string;
  content: string;
  type: string;
  originalFeatures?: Features;
  compressedFeatures?: Features;
  comparison?: Comparison;
}

function AnalysisPanel({ msg }: { msg: Message }) {
  const [open, setOpen] = useState(false);
  if (!msg.comparison || !msg.originalFeatures || !msg.compressedFeatures) return null;

  const cmp = msg.comparison;
  const orig = msg.originalFeatures;
  const comp = msg.compressedFeatures;
  const pct = cmp.matchingPercentage ?? 0;
  const cls = pct >= 80 ? "high" : pct >= 50 ? "med" : "low";

  const fmt = (v: number, decimals = 2) => v % 1 === 0 ? String(v) : v.toFixed(decimals);
  const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

  return (
    <div className="analysis">
      <div className="analysis-hdr" onClick={() => setOpen(!open)}>
        <span>📊 {pct.toFixed(1)}% match</span>
        <span>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div className="analysis-body">
          {/* Match bar */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
              <span>Overall Match</span>
              <strong style={{ color: cls === "high" ? "#16a34a" : cls === "med" ? "#d97706" : "#dc2626" }}>
                {pct.toFixed(1)}%
              </strong>
            </div>
            <div className="match-bar-bg">
              <div className={`match-bar ${cls}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </div>

          {/* Compression Stats */}
          <div>
            <div className="section-title">Compression</div>
            <table className="data-table">
              <tbody>
                <tr><td>PSNR</td><td>{fmt(cmp.psnr)} dB</td></tr>
                <tr><td>Compression Ratio</td><td>{fmt(cmp.compressionRatio)}x</td></tr>
                <tr><td>Original Size</td><td>{kb(orig.fileSize)}</td></tr>
                <tr><td>Compressed Size</td><td>{kb(comp.fileSize)}</td></tr>
                <tr>
                  <td>Space Saved</td>
                  <td style={{ color: "#16a34a" }}>
                    {kb(cmp.sizeSaved)} ({((cmp.sizeSaved / orig.fileSize) * 100).toFixed(1)}%)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Feature Comparison */}
          <div>
            <div className="section-title">Feature Comparison</div>
            <table className="data-table">
              <thead>
                <tr><th>Feature</th><th>Original</th><th>Compressed</th><th>Match</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>Sharpness</td>
                  <td>{fmt(orig.sharpness)}</td>
                  <td>{fmt(comp.sharpness)}</td>
                  <td className={cmp.featureMatch.sharpness >= 80 ? "val-good" : cmp.featureMatch.sharpness >= 50 ? "val-warn" : "val-bad"}>
                    {fmt(cmp.featureMatch.sharpness)}%
                  </td>
                </tr>
                <tr>
                  <td>Brightness</td>
                  <td>{fmt(orig.brightness)}</td>
                  <td>{fmt(comp.brightness)}</td>
                  <td className={cmp.featureMatch.brightness >= 80 ? "val-good" : cmp.featureMatch.brightness >= 50 ? "val-warn" : "val-bad"}>
                    {fmt(cmp.featureMatch.brightness)}%
                  </td>
                </tr>
                <tr>
                  <td>Contrast</td>
                  <td>{fmt(orig.contrast)}</td>
                  <td>{fmt(comp.contrast)}</td>
                  <td className={cmp.featureMatch.contrast >= 80 ? "val-good" : cmp.featureMatch.contrast >= 50 ? "val-warn" : "val-bad"}>
                    {fmt(cmp.featureMatch.contrast)}%
                  </td>
                </tr>
                <tr>
                  <td>Edge Density</td>
                  <td>{fmt(orig.edgeDensity, 4)}</td>
                  <td>{fmt(comp.edgeDensity, 4)}</td>
                  <td className={cmp.featureMatch.edgeDensity >= 80 ? "val-good" : cmp.featureMatch.edgeDensity >= 50 ? "val-warn" : "val-bad"}>
                    {fmt(cmp.featureMatch.edgeDensity)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Image Dimensions */}
          <div>
            <div className="section-title">Dimensions</div>
            <table className="data-table">
              <tbody>
                <tr><td>Resolution</td><td>{orig.width} × {orig.height}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [username, setUsername] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [trending, setTrending] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    const s = new WebSocket("ws://localhost:3001");
    s.onopen = () => setConnected(true);
    s.onclose = () => setConnected(false);
    s.onerror = () => setConnected(false);
    s.onmessage = (e) => {
      const d: Message = JSON.parse(e.data);
      setMessages((p) => (p.some((m) => m.id === d.id) ? p : [...p, d]));
    };
    setWs(s);
    return () => s.close();
  }, []);

  const send = useCallback(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN || !input.trim()) return;
    ws.send(JSON.stringify({ type: "message", sender: username, data: input.trim() }));
    setInput("");
  }, [ws, input, username]);

  const upload = useCallback(() => {
    if (!file || !ws || ws.readyState !== WebSocket.OPEN) return;
    const r = new FileReader();
    r.onload = () => {
      ws.send(JSON.stringify({ type: "image", sender: username, data: r.result as string }));
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    };
    r.readAsDataURL(file);
  }, [file, ws, username]);

  const search = useCallback(async () => {
    if (!searchTerm.trim()) return;
    try {
      const res = await fetch("http://localhost:3000/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search: searchTerm.trim() }),
      });
      const data = await res.json();
      setTrending(data.item || null);
    } catch { /* ignore */ }
  }, [searchTerm]);

  const login = () => { if (username.trim()) { setUsername(username.trim()); setLoggedIn(true); } };

  if (!loggedIn) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1>Spark Chat</h1>
          <input
            placeholder="Enter username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
          />
          <button onClick={login}>Join</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <div className="sidebar">
        <h2>Spark Chat</h2>
        <div className="sidebar-user">Logged in as <strong>{username}</strong></div>

        <label>Search</label>
        <div className="search-row">
          <input
            placeholder="Search…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
          <button onClick={search}>Go</button>
        </div>
        {trending && <div className="trending">Trending: {trending}</div>}

        <label>Stats</label>
        <div className="stats">
          <span>{messages.length} msgs</span>
          <span>{messages.filter((m) => m.type === "image").length} imgs</span>
        </div>

        <label>Bot</label>
        <div className="bot-tip">Type <code>/bot question</code> to ask the bot.</div>
      </div>

      {/* Chat */}
      <div className="chat-area">
        <div className="chat-header">
          <h3>Chat</h3>
          <span className={`status-badge ${connected ? "on" : "off"}`}>
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>

        <div className="messages">
          {messages.length === 0 ? (
            <div className="empty">No messages yet</div>
          ) : (
            messages.map((m) => {
              const self = m.sender === username;
              const bot = m.sender === "Bot";
              return (
                <div key={m.id} className={`msg ${self ? "self" : "other"} ${bot ? "bot" : ""}`}>
                  <span className="msg-sender">{bot ? "🤖 Bot" : m.sender}</span>
                  <div className="msg-bubble">
                    {m.type === "image" ? (
                      <>
                        <img className="msg-img" src={m.content} alt="" onClick={() => setLightbox(m.content)} />
                        <AnalysisPanel msg={m} />
                      </>
                    ) : (
                      m.content
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div className="input-bar">
          <input ref={fileRef} type="file" accept="image/*" className="file-input-hidden" id="fu" onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
          <label htmlFor="fu" className="attach-label">📎</label>
          {file && (
            <div className="file-preview">
              <img src={URL.createObjectURL(file)} alt="" />
              <span>{file.name}</span>
              <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}>×</button>
            </div>
          )}
          {file && <button className="upload-go" onClick={upload}>Upload</button>}
          <input type="text" placeholder="Type a message…" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
          <button onClick={send}>Send</button>
        </div>
      </div>

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" />
        </div>
      )}
    </div>
  );
}