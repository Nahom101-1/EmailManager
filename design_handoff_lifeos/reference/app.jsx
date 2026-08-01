/* LifeOS app shell — routing, theme, sync engine, tweaks */
const { useState: uS, useEffect: uE, useRef: uR } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "style": "flat",
  "accent": "green",
  "density": "cozy",
  "layout": "cards",
  "dark": false
}/*EDITMODE-END*/;

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "assistant", label: "Assistant", icon: "bolt" },
  { id: "connect", label: "Connect", icon: "connect" },
  { id: "inbox-sync", label: "Inbox Sync", icon: "sync" },
  { id: "subscriptions", label: "Subscriptions", icon: "subs", count: (a) => a.subs.length },
  { id: "accounts", label: "Accounts", icon: "accounts", count: (a) => a.accounts.length },
  { id: "settings", label: "Settings", icon: "settings" },
];

const CRUMB = {
  dashboard: ["Dashboard"], connect: ["Connect"], "inbox-sync": ["Inbox Sync"],
  subscriptions: ["Subscriptions"], accounts: ["Accounts"], settings: ["Settings"],
  assistant: ["Assistant"], account: ["Accounts", "Detail"], home: ["Home"],
};

const SYNC_STEPS = [
  { k: "token", label: "Refreshing token" },
  { k: "fetch", label: "Fetching messages" },
  { k: "store", label: "Storing metadata" },
  { k: "detect", label: "Detecting subscriptions" },
  { k: "done", label: "Complete" },
];

function SyncModal({ target, app, onClose }) {
  const [step, setStep] = uS(0);
  const [fetched, setFetched] = uS(0);
  const ib = target === "all" ? null : app.inboxes.find((i) => i.id === target);
  const newMsgs = 142, newSubs = 1, newAccts = 2;

  uE(() => {
    let alive = true;
    const seq = [600, 900, 700, 850, 500];
    let i = 0;
    const tick = () => {
      if (!alive) return;
      if (i < seq.length - 1) { i++; setStep(i); setTimeout(tick, seq[i]); }
    };
    setTimeout(tick, seq[0]);
    // count up fetched during fetch step
    const counter = setInterval(() => setFetched((f) => (f < newMsgs ? Math.min(newMsgs, f + 9) : f)), 60);
    return () => { alive = false; clearInterval(counter); };
  }, []);

  const done = step >= SYNC_STEPS.length - 1;
  uE(() => {
    if (done) {
      const t = setTimeout(() => {
        app.finishSync(target, { newMsgs, newSubs, newAccts });
      }, 400);
      return () => clearTimeout(t);
    }
  }, [done]);

  return (
    <div className="modal-scrim" onClick={done ? onClose : undefined}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="mono-tile sm" style={{ color: "var(--accent)" }}><Icon name={done ? "check" : "sync"} size={15} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 650, fontSize: 13.5 }}>{done ? "Sync complete" : "Syncing inbox"}</div>
            <div className="row-sub mono">{ib ? ib.email : "All active inboxes"}</div>
          </div>
          {done && <button className="btn ghost icon sm" onClick={onClose}><Icon name="x" size={16} /></button>}
        </div>
        <div className="modal-body">
          {!done ? (
            <div className="steps">
              {SYNC_STEPS.slice(0, 4).map((s, i) => (
                <div key={s.k} className={"step " + (i < step ? "done" : i === step ? "active" : "")}>
                  <span className="sdot">{i < step ? <Icon name="check" size={11} /> : i === step ? <span className="spin"></span> : null}</span>
                  {s.label}
                  {s.k === "fetch" && i <= step && <span className="sval">{fetched} msgs</span>}
                  {s.k === "detect" && i < step && <span className="sval">{newSubs} sub · {newAccts} acct</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { l: "Messages scanned", v: fetched },
                { l: "New messages", v: newMsgs },
                { l: "Subscriptions", v: newSubs },
                { l: "Accounts", v: newAccts },
              ].map((r) => (
                <div key={r.l} className="card" style={{ padding: 13, background: "var(--surface-inset)" }}>
                  <div className="stat" style={{ padding: 0, gap: 4 }}><span className="label">{r.l}</span><span className="val" style={{ fontSize: 22 }}>{r.v}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
        {done && (
          <div className="modal-foot">
            <span className="faint mono center" style={{ fontSize: 11, marginRight: "auto" }}><Icon name="clock" size={12} />&nbsp;Last synced just now</span>
            <Btn size="sm" variant="ghost" onClick={() => { onClose(); app.nav("subscriptions"); }}>View subscriptions</Btn>
            <Btn size="sm" variant="primary" onClick={onClose}>Done</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

function Toasts({ list }) {
  return (
    <div className="toasts">
      {list.map((t) => (
        <div key={t.id} className="toast">
          <span className={"t-ic " + (t.kind === "err" ? "err" : "ok")}><Icon name={t.kind === "err" ? "alert" : "check"} size={13} /></span>
          <div className="t-body"><div className="tt">{t.msg}</div>{t.sub && <div className="ts">{t.sub}</div>}</div>
        </div>
      ))}
    </div>
  );
}

function AccentSwatches({ value, onChange }) {
  const opts = [
    { v: "green", c: "oklch(0.52 0.085 158)" }, { v: "blue", c: "oklch(0.55 0.12 252)" },
    { v: "violet", c: "oklch(0.55 0.14 295)" }, { v: "amber", c: "oklch(0.62 0.13 62)" },
    { v: "graphite", c: "oklch(0.42 0.012 250)" },
  ];
  return (
    <div className="center gap8" style={{ padding: "2px 0" }}>
      {opts.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} title={o.v}
          style={{ width: 26, height: 26, borderRadius: 7, background: o.c, border: value === o.v ? "2px solid var(--ink)" : "2px solid var(--border)", cursor: "pointer", outline: value === o.v ? "2px solid var(--bg)" : "none", outlineOffset: -4 }} />
      ))}
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = uS({ name: "home", params: {} });
  const [inboxes, setInboxes] = uS(window.DATA.inboxes.map((x) => ({ ...x })));
  const [subs, setSubs] = uS(window.DATA.subs.map((x) => ({ ...x })));
  const [accounts, setAccounts] = uS(window.DATA.accounts.map((x) => ({ ...x })));
  const [sync, setSync] = uS(null);
  const [toasts, setToasts] = uS([]);
  const tid = uR(0);

  const theme = t.dark ? "dark" : "light";
  uE(() => {
    const r = document.documentElement;
    r.setAttribute("data-theme", theme);
    r.setAttribute("data-style", t.style);
    r.setAttribute("data-accent", t.accent);
    r.setAttribute("data-density", t.density);
  }, [theme, t.style, t.accent, t.density]);

  const toast = (msg, kind, sub) => {
    const id = ++tid.current;
    setToasts((l) => [...l, { id, msg, kind, sub }]);
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), 3200);
  };

  const app = {
    theme, tweaks: t, setTweak,
    inboxes, subs, accounts,
    layout: t.layout, setLayout: (v) => setTweak("layout", v),
    setTheme: (v) => setTweak("dark", v === "dark"),
    toggleTheme: () => setTweak("dark", !t.dark),
    nav: (name, params = {}) => { setRoute({ name, params }); document.querySelector(".scroll") && (document.querySelector(".scroll").scrollTop = 0); },
    toast,
    setSub: (id, status) => {
      if (status === "ignored") { setSubs((l) => l.filter((s) => s.id !== id)); toast("Subscription ignored"); return; }
      setSubs((l) => l.map((s) => (s.id === id ? { ...s, status } : s)));
      toast("Marked as " + status, "ok");
    },
    setAcct: (id, status) => {
      if (status === "ignored") { setAccounts((l) => l.filter((a) => a.id !== id)); toast("Account ignored"); return; }
      setAccounts((l) => l.map((a) => (a.id === id ? { ...a, status } : a)));
      toast("Marked as " + status, "ok");
    },
    startSync: (target) => {
      if (target !== "all") setInboxes((l) => l.map((i) => (i.id === target ? { ...i, status: "syncing" } : i)));
      setSync({ target });
    },
    finishSync: (target, res) => {
      setInboxes((l) => l.map((i) => (target === "all" || i.id === target ? (i.status === "error" ? i : { ...i, status: "active", lastSync: "just now" }) : i)));
    },
    closeSync: () => { setSync(null); toast("Sync complete", "ok", "142 new messages scanned"); },
  };

  if (route.name === "home") {
    return (<><HomeScreen app={app} /><TweaksUI t={t} setTweak={setTweak} /><Toasts list={toasts} /></>);
  }

  let screen;
  switch (route.name) {
    case "dashboard": screen = <Dashboard app={app} />; break;
    case "assistant": screen = <AssistantScreen app={app} />; break;
    case "connect": screen = <ConnectScreen app={app} />; break;
    case "inbox-sync": screen = <SyncScreen app={app} />; break;
    case "subscriptions": screen = <SubscriptionsScreen app={app} />; break;
    case "accounts": screen = <AccountsScreen app={app} />; break;
    case "account": screen = <AccountDetail app={app} id={route.params.id} />; break;
    case "settings": screen = <SettingsScreen app={app} />; break;
    default: screen = <Dashboard app={app} />;
  }

  const crumbs = CRUMB[route.name] || ["Dashboard"];

  return (
    <div className="app">
      {/* sidebar */}
      <aside className="side">
        <button className="brand" style={{ background: "none", border: 0, width: "100%", textAlign: "left" }} onClick={() => app.nav("home")}>
          <span className="brand-mark"><Icon name="layers" size={16} /></span>
          <span className="brand-name">Life<b>OS</b></span>
        </button>
        <div className="side-label">Workspace</div>
        {NAV.map((n) => (
          <button key={n.id} className={"nav-item" + (route.name === n.id || (n.id === "accounts" && route.name === "account") ? " on" : "")} onClick={() => app.nav(n.id)}>
            <span className="nav-ic"><Icon name={n.icon} size={16} /></span>{n.label}
            {n.count && <span className="nav-count">{n.count(app)}</span>}
          </button>
        ))}
        <div className="side-foot">
          <div className="notice accent" style={{ padding: "10px 11px", flexDirection: "column", gap: 7 }}>
            <div className="center gap6" style={{ fontSize: 11.5, fontWeight: 650, color: "var(--accent)", whiteSpace: "nowrap" }}><Icon name="lock" size={12} />Local-first</div>
            <div style={{ fontSize: 11, color: "var(--ink-3)", lineHeight: 1.4 }}>All data stays on this machine. Read-only access only.</div>
          </div>
          <div className="side-acct">
            <span className="ava">AR</span>
            <div className="meta"><div className="n">Alex Rivera</div><div className="s">3 inboxes · local</div></div>
            <Icon name="settings" size={14} className="faint" style={{ marginLeft: "auto" }} />
          </div>
        </div>
      </aside>

      {/* main */}
      <div className="main">
        <div className="topbar">
          <div className="crumbs">
            <span>LifeOS</span>
            {crumbs.map((c, i) => (<React.Fragment key={i}><Icon name="chevR" size={13} /><span className={i === crumbs.length - 1 ? "cur" : ""}>{c}</span></React.Fragment>))}
          </div>
          <div className="topbar-spacer"></div>
          <div className="searchbox"><Icon name="search" size={15} /><input placeholder="Search subscriptions, accounts…" /><kbd>⌘K</kbd></div>
          <Btn variant="ghost" size="sm" icon="bolt" onClick={() => app.nav("assistant")} />
          <Btn variant="ghost" size="sm" icon={t.dark ? "sun" : "moon"} onClick={app.toggleTheme} />
        </div>
        <div className="scroll">{screen}</div>
      </div>

      {sync && <SyncModal target={sync.target} app={app} onClose={() => { setSync(null); toast("Sync complete", "ok", "142 new messages · 1 subscription · 2 accounts"); }} />}
      <TweaksUI t={t} setTweak={setTweak} />
      <Toasts list={toasts} />
    </div>
  );
}

function TweaksUI({ t, setTweak }) {
  return (
    <TweaksPanel>
      <TweakSection label="Visual style" />
      <TweakRadio label="Surface" value={t.style} options={["flat", "soft", "grid"]} onChange={(v) => setTweak("style", v)} />
      <TweakRow label="Accent"><AccentSwatches value={t.accent} onChange={(v) => setTweak("accent", v)} /></TweakRow>
      <TweakToggle label="Dark mode" value={t.dark} onChange={(v) => setTweak("dark", v)} />
      <TweakSection label="Layout" />
      <TweakRadio label="Density" value={t.density} options={["compact", "cozy", "comfy"]} onChange={(v) => setTweak("density", v)} />
      <TweakRadio label="Lists" value={t.layout} options={["cards", "table"]} onChange={(v) => setTweak("layout", v)} />
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
