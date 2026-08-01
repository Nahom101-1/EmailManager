/* Connect + Inbox Sync */
const { useState } = React;

function ConnectScreen({ app }) {
  return (
    <div className="page fade-in" style={{ maxWidth: 920 }}>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Connect</div>
          <h1 className="page-title">Connect an inbox</h1>
          <p className="page-sub">Add an email account so LifeOS can scan metadata for subscriptions and accounts. Read-only — your messages are never modified.</p>
        </div>
      </div>

      <GoogleConnect app={app} />

      <div className="section-label">Other methods</div>
      <ImapConnect app={app} />

      {app.inboxes.length > 0 && (
        <>
          <div className="section-label">Connected</div>
          <Card>
            <div className="list">
              {app.inboxes.map((ib) => (
                <div key={ib.id} className="list-row">
                  <Provider provider={ib.provider} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="center gap8"><span className="row-title ellip">{ib.email}</span><StatusBadge status={ib.status} /></div>
                    <div className="row-sub">{ib.connType} · last sync <span className="mono">{ib.lastSync}</span></div>
                  </div>
                  {ib.status === "error"
                    ? <Btn variant="danger" size="sm" icon="refresh" onClick={() => app.toast("Reconnecting " + ib.email + "…")}>Reconnect</Btn>
                    : <Btn size="sm" variant="ghost" icon="trash" onClick={() => app.toast("Disconnect requires confirmation", "err")}>Disconnect</Btn>}
                </div>
              ))}
            </div>
          </Card>
          {app.inboxes.some(i => i.status === "error") && <ImapErrorBlock app={app} />}
        </>
      )}
    </div>
  );
}

function GoogleConnect({ app }) {
  const [state, setState] = useState("idle"); // idle | redirecting | connected
  const connect = () => {
    setState("redirecting");
    setTimeout(() => { setState("connected"); app.toast("Google connected — read-only Gmail access", "ok"); }, 1900);
  };
  return (
    <Card style={{ overflow: "hidden", borderColor: "color-mix(in oklab, var(--accent) 28%, var(--border))" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 18, padding: "var(--pad-card)", alignItems: "center" }}>
        <div className="center" style={{ gap: 14, alignItems: "flex-start" }}>
          <Provider provider="google" size="lg" />
          <div>
            <div className="center gap8">
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Connect Google</h3>
              <span className="badge active">OAuth</span>
              <span className="badge outline">Recommended</span>
            </div>
            <p className="muted mt6" style={{ fontSize: 13, maxWidth: "52ch" }}>Use Google's consent screen — no password required. LifeOS requests <b style={{ color: "var(--ink)" }}>read-only</b> Gmail access through the Gmail API.</p>
            <div className="center gap12 mt10" style={{ flexWrap: "wrap" }}>
              <span className="center gap6 faint" style={{ fontSize: 11.5 }}><Icon name="lock" size={12} />Read-only Gmail access</span>
              <span className="center gap6 faint" style={{ fontSize: 11.5 }}><Icon name="shield" size={12} />Tokens stored locally</span>
            </div>
          </div>
        </div>
        <div style={{ alignSelf: "center" }}>
          {state === "idle" && <Btn variant="primary" icon="connect" onClick={connect}>Connect Google</Btn>}
          {state === "redirecting" && <Btn variant="primary" disabled><span className="step active" style={{ padding: 0 }}><span className="sdot" style={{ border: 0 }}><span className="spin" style={{ borderColor: "#fff", borderTopColor: "transparent" }}></span></span></span>&nbsp;Redirecting…</Btn>}
          {state === "connected" && <Btn variant="ghost" icon="check" style={{ color: "var(--st-active)" }}>Connected</Btn>}
        </div>
      </div>
      {state === "redirecting" && (
        <div className="notice info" style={{ borderRadius: 0, borderLeft: 0, borderRight: 0, borderBottom: 0 }}>
          <span className="ic"><Icon name="ext" size={16} /></span>
          <div className="body">Opening Google's consent screen in a new window. Approve <b>read-only Gmail</b> access to continue.</div>
        </div>
      )}
    </Card>
  );
}

const PRESETS = window.DATA.providers;
function ImapConnect({ app }) {
  const [preset, setPreset] = useState("dome");
  const [adv, setAdv] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [test, setTest] = useState("idle"); // idle | testing | ok | fail
  const p = PRESETS.find((x) => x.id === preset);

  const runTest = () => {
    setTest("testing");
    setTimeout(() => setTest("ok"), 1600);
  };

  return (
    <Card>
      <div className="card-head">
        <div className="center gap8"><span className="mono-tile sm"><Icon name="mail" size={14} /></span><h3>Manual IMAP</h3><span className="badge idle">Advanced</span></div>
        <span className="sub">For providers without OAuth</span>
      </div>
      <div className="card-pad grid" style={{ gap: 16 }}>
        <Field label="Provider preset">
          <div className="btn-row">
            {PRESETS.map((x) => (
              <button key={x.id} className={"chip btn-chip" + (preset === x.id ? " on" : "")} onClick={() => { setPreset(x.id); setTest("idle"); }}>{x.name}</button>
            ))}
          </div>
        </Field>

        {p.note && (
          <div className={"notice " + (preset === "gmail" ? "warn" : "info")} style={{ padding: "10px 13px" }}>
            <span className="ic"><Icon name={preset === "gmail" ? "alert" : "info"} size={15} /></span>
            <div className="body">{preset === "gmail" && <b>OAuth is preferred for Gmail. </b>}{p.note}</div>
          </div>
        )}

        <div className="field-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Email address">
            <input className="input mono" placeholder="you@example.com" defaultValue={preset === "dome" ? "alex@rivera.no" : ""} />
          </Field>
          <Field label={preset === "dome" ? "Password" : "App password"} hint={preset === "dome" ? undefined : "Generated in your provider's security settings"}>
            <div style={{ position: "relative" }}>
              <input className="input mono" type={showPw ? "text" : "password"} placeholder="••••••••••••" defaultValue="appxxxxxxxxxxxx" style={{ paddingRight: 38 }} />
              <button className="btn ghost icon sm" style={{ position: "absolute", right: 4, top: 3 }} onClick={() => setShowPw(!showPw)}><Icon name={showPw ? "eyeOff" : "eye"} size={15} /></button>
            </div>
          </Field>
        </div>

        <button className="center gap6" style={{ background: "none", border: 0, color: "var(--ink-2)", fontWeight: 600, fontSize: 12.5, alignSelf: "flex-start", padding: 0 }} onClick={() => setAdv(!adv)}>
          <Icon name={adv ? "chevD" : "chevR"} size={14} /> Advanced settings
        </button>

        {adv && (
          <div className="card fade-in" style={{ background: "var(--surface-inset)", padding: "var(--pad-card)" }}>
            <div className="field-row" style={{ gridTemplateColumns: "1.4fr 1fr 0.8fr 0.9fr" }}>
              <Field label="IMAP username"><input className="input mono" defaultValue={preset === "dome" ? "rivera12" : "you@example.com"} /></Field>
              <Field label="IMAP server"><input className="input mono" defaultValue={p.server} placeholder="imap.example.com" /></Field>
              <Field label="Port"><input className="input mono" defaultValue={String(p.port)} /></Field>
              <Field label="Encryption">
                <select className="input" defaultValue="ssl"><option value="ssl">SSL / TLS</option><option value="starttls">STARTTLS</option><option value="none">None</option></select>
              </Field>
            </div>
            {preset === "dome" && <div className="hint mt10" style={{ color: "var(--ink-3)" }}><Icon name="info" size={12} /> Domeneshop username is your mailbox username (e.g. <span className="mono">rivera12</span>), not your email address.</div>}
          </div>
        )}

        <div className="between" style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <div className="center gap8">
            {test === "ok" && <span className="badge active"><Icon name="check" size={12} />Connection OK · 993/SSL</span>}
            {test === "fail" && <span className="badge error"><Icon name="x" size={12} />Connection failed</span>}
            {test === "testing" && <span className="badge sync"><span className="dot pulse"></span>Testing…</span>}
            {test === "idle" && <span className="faint" style={{ fontSize: 12 }}>Test before connecting to verify credentials.</span>}
          </div>
          <div className="btn-row">
            <Btn size="sm" icon={test === "testing" ? "" : "bolt"} disabled={test === "testing"} onClick={runTest}>{test === "testing" ? "Testing…" : "Test connection"}</Btn>
            <Btn variant="primary" size="sm" icon="link" disabled={test !== "ok"} onClick={() => app.toast("IMAP account connected", "ok")}>Connect account</Btn>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ImapErrorBlock({ app }) {
  return (
    <div className="notice err mt14">
      <span className="ic"><Icon name="alert" size={18} /></span>
      <div className="body" style={{ flex: 1 }}>
        <b>IMAP login failed · a.rivera@northwind.io</b>
        <div className="mt6">Authentication was rejected by <span className="mono">mail.northwind.io</span>. The app password may have been revoked or expired.</div>
        <ul style={{ margin: "8px 0 0 16px", color: "var(--ink-3)", fontSize: 12 }}>
          <li>Generate a new app password in your provider's security settings</li>
          <li>Confirm 2-factor authentication is still enabled</li>
          <li>Verify the IMAP server and port (993 / SSL)</li>
        </ul>
        <div className="btn-row mt10">
          <Btn size="sm" variant="danger" icon="refresh" onClick={() => app.toast("Retrying connection…")}>Retry connection</Btn>
          <Btn size="sm" variant="ghost" icon="edit">Update credentials</Btn>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Inbox Sync ---------------- */
function SyncScreen({ app }) {
  const d = window.DATA;
  const grouped = {};
  d.activity.forEach((a) => { (grouped[a.date] = grouped[a.date] || []).push(a); });

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Inbox Sync</div>
          <h1 className="page-title">Sync activity</h1>
          <p className="page-sub">Every scan, token refresh, and detection run across your connected inboxes.</p>
        </div>
        <Btn variant="primary" icon="refresh" onClick={() => app.startSync("all")}>Sync all</Btn>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 18 }}>
        {[
          { l: "Messages scanned", v: "29,746", ic: "search" },
          { l: "New this week", v: "486", ic: "arrowDown" },
          { l: "Subscriptions detected", v: "17", ic: "subs" },
          { l: "Accounts detected", v: "64", ic: "accounts" },
        ].map((s) => (
          <Card key={s.l} className="stat"><span className="label"><Icon name={s.ic} size={13} />{s.l}</span><span className="val" style={{ fontSize: 22 }}>{s.v}</span></Card>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1.4fr", alignItems: "start" }}>
        <Card>
          <div className="card-head"><h3>Inboxes</h3></div>
          <div className="list">
            {app.inboxes.map((ib) => {
              const syncing = ib.status === "syncing";
              return (
                <div key={ib.id} className="list-row">
                  <Provider provider={ib.provider} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="center gap8"><span className="row-title ellip" style={{ fontSize: 12.5 }}>{ib.email}</span><StatusBadge status={ib.status} pulse={syncing} /></div>
                    <div className="row-sub mono">{ib.scanned.toLocaleString()} scanned · {ib.lastSync}</div>
                  </div>
                  {ib.status !== "error" && <Btn size="xs" disabled={syncing} icon={syncing ? "" : "refresh"} onClick={() => app.startSync(ib.id)}>{syncing ? "…" : "Sync"}</Btn>}
                  {ib.status === "error" && <Btn size="xs" variant="danger" icon="alert" onClick={() => app.nav("connect")}>Fix</Btn>}
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="card-head"><h3>Activity log</h3><span className="sub">Most recent first</span></div>
          <div className="card-pad">
            {Object.entries(grouped).map(([date, items]) => (
              <div key={date} style={{ marginBottom: 14 }}>
                <div className="section-label" style={{ margin: "0 0 8px" }}>{date}</div>
                <div className="timeline">
                  {items.map((a) => (
                    <div key={a.id} className={"tl-item" + (a.kind === "ok" ? " acc" : "")}>
                      <span className="tl-dot" style={a.kind === "err" ? { borderColor: "var(--st-error)", background: "var(--st-error)" } : {}}></span>
                      <div className="tl-time">{a.time}</div>
                      <div className="tl-title">{a.title} <span className="mono faint" style={{ fontWeight: 400, fontSize: 11 }}>· {a.inbox}</span></div>
                      <div className="tl-desc">{a.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, { ConnectScreen, SyncScreen });
