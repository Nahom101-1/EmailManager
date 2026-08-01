/* Subscriptions + Accounts + Account detail */
const { useState: useStateD } = React;

/* tiny dropdown menu */
function Menu({ items }) {
  const [open, setOpen] = useStateD(false);
  return (
    <div style={{ position: "relative" }} onMouseLeave={() => setOpen(false)}>
      <button className="btn ghost icon sm" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}><Icon name="dots" size={16} /></button>
      {open && (
        <div className="card" style={{ position: "absolute", right: 0, top: 32, zIndex: 20, minWidth: 168, boxShadow: "var(--shadow-pop)", padding: 5, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
          {items.map((it, i) => it.sep ? <hr key={i} className="hr" style={{ margin: "4px 0" }} /> : (
            <button key={i} className="list-row click" style={{ width: "100%", border: 0, background: "none", padding: "7px 9px", borderRadius: "var(--radius-sm)", textAlign: "left", color: it.danger ? "var(--st-error)" : "var(--ink)", font: "inherit", fontSize: 12.5, gap: 9 }}
              onClick={() => { setOpen(false); it.onClick && it.onClick(); }}>
              <Icon name={it.icon} size={14} style={{ color: it.danger ? "var(--st-error)" : "var(--ink-3)" }} />{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================= Subscriptions ================= */
const SUB_FILTERS = [
  { v: "all", label: "All" }, { v: "active", label: "Active" }, { v: "needs-review", label: "Needs review" },
  { v: "unknown", label: "Unknown" }, { v: "cancelled", label: "Cancelled" },
  { v: "monthly", label: "Monthly" }, { v: "yearly", label: "Yearly" },
];

function SubscriptionsScreen({ app }) {
  const [filter, setFilter] = useStateD("all");
  const subs = app.subs;
  const shown = subs.filter((s) => {
    if (filter === "all") return true;
    if (filter === "monthly" || filter === "yearly") return s.cycle === filter;
    return s.status === filter;
  });
  const monthly = subs.filter(s => s.status === "active").reduce((t, s) => t + (s.cycle === "yearly" ? s.amount / 12 : s.amount), 0);
  const annual = monthly * 12;
  const trials = subs.filter(s => s.trial).length;

  const counts = {};
  SUB_FILTERS.forEach((f) => {
    counts[f.v] = f.v === "all" ? subs.length : (f.v === "monthly" || f.v === "yearly") ? subs.filter(s => s.cycle === f.v).length : subs.filter(s => s.status === f.v).length;
  });

  if (subs.length === 0) return <EmptyState app={app} icon="subs" title="No subscriptions found yet" body="Sync an inbox to scan recent receipts and billing emails. Detected subscriptions will appear here for review." cta="Sync now" onCta={() => app.startSync("all")} />;

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Subscriptions</div>
          <h1 className="page-title">Subscriptions</h1>
          <p className="page-sub">Recurring charges detected from receipts and billing emails. Confirm the uncertain ones to sharpen your totals.</p>
        </div>
        <Seg value={app.layout} onChange={app.setLayout} options={[{ v: "cards", label: "Cards" }, { v: "table", label: "Table" }]} />
      </div>

      {/* summary bar */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 16 }}>
        <Card className="stat"><span className="label"><Icon name="subs" size={13} />Active subscriptions</span><span className="val">{subs.filter(s => s.status === "active").length}</span></Card>
        <Card className="stat"><span className="label"><Icon name="receipt" size={13} />Monthly spend</span><span className="val">${fmt(monthly)}</span><span className="delta">est. across active</span></Card>
        <Card className="stat"><span className="label"><Icon name="refresh" size={13} />Annualized</span><span className="val">${Math.round(annual).toLocaleString()}</span><span className="delta">per year</span></Card>
        <Card className="stat"><span className="label"><Icon name="clock" size={13} />Trials ending soon</span><span className="val" style={{ color: trials ? "var(--st-warn)" : "inherit" }}>{trials}</span><span className="delta">within 7 days</span></Card>
      </div>

      {/* filters */}
      <div className="btn-row mb14" style={{ gap: 7 }}>
        {SUB_FILTERS.map((f) => (
          <button key={f.v} className={"chip btn-chip" + (filter === f.v ? " on" : "")} onClick={() => setFilter(f.v)}>
            {f.label}<span className="num faint" style={{ fontSize: 11 }}>{counts[f.v]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Card><div className="empty"><span className="ico"><Icon name="filter" size={20} /></span><h4>Nothing here</h4><p>No subscriptions match this filter.</p></div></Card>
      ) : app.layout === "cards" ? (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))" }}>
          {shown.map((s) => <SubCard key={s.id} s={s} app={app} />)}
        </div>
      ) : (
        <SubTable subs={shown} app={app} />
      )}
    </div>
  );
}

function subMenu(s, app) {
  return [
    { icon: "check", label: "Mark as active", onClick: () => app.setSub(s.id, "active") },
    { icon: "cancel", label: "Mark as cancelled", onClick: () => app.setSub(s.id, "cancelled") },
    { icon: "x", label: "Ignore", onClick: () => app.setSub(s.id, "ignored") },
    { sep: true },
    { icon: "ext", label: "View source email", onClick: () => app.toast("Opening source metadata…") },
    { icon: "edit", label: "Edit amount / cycle", onClick: () => app.toast("Edit subscription…") },
    { icon: "note", label: "Add note", onClick: () => app.toast("Note added") },
  ];
}

function SubCard({ s, app }) {
  return (
    <Card className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      <div className="between" style={{ alignItems: "flex-start" }}>
        <div className="center gap10">
          <Tile mono={s.mono} color={s.color} />
          <div>
            <div className="row-title">{s.company}</div>
            <div className="row-sub mono">{s.category}</div>
          </div>
        </div>
        <Menu items={subMenu(s, app)} />
      </div>

      <div className="between" style={{ alignItems: "flex-end" }}>
        <div>
          <span className="num" style={{ fontSize: 21, fontWeight: 600, letterSpacing: "-.03em" }}>${fmt(s.amount)}</span>
          <span className="faint mono" style={{ fontSize: 12 }}> /{s.cycle === "yearly" ? "yr" : "mo"}</span>
        </div>
        <StatusBadge status={s.status} />
      </div>

      {s.trial && <div className="notice warn" style={{ padding: "8px 11px" }}><span className="ic"><Icon name="clock" size={14} /></span><div className="body" style={{ fontSize: 12 }}>Free trial ends <b>{s.trialEnds}</b> — then ${fmt(s.amount)}/mo</div></div>}

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 11, display: "grid", gap: 7 }}>
        <div className="kv" style={{ padding: 0, border: 0 }}><span className="k">Email used</span><span className="v mono" style={{ fontSize: 11.5 }}>{s.email}</span></div>
        <div className="kv" style={{ padding: 0, border: 0 }}><span className="k">Last seen</span><span className="v mono" style={{ fontSize: 11.5 }}>{s.lastSeen}</span></div>
        <div className="kv" style={{ padding: 0, border: 0 }}><span className="k">Source · confidence</span><span className="v center gap8"><span className="chip" style={{ height: 18, fontSize: 10.5 }}>{s.source}</span><Conf value={s.confidence} /></span></div>
      </div>

      {s.status !== "active" && (
        <div className="btn-row" style={{ gap: 7 }}>
          <Btn size="sm" icon="check" className="" style={{ flex: 1 }} onClick={() => app.setSub(s.id, "active")}>Confirm active</Btn>
          <Btn size="sm" variant="ghost" icon="x" onClick={() => app.setSub(s.id, "ignored")}>Ignore</Btn>
        </div>
      )}
    </Card>
  );
}

function SubTable({ subs, app }) {
  const [sort, setSort] = useStateD({ k: "amount", dir: -1 });
  const sorted = [...subs].sort((a, b) => {
    let av = a[sort.k], bv = b[sort.k];
    if (typeof av === "string") return sort.dir * av.localeCompare(bv);
    return sort.dir * (av - bv);
  });
  const th = (k, label, r) => (
    <th className={sort.k === k ? "sorted" : ""} style={r ? { textAlign: "right" } : {}} onClick={() => setSort({ k, dir: sort.k === k ? -sort.dir : -1 })}>
      {label}<Icon name={sort.k === k && sort.dir === 1 ? "chevUp" : "chevD"} size={11} className="sort" />
    </th>
  );
  return (
    <Card style={{ overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr>{th("company", "Company")}{th("amount", "Amount", 1)}<th>Cycle</th><th>Email</th>{th("lastSeen", "Last seen")}<th>Source</th><th>Confidence</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.id}>
                <td><div className="center gap8"><Tile mono={s.mono} color={s.color} size="sm" /><span style={{ fontWeight: 600 }}>{s.company}</span></div></td>
                <td className="num text-r" style={{ fontWeight: 600 }}>${fmt(s.amount)}</td>
                <td><span className="chip" style={{ height: 19, fontSize: 11 }}>{s.cycle === "yearly" ? "Yearly" : "Monthly"}</span></td>
                <td className="num muted" style={{ fontSize: 11.5 }}>{s.email}</td>
                <td className="num muted">{s.lastSeen}</td>
                <td><span className="badge idle">{s.source}</span></td>
                <td><Conf value={s.confidence} /></td>
                <td><StatusBadge status={s.status} /></td>
                <td onClick={(e) => e.stopPropagation()}><Menu items={subMenu(s, app)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ================= Accounts ================= */
const ACCT_FILTERS = [
  { v: "all", label: "All" }, { v: "active", label: "Active" }, { v: "inactive", label: "Inactive" },
  { v: "unknown", label: "Unknown" }, { v: "hi", label: "High risk" },
];
const SIGNAL_ICON = { receipt: "receipt", login: "key", newsletter: "mail", security: "shield", "password-reset": "lock", trial: "clock", signup: "user", statement: "receipt" };

function AccountsScreen({ app }) {
  const [filter, setFilter] = useStateD("all");
  const accounts = app.accounts;
  const shown = accounts.filter((a) => {
    if (filter === "all") return true;
    if (filter === "hi") return a.risk >= 3;
    return a.status === filter;
  });
  if (accounts.length === 0) return <EmptyState app={app} icon="accounts" title="No accounts discovered yet" body="Accounts appear here after you sync an inbox. LifeOS reads sign-in alerts, receipts, and newsletters to map where you have accounts." cta="Connect inbox" onCta={() => app.nav("connect")} />;

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Accounts</div>
          <h1 className="page-title">Accounts</h1>
          <p className="page-sub">Online services tied to your email addresses, discovered from sign-ins, receipts, and alerts.</p>
        </div>
        <Seg value={app.layout} onChange={app.setLayout} options={[{ v: "cards", label: "Cards" }, { v: "table", label: "Table" }]} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 16 }}>
        <Card className="stat"><span className="label"><Icon name="accounts" size={13} />Total discovered</span><span className="val">{accounts.length}</span></Card>
        <Card className="stat"><span className="label"><Icon name="check" size={13} />Active</span><span className="val">{accounts.filter(a => a.status === "active").length}</span></Card>
        <Card className="stat"><span className="label"><Icon name="pause" size={13} />Inactive</span><span className="val">{accounts.filter(a => a.status === "inactive").length}</span></Card>
        <Card className="stat"><span className="label"><Icon name="shield" size={13} />High risk</span><span className="val" style={{ color: "var(--st-error)" }}>{accounts.filter(a => a.risk >= 3).length}</span><span className="delta">review recommended</span></Card>
      </div>

      <div className="btn-row mb14" style={{ gap: 7 }}>
        {ACCT_FILTERS.map((f) => <button key={f.v} className={"chip btn-chip" + (filter === f.v ? " on" : "")} onClick={() => setFilter(f.v)}>{f.label}</button>)}
      </div>

      {app.layout === "cards" ? (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
          {shown.map((a) => <AcctCard key={a.id} a={a} app={app} />)}
        </div>
      ) : <AcctTable accounts={shown} app={app} />}
    </div>
  );
}

function riskCls(r) { return r >= 3 ? "hi" : r === 2 ? "md" : "lo"; }
function riskLabel(r) { return r >= 3 ? "High" : r === 2 ? "Medium" : "Low"; }
function acctMenu(a, app) {
  return [
    { icon: "check", label: a.status === "active" ? "Mark inactive" : "Mark active", onClick: () => app.setAcct(a.id, a.status === "active" ? "inactive" : "active") },
    { icon: "x", label: "Ignore", onClick: () => app.setAcct(a.id, "ignored") },
    { icon: "layers", label: "Group duplicates", onClick: () => app.toast("Grouping duplicates…") },
    { sep: true },
    { icon: "ext", label: "Review source", onClick: () => app.nav("account", { id: a.id }) },
    { icon: "note", label: "Add note", onClick: () => app.toast("Note added") },
  ];
}

function AcctCard({ a, app }) {
  return (
    <Card className="card-pad click" style={{ display: "flex", flexDirection: "column", gap: 12, cursor: "pointer" }} onClick={() => app.nav("account", { id: a.id })}>
      <div className="between" style={{ alignItems: "flex-start" }}>
        <div className="center gap10">
          <Tile mono={a.mono} color={a.color} />
          <div>
            <div className="row-title">{a.service}</div>
            <div className="row-sub mono ellip" style={{ maxWidth: "20ch" }}>{a.email}</div>
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}><Menu items={acctMenu(a, app)} /></div>
      </div>

      <div className="center gap8 wrap">
        <StatusBadge status={a.status} />
        <span className={"risk " + riskCls(a.risk)}>{riskLabel(a.risk)} risk</span>
      </div>

      <div className="center gap6 wrap" style={{ borderTop: "1px solid var(--border)", paddingTop: 11 }}>
        {a.signals.map((sig) => (
          <span key={sig} className="chip" style={{ height: 22, fontSize: 11, gap: 5 }} title={sig}><Icon name={SIGNAL_ICON[sig] || "info"} size={11} />{sig.replace("-", " ")}</span>
        ))}
      </div>

      <div className="between mono faint" style={{ fontSize: 11 }}>
        <span>First seen {a.first}</span><span>Last {a.last}</span>
      </div>
    </Card>
  );
}

function AcctTable({ accounts, app }) {
  return (
    <Card style={{ overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Service</th><th>Email used</th><th>Signals</th><th>First seen</th><th>Last seen</th><th>Inbox</th><th>Risk</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} onClick={() => app.nav("account", { id: a.id })}>
                <td><div className="center gap8"><Tile mono={a.mono} color={a.color} size="sm" /><span style={{ fontWeight: 600 }}>{a.service}</span></div></td>
                <td className="num muted" style={{ fontSize: 11.5 }}>{a.email}</td>
                <td><div className="center gap6">{a.signals.slice(0, 3).map((s) => <span key={s} title={s} className="center" style={{ color: "var(--ink-3)" }}><Icon name={SIGNAL_ICON[s] || "info"} size={13} /></span>)}{a.signals.length > 3 && <span className="faint" style={{ fontSize: 11 }}>+{a.signals.length - 3}</span>}</div></td>
                <td className="num muted">{a.first}</td>
                <td className="num muted">{a.last}</td>
                <td className="muted">{a.inbox}</td>
                <td><span className={"risk " + riskCls(a.risk)}>{riskLabel(a.risk)}</span></td>
                <td><StatusBadge status={a.status} /></td>
                <td onClick={(e) => e.stopPropagation()}><Menu items={acctMenu(a, app)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ================= Account detail ================= */
function AccountDetail({ app, id }) {
  const a = app.accounts.find((x) => x.id === id) || app.accounts[0];
  const d = window.DATA;
  const related = app.subs.filter((s) => s.company.toLowerCase().includes(a.service.toLowerCase().split(" ")[0]));
  return (
    <div className="page fade-in" style={{ maxWidth: 1000 }}>
      <div className="crumbs mb18">
        <button className="btn ghost xs" onClick={() => app.nav("accounts")}><Icon name="chevR" size={13} style={{ transform: "rotate(180deg)" }} />Accounts</button>
        <Icon name="chevR" size={13} /><span className="cur">{a.service}</span>
      </div>

      <div className="between mb18" style={{ alignItems: "flex-start" }}>
        <div className="center gap12">
          <Tile mono={a.mono} color={a.color} size="lg" />
          <div>
            <h1 className="page-title" style={{ fontSize: 24 }}>{a.service}</h1>
            <div className="center gap8 mt6"><StatusBadge status={a.status} /><span className={"risk " + riskCls(a.risk)}>{riskLabel(a.risk)} risk</span><span className="mono faint" style={{ fontSize: 12 }}>{a.email}</span></div>
          </div>
        </div>
        <div className="btn-row">
          <Btn size="sm" icon="check" onClick={() => { app.setAcct(a.id, "active"); app.toast("Marked as keep", "ok"); }}>Keep</Btn>
          <Btn size="sm" variant="ghost" icon="flag" onClick={() => app.toast("Flagged for review")}>Review</Btn>
          <Btn size="sm" variant="danger" icon="cancel" onClick={() => app.toast("Marked to cancel")}>Cancel</Btn>
          <Menu items={[{ icon: "x", label: "Ignore account", onClick: () => app.setAcct(a.id, "ignored") }, { icon: "layers", label: "Group duplicates", onClick: () => app.toast("Grouping…") }]} />
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.5fr 1fr", alignItems: "start" }}>
        <div className="grid" style={{ gap: "var(--gap)" }}>
          <Card>
            <div className="card-head"><h3>Timeline of evidence</h3><span className="sub">{d.evidence.length} signals</span></div>
            <div className="card-pad">
              <div className="timeline">
                {d.evidence.map((e, i) => (
                  <div key={i} className={"tl-item" + (e.kind === "security" || e.kind === "password-reset" ? "" : " acc")}>
                    <span className="tl-dot" style={e.kind === "security" ? { borderColor: "var(--st-warn)", background: "var(--st-warn)" } : {}}></span>
                    <div className="tl-time">{e.time} · {e.inbox}</div>
                    <div className="tl-title center gap6"><Icon name={SIGNAL_ICON[e.kind] || "info"} size={13} className="muted" />{e.title}</div>
                    <div className="tl-desc">{e.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <div className="card-head"><h3>User notes</h3></div>
            <div className="card-pad">
              <textarea className="input" style={{ height: 80, padding: 11, resize: "vertical", fontFamily: "var(--font-sans)" }} placeholder="Add a private note about this account…"></textarea>
              <div className="btn-row mt10" style={{ justifyContent: "flex-end" }}><Btn size="sm" variant="primary" icon="note" onClick={() => app.toast("Note saved", "ok")}>Save note</Btn></div>
            </div>
          </Card>
        </div>

        <div className="grid" style={{ gap: "var(--gap)" }}>
          <Card className="card-pad">
            <h3 style={{ fontSize: 13, marginBottom: 4 }}>Details</h3>
            <div className="kv"><span className="k">Linked email</span><span className="v mono" style={{ fontSize: 11.5 }}>{a.email}</span></div>
            <div className="kv"><span className="k">Source inbox</span><span className="v">{a.inbox}</span></div>
            <div className="kv"><span className="k">First seen</span><span className="v mono">{a.first}</span></div>
            <div className="kv"><span className="k">Last seen</span><span className="v mono">{a.last}</span></div>
            <div className="kv"><span className="k">Risk score</span><span className="v"><span className={"risk " + riskCls(a.risk)}>{a.risk}/3 · {riskLabel(a.risk)}</span></span></div>
          </Card>

          <Card className="card-pad">
            <h3 style={{ fontSize: 13, marginBottom: 8 }}>Signals detected</h3>
            <div className="center gap6 wrap">
              {a.signals.map((s) => <span key={s} className="chip" style={{ height: 24 }}><Icon name={SIGNAL_ICON[s] || "info"} size={12} />{s.replace("-", " ")}</span>)}
            </div>
          </Card>

          <Card>
            <div className="card-head"><h3>Related subscriptions</h3></div>
            {related.length ? (
              <div className="list">{related.map((s) => (
                <div key={s.id} className="list-row click" onClick={() => app.nav("subscriptions")}>
                  <Tile mono={s.mono} color={s.color} size="sm" />
                  <div style={{ flex: 1 }}><div className="row-title" style={{ fontSize: 12.5 }}>{s.company}</div></div>
                  <span className="num" style={{ fontWeight: 600, fontSize: 12.5 }}>${fmt(s.amount)}</span>
                </div>
              ))}</div>
            ) : <div className="card-pad muted" style={{ fontSize: 12.5 }}>No linked subscriptions detected.</div>}
          </Card>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ app, icon, title, body, cta, onCta }) {
  return (
    <div className="page fade-in">
      <div className="page-head"><div><div className="page-eyebrow">LifeOS</div><h1 className="page-title">{title.split(" ")[0] === "No" ? title.replace(/ found yet| discovered yet/, "") : title}</h1></div></div>
      <Card><div className="empty">
        <span className="ico"><Icon name={icon} size={22} /></span>
        <h4>{title}</h4><p>{body}</p>
        <div className="btn-row mt14" style={{ justifyContent: "center" }}>
          <Btn variant="primary" icon="refresh" onClick={onCta}>{cta}</Btn>
          <Btn variant="ghost" onClick={() => app.nav("connect")}>Connect inbox</Btn>
        </div>
      </div></Card>
    </div>
  );
}

Object.assign(window, { SubscriptionsScreen, AccountsScreen, AccountDetail });
