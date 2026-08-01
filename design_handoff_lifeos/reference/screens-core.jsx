/* Home + Dashboard */

function HomeScreen({ app }) {
  const d = window.DATA;
  return (
    <div className="home fade-in">
      <div className="home-bar">
        <div className="center">
          <span className="brand-mark"><Icon name="layers" size={17} /></span>
          <span className="brand-name">Life<b>OS</b></span>
        </div>
        <div className="btn-row">
          <Btn variant="ghost" size="sm" icon={app.theme === "dark" ? "sun" : "moon"} onClick={app.toggleTheme} />
          <Btn variant="ghost" size="sm" onClick={() => app.nav("connect")}>Connect inbox</Btn>
          <Btn variant="primary" size="sm" iconR="chevR" onClick={() => app.nav("dashboard")}>Open dashboard</Btn>
        </div>
      </div>

      <div className="home-wrap">
        <div>
          <div className="badge outline" style={{ marginBottom: 22 }}><Icon name="lock" size={12} />&nbsp;Local-first</div>
          <h1 className="home-promise">Map your digital life<br />from your <span className="hl">inbox</span>.</h1>
          <p className="home-lede">Connect your email and LifeOS surfaces the subscriptions, accounts, and recurring charges attached to your digital life — quietly, on your own machine.</p>
          <div className="home-cta">
            <Btn variant="primary" iconR="chevR" onClick={() => app.nav("dashboard")}>Open dashboard</Btn>
            <Btn icon="connect" onClick={() => app.nav("connect")}>Connect inbox</Btn>
          </div>
          <div className="home-trust">
            <Icon name="shield" size={14} /> Your data stays on your machine. Read-only access, no servers.
          </div>
        </div>

        <PreviewCard app={app} d={d} />
      </div>
    </div>
  );
}

function PreviewCard({ app, d }) {
  return (
    <div className="preview-card">
      <div className="card-head" style={{ padding: "12px 16px" }}>
        <div className="center"><Icon name="dashboard" size={14} className="muted" /><span style={{ fontWeight: 650, fontSize: 13 }}>Dashboard preview</span></div>
        <span className="badge active"><span className="dot pulse"></span>Live</span>
      </div>
      <div style={{ padding: 16 }}>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { l: "Inboxes", v: "3", ic: "mail" },
            { l: "Subscriptions", v: "17", ic: "subs" },
            { l: "Accounts found", v: "64", ic: "accounts" },
            { l: "Monthly spend", v: "$184", ic: "receipt" },
          ].map((s) => (
            <div key={s.l} className="card" style={{ padding: 13 }}>
              <div className="stat" style={{ padding: 0, gap: 6 }}>
                <span className="label"><Icon name={s.ic} size={13} />{s.l}</span>
                <span className="val" style={{ fontSize: 21 }}>{s.v}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="card mt14" style={{ overflow: "hidden" }}>
          <div className="list">
            {d.subs.slice(0, 3).map((s) => (
              <div key={s.id} className="list-row" style={{ padding: "9px 13px" }}>
                <Tile mono={s.mono} color={s.color} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row-title" style={{ fontSize: 12.5 }}>{s.company}</div>
                  <div className="row-sub mono">{s.category}</div>
                </div>
                <span className="num" style={{ fontSize: 12.5, fontWeight: 600 }}>${fmt(s.amount)}<span className="faint">/mo</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
function Dashboard({ app }) {
  const d = window.DATA;
  const inboxes = app.inboxes;
  const hasInbox = inboxes.length > 0;
  const s = d.summary;

  const stats = [
    { l: "Accounts connected", v: String(inboxes.length), ic: "mail", sub: inboxes.filter(i => i.status === "active").length + " active" },
    { l: "Emails scanned", v: (s.scanned / 1000).toFixed(1) + "k", ic: "search", sub: "across all inboxes" },
    { l: "Subscriptions", v: String(app.subs.filter(x => x.status === "active").length), ic: "subs", sub: app.subs.length + " detected" },
    { l: "Monthly spend", v: "$" + Math.round(monthlyTotal(app.subs)), ic: "receipt", money: true, sub: "$" + Math.round(monthlyTotal(app.subs) * 12).toLocaleString() + " / yr" },
    { l: "Last sync", v: "2m", small: "ago", ic: "clock", sub: "auto every 6h" },
  ];

  if (!hasInbox) return <EmptyDashboard app={app} />;

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Dashboard</div>
          <h1 className="page-title">Your life, organized.</h1>
          <p className="page-sub">A calm overview of every inbox, subscription, and account LifeOS has found.</p>
        </div>
        <div className="btn-row">
          <Btn icon="refresh" onClick={() => app.startSync("all")}>Sync all</Btn>
          <Btn variant="primary" icon="plus" onClick={() => app.nav("connect")}>Connect inbox</Btn>
        </div>
      </div>

      {/* stat cards */}
      <div style={{ marginBottom: "var(--gap)" }}><InsightStrip app={app} /></div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        {stats.map((st) => (
          <Card key={st.l} className="stat">
            <span className="label"><Icon name={st.ic} size={13} />{st.l}</span>
            <span className="val">{st.v}{st.small && <small> {st.small}</small>}</span>
            <span className="delta">{st.sub}</span>
          </Card>
        ))}
      </div>

      <div className="grid mt18" style={{ gridTemplateColumns: "1.55fr 1fr", alignItems: "start" }}>
        {/* left col */}
        <div className="grid" style={{ gap: "var(--gap)" }}>
          <Card>
            <div className="card-head">
              <h3>Connected inboxes</h3>
              <Btn variant="ghost" size="xs" iconR="chevR" onClick={() => app.nav("connect")}>Manage</Btn>
            </div>
            <div className="list">
              {inboxes.map((ib) => <InboxRow key={ib.id} ib={ib} app={app} />)}
            </div>
          </Card>

          <Card>
            <div className="card-head">
              <h3>Detected subscriptions</h3>
              <Btn variant="ghost" size="xs" iconR="chevR" onClick={() => app.nav("subscriptions")}>View all {app.subs.length}</Btn>
            </div>
            <div className="list">
              {app.subs.slice(0, 5).map((sub) => (
                <div key={sub.id} className="list-row click" onClick={() => app.nav("subscriptions")}>
                  <Tile mono={sub.mono} color={sub.color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row-title">{sub.company}</div>
                    <div className="row-sub">{sub.category} · <span className="mono">{sub.email.split("@")[0]}@…</span></div>
                  </div>
                  {sub.trial && <span className="badge warn"><Icon name="clock" size={11} />Trial {sub.trialEnds}</span>}
                  <div style={{ textAlign: "right" }}>
                    <div className="num" style={{ fontWeight: 600 }}>${fmt(sub.amount)}</div>
                    <div className="row-sub mono">/{sub.cycle === "yearly" ? "yr" : "mo"}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* right col */}
        <div className="grid" style={{ gap: "var(--gap)" }}>
          <Card>
            <div className="card-head"><h3>Action queue</h3><span className="badge">{d.queue.length}</span></div>
            <div className="list">
              {d.queue.map((q) => (
                <div key={q.id} className="list-row click" onClick={() => app.nav(q.to)}>
                  <span className={"mono-tile sm"} style={{ background: queueColor(q.kind) + "1f", color: queueColor(q.kind), border: 0 }}>
                    <Icon name={queueIcon(q.kind)} size={14} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row-title" style={{ fontSize: 12.5 }}>{q.title}</div>
                    <div className="row-sub">{q.desc}</div>
                  </div>
                  <Icon name="chevR" size={15} className="faint" />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="card-head">
              <h3>Recent sync activity</h3>
              <Btn variant="ghost" size="xs" iconR="chevR" onClick={() => app.nav("inbox-sync")}>History</Btn>
            </div>
            <div className="card-pad">
              <div className="timeline">
                {d.activity.slice(0, 4).map((a) => (
                  <div key={a.id} className={"tl-item" + (a.accent ? " acc" : "")}>
                    <span className="tl-dot"></span>
                    <div className="tl-time">{a.date} · {a.time}</div>
                    <div className="tl-title">{a.title} {a.kind === "err" && <span className="badge error" style={{ marginLeft: 4 }}>error</span>}</div>
                    <div className="tl-desc">{a.inbox}</div>
                    <div className="tl-desc">{a.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="section-label">Across your digital life</div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <Card>
          <div className="card-head"><h3 className="center gap8"><Icon name="accounts" size={14} className="muted" />Awaiting your reply</h3><span className="badge warn">{d.people.filter(p => p.owed).length}</span></div>
          <div className="list">
            {d.people.filter(p => p.owed).map((p) => (
              <div key={p.id} className="list-row click" onClick={() => app.nav("assistant")}>
                <span className="ava mono-tile sm" style={{ borderRadius: "50%", fontSize: 10 }}>{p.name.split(" ").map(w => w[0]).join("").slice(0,2)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="center gap6"><span className="row-title" style={{ fontSize: 12.5 }}>{p.name}</span><span className="badge" style={{ height: 16, fontSize: 9.5 }}>{p.rel}</span></div>
                  <div className="row-sub ellip">{p.snippet}</div>
                </div>
                <span className="row-sub mono faint">{p.last}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="card-head"><h3 className="center gap8"><Icon name="receipt" size={14} className="muted" />Bills due soon</h3><span className="badge">{d.bills.filter(b => b.status !== "paid").length}</span></div>
          <div className="list">
            {d.bills.map((b) => (
              <div key={b.id} className="list-row">
                <span className={"mono-tile sm"} style={{ color: b.status === "due" ? "var(--st-warn)" : "var(--ink-3)", border: 0, background: "var(--surface-inset)" }}><Icon name="receipt" size={13} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row-title" style={{ fontSize: 12.5 }}>{b.name}</div>
                  <div className="row-sub">{b.category}{b.auto && " · autopay"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="num" style={{ fontWeight: 600, fontSize: 12.5 }}>${fmt(b.amount)}</div>
                  <div className={"row-sub mono" + (b.status === "due" ? "" : "")} style={{ color: b.status === "due" ? "var(--st-warn)" : b.status === "paid" ? "var(--st-active)" : "var(--ink-3)" }}>{b.due}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="card-head"><h3 className="center gap8"><Icon name="flag" size={14} className="muted" />Commitments</h3><span className="badge">{d.commitments.filter(c => !c.done).length}</span></div>
          <div className="list">
            {d.commitments.slice(0, 4).map((c) => (
              <div key={c.id} className="list-row">
                <span className="sdot" style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid var(--border-strong)", flex: "none" }}></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row-title" style={{ fontSize: 12.5 }}>{c.title}</div>
                  <div className="row-sub mono" style={{ color: c.overdue ? "var(--st-error)" : "var(--ink-3)" }}>{c.due}</div>
                </div>
                <span className="badge idle" style={{ height: 17, fontSize: 9.5 }}>{c.kind}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function InboxRow({ ib, app }) {
  const syncing = ib.status === "syncing";
  return (
    <div className="list-row">
      <Provider provider={ib.provider} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="center gap8">
          <span className="row-title ellip">{ib.email}</span>
          <StatusBadge status={ib.status} pulse={syncing} />
        </div>
        <div className="row-sub">{ib.connType} · <span className="mono">{ib.lastSync}</span></div>
      </div>
      <div className="btn-row" style={{ gap: 6 }}>
        {ib.status === "error" ? (
          <Btn variant="danger" size="xs" icon="alert" onClick={() => app.nav("connect")}>Fix</Btn>
        ) : (
          <Btn size="xs" icon={syncing ? "" : "refresh"} disabled={syncing} onClick={() => app.startSync(ib.id)}>{syncing ? "Syncing…" : "Sync"}</Btn>
        )}
        <Btn size="xs" variant="ghost" icon="dots" onClick={() => app.nav("inbox-sync")} />
      </div>
    </div>
  );
}

function EmptyDashboard({ app }) {
  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Dashboard</div>
          <h1 className="page-title">Your life, organized.</h1>
        </div>
      </div>
      <Card>
        <div className="empty">
          <span className="ico"><Icon name="mail" size={22} /></span>
          <h4>Connect your first inbox</h4>
          <p>LifeOS scans email metadata to surface subscriptions and accounts. Nothing happens until you connect an inbox — and it all stays on your machine.</p>
          <div className="btn-row mt14" style={{ justifyContent: "center" }}>
            <Btn variant="primary" icon="connect" onClick={() => app.nav("connect")}>Connect Google</Btn>
            <Btn icon="mail" onClick={() => app.nav("connect")}>Manual IMAP</Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

function monthlyTotal(subs) {
  return subs.filter(s => s.status === "active").reduce((t, s) => t + (s.cycle === "yearly" ? s.amount / 12 : s.amount), 0);
}
function queueColor(k) { return { review: "var(--st-warn)", trial: "var(--st-sync)", error: "var(--st-error)", duplicate: "var(--accent)" }[k] || "var(--ink-3)"; }
function queueIcon(k) { return { review: "flag", trial: "clock", error: "alert", duplicate: "layers" }[k] || "info"; }

Object.assign(window, { HomeScreen, Dashboard });
