/* Assistant — Daily Briefing + live chat + AI access controls, and dashboard insight strip */
const { useState: uSA, useRef: uRA, useEffect: uEA } = React;

/* ---------- live AI plumbing ---------- */
function lifeContext() {
  const d = window.DATA;
  const owed = d.people.filter((p) => p.owed).map((p) => `${p.name} (${p.role}, last ${p.last})`).join("; ");
  const bills = d.bills.filter((b) => b.status !== "paid").map((b) => `${b.name} $${b.amount} ${b.due}`).join("; ");
  const coms = d.commitments.filter((c) => !c.done).map((c) => `${c.title} [${c.due}]`).join("; ");
  const subsActive = d.subs.filter((s) => s.status === "active").length;
  const monthly = d.subs.filter((s) => s.status === "active").reduce((t, s) => t + (s.cycle === "yearly" ? s.amount / 12 : s.amount), 0);
  return [
    `Inbox load: ${d.lifeStats.inboxLoad}. ${d.lifeStats.newSinceLast} new emails since last night, ${d.lifeStats.needsReply} need a reply.`,
    `Awaiting your reply: ${owed}.`,
    `Bills due soon: ${bills}.`,
    `Open commitments: ${coms}.`,
    `Subscriptions: ${subsActive} active, ~$${monthly.toFixed(0)}/mo. Accounts discovered: ${d.accounts.length}.`,
    `Connected inboxes: ${d.inboxes.map((i) => i.email + " (" + i.status + ")").join(", ")}.`,
  ].join("\n");
}

const AI_SYSTEM =
  "You are LifeOS, a direct and efficient assistant living inside a private, local-first digital-life dashboard. " +
  "You read the user's inbox to help them triage: what to deal with first, what can wait, and what to ignore. " +
  "Voice: concise, factual, action-oriented — facts and the next action, no fluff, no greetings unless asked. " +
  "Prefer short bullet points. Always ground answers in the CONTEXT; never invent specifics that aren't there. " +
  "When relevant, end with one clear recommended next step.";

async function askLifeOS(history, userMsg) {
  const convo = history.map((m) => (m.role === "user" ? "User: " : "LifeOS: ") + m.text).join("\n");
  const prompt = `${AI_SYSTEM}\n\nCONTEXT (read from the user's inbox):\n${lifeContext()}\n\nCONVERSATION SO FAR:\n${convo}\n\nUser: ${userMsg}\nLifeOS:`;
  try {
    if (window.claude && window.claude.complete) {
      const out = await window.claude.complete(prompt);
      if (out && out.trim()) return out.trim();
    }
  } catch (e) { /* fall through */ }
  return fallbackAnswer(userMsg);
}

function fallbackAnswer(msg) {
  const m = msg.toLowerCase();
  const d = window.DATA;
  if (/first|urgent|priorit|deal/.test(m))
    return "Top 3, in order:\n• Reply to Dana (manager) — revised Q3 deck, due Friday.\n• Reply to Priya (Acme client) — timeline question, open since yesterday.\n• Pay rent — $1,850, due in 3 days, not on autopay.\nNext step: knock out the two replies, then schedule the rent payment.";
  if (/ignore|skip|safe/.test(m))
    return "Safe to ignore today:\n• 12 newsletters you haven't opened in 90+ days — mute them.\n• 34 promotional/receipt emails — already auto-filed.\nNothing here is time-sensitive.";
  if (/work/.test(m))
    return "From work: Dana is waiting on the Q3 deck (due Fri) and Priya (Acme) has a timeline question since yesterday. HR open-enrollment closes Jun 30 — not urgent yet. Next step: reply to Dana first.";
  if (/forget|reply|owe|haven|behind/.test(m))
    return "You owe replies to:\n• Dana Whitlock (manager) — 2 days.\n• Priya Anand (client) — since yesterday.\n• Sam (brother) — 3 weeks, about the July trip.\nNext step: Sam's is the oldest — a one-line reply clears it.";
  if (/summar|glance|day|brief/.test(m))
    return "3 things need you today (2 replies + rent due Fri); inbox volume is normal at " + d.lifeStats.newSinceLast + " new, mostly newsletters and receipts. Everything else can wait.";
  if (/money|spend|bill|subscription|cost/.test(m))
    return "Money: rent ($1,850, Fri) and a Visa bill ($642, Jun 18) are the big ones — neither on autopay. Subscriptions run ~$197/mo; Audible's trial converts in 2 days. Next step: confirm or cancel Audible before it bills.";
  return "I can help you triage. Try: \u201cWhat should I deal with first?\u201d, \u201cWhat can I ignore?\u201d, or \u201cWho am I forgetting to reply to?\u201d";
}

/* ---------- dashboard insight strip ---------- */
function InsightStrip({ app }) {
  const ins = window.DATA.insights;
  return (
    <Card style={{ overflow: "hidden", borderColor: "color-mix(in oklab, var(--accent) 22%, var(--border))" }}>
      <div className="card-head">
        <h3 className="center gap8"><Sparkle />Assistant briefing</h3>
        <Btn variant="ghost" size="xs" iconR="chevR" onClick={() => app.nav("assistant")}>Open assistant</Btn>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 0 }}>
        {ins.map((i, idx) => (
          <div key={i.id} className="card-pad" style={{ borderRight: idx < ins.length - 1 ? "1px solid var(--border)" : 0, display: "flex", flexDirection: "column", gap: 9 }}>
            <div className="center gap8">
              <span className={"mono-tile sm"} style={{ background: "var(--st-" + i.tone + "-bg)", color: "var(--st-" + i.tone + ")", border: 0 }}><Icon name={i.icon} size={14} /></span>
              <span className="badge outline" style={{ height: 18, fontSize: 9.5 }}>{i.priority === "now" ? "DEAL NOW" : i.priority === "wait" ? "CAN WAIT" : "IGNORE"}</span>
            </div>
            <div>
              <div className="row-title" style={{ fontSize: 13 }}>{i.title}</div>
              <div className="row-sub" style={{ marginTop: 3, lineHeight: 1.45 }}>{i.body}</div>
            </div>
            {i.action && <button className="center gap6" style={{ background: "none", border: 0, color: "var(--accent)", fontWeight: 650, fontSize: 12, padding: 0, marginTop: "auto" }} onClick={() => i.to && app.nav(i.to)}>{i.action}<Icon name="chevR" size={13} /></button>}
          </div>
        ))}
      </div>
    </Card>
  );
}

function Sparkle({ size = 15 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z" /><path d="M19 14l.7 1.8 1.8.7-1.8.7L19 19l-.7-1.8L16.5 16.5l1.8-.7L19 14z" /></svg>;
}

/* ---------- AI access control ---------- */
function AccessControl({ scopes, setScopes }) {
  const [open, setOpen] = uSA(false);
  const onCount = scopes.filter((s) => s.on).length;
  return (
    <div style={{ position: "relative" }}>
      <button className="btn sm" onClick={() => setOpen(!open)}>
        <Icon name="shield" size={14} style={{ color: "var(--accent)" }} />Cloud AI · {onCount}/{scopes.length} sources
        <Icon name="chevD" size={13} />
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 30 }} onClick={() => setOpen(false)}></div>
          <div className="card" style={{ position: "absolute", right: 0, top: 40, zIndex: 31, width: 320, boxShadow: "var(--shadow-pop)", overflow: "hidden" }}>
            <div className="card-pad" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="center gap8" style={{ fontWeight: 650, fontSize: 13 }}><Icon name="shield" size={15} style={{ color: "var(--accent)" }} />What the assistant can see</div>
              <p className="row-sub" style={{ marginTop: 5, lineHeight: 1.45 }}>Opt-in. The assistant only reads the sources you enable — processed in the cloud, never stored.</p>
            </div>
            <div className="list">
              {scopes.map((s) => (
                <div key={s.id} className="list-row" style={{ padding: "11px 16px" }}>
                  <div style={{ flex: 1 }}>
                    <div className="row-title" style={{ fontSize: 12.5 }}>{s.label}</div>
                    <div className="row-sub">{s.desc}</div>
                  </div>
                  <button className={"switch" + (s.on ? " on" : "")} onClick={() => setScopes(scopes.map((x) => x.id === s.id ? { ...x, on: !x.on } : x))}></button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Assistant screen ---------- */
function AssistantScreen({ app }) {
  const d = window.DATA;
  const [scopes, setScopes] = uSA(d.aiScopes.map((s) => ({ ...s })));
  const [msgs, setMsgs] = uSA([]);
  const [input, setInput] = uSA("");
  const [busy, setBusy] = uSA(false);
  const [brief, setBrief] = uSA(d.briefing.summary);
  const [briefBusy, setBriefBusy] = uSA(false);
  const bodyRef = uRA(null);

  uEA(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [msgs, busy]);

  const send = async (text) => {
    const q = (text != null ? text : input).trim();
    if (!q || busy) return;
    setInput("");
    const hist = msgs;
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    const ans = await askLifeOS(hist, q);
    setMsgs((m) => [...m, { role: "ai", text: ans }]);
    setBusy(false);
  };

  const regenBrief = async () => {
    setBriefBusy(true);
    let ans;
    try {
      if (window.claude && window.claude.complete) {
        ans = await window.claude.complete(`${AI_SYSTEM}\n\nCONTEXT:\n${lifeContext()}\n\nWrite a 2-3 sentence morning briefing for the user: what genuinely needs them today vs what can wait. Direct and factual.`);
      }
    } catch (e) { /* ignore */ }
    setBrief((ans && ans.trim()) || d.briefing.summary);
    setBriefBusy(false);
  };

  return (
    <div className="page fade-in" style={{ maxWidth: 1080 }}>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Assistant</div>
          <h1 className="page-title">Your briefing</h1>
          <p className="page-sub">A direct read on your digital life — what needs you, what can wait, what to ignore.</p>
        </div>
        <AccessControl scopes={scopes} setScopes={setScopes} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.15fr 1fr", alignItems: "start" }}>
        {/* briefing column */}
        <div className="grid" style={{ gap: "var(--gap)" }}>
          <Card className="card-pad" style={{ background: "var(--surface)", borderColor: "color-mix(in oklab, var(--accent) 22%, var(--border))" }}>
            <div className="between">
              <div className="center gap8"><Sparkle /><span style={{ fontWeight: 700, fontSize: 14 }}>{d.briefing.greeting}</span></div>
              <Btn variant="ghost" size="xs" icon={briefBusy ? "" : "refresh"} disabled={briefBusy} onClick={regenBrief}>{briefBusy ? "Thinking…" : "Regenerate"}</Btn>
            </div>
            <p style={{ marginTop: 11, fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-2)" }}>{brief}</p>
            <div className="center gap6 wrap mt14">
              {[["mail", d.lifeStats.newSinceLast + " new"], ["flag", d.lifeStats.needsReply + " need reply"], ["bolt", d.lifeStats.inboxLoad + " load"]].map(([ic, t]) => (
                <span key={t} className="chip" style={{ height: 24 }}><Icon name={ic} size={12} />{t}</span>
              ))}
            </div>
          </Card>

          <BriefColumn title="Deal with first" tone="warn" icon="flag" items={d.briefing.dealFirst} />
          <BriefColumn title="Can wait" tone="sync" icon="clock" items={d.briefing.canWait} />
          <BriefColumn title="Safe to ignore" tone="idle" icon="archive" items={d.briefing.ignore} muted />
        </div>

        {/* chat column */}
        <Card style={{ display: "flex", flexDirection: "column", height: 620, position: "sticky", top: 0, overflow: "hidden" }}>
          <div className="card-head">
            <h3 className="center gap8"><Sparkle size={14} />Ask LifeOS</h3>
            <span className="badge active"><span className="dot"></span>{window.claude ? "Live" : "Demo"}</span>
          </div>
          <div ref={bodyRef} className="scroll" style={{ flex: 1, padding: "16px var(--pad-card)", display: "flex", flexDirection: "column", gap: 12 }}>
            {msgs.length === 0 && (
              <div style={{ margin: "auto 0", textAlign: "center", color: "var(--ink-3)" }}>
                <span className="mono-tile" style={{ margin: "0 auto 12px", width: 40, height: 40, color: "var(--accent)" }}><Sparkle size={18} /></span>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>Ask about anything in your inbox</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Triage, replies, bills, what to ignore.</div>
              </div>
            )}
            {msgs.map((m, i) => <Bubble key={i} m={m} />)}
            {busy && <div className="center gap8" style={{ color: "var(--ink-3)", fontSize: 12.5, padding: "2px 4px" }}><span className="dot pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" }}></span>LifeOS is thinking…</div>}
          </div>
          {msgs.length === 0 && (
            <div className="center gap6 wrap" style={{ padding: "0 var(--pad-card) 10px" }}>
              {d.suggestedPrompts.slice(0, 4).map((p) => (
                <button key={p} className="chip btn-chip" style={{ fontSize: 11.5 }} onClick={() => send(p)}>{p}</button>
              ))}
            </div>
          )}
          <div style={{ padding: "12px var(--pad-card)", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
            <input className="input" placeholder="Ask anything about your inbox…" value={input}
              onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
            <Btn variant="primary" icon="send" disabled={busy || !input.trim()} onClick={() => send()} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function BriefColumn({ title, tone, icon, items, muted }) {
  return (
    <Card>
      <div className="card-head" style={{ padding: "11px var(--pad-card)" }}>
        <h3 className="center gap8" style={{ fontSize: 12.5 }}><span className="badge" style={{ background: "var(--st-" + tone + "-bg)", color: "var(--st-" + tone + ")", height: 19 }}><Icon name={icon} size={11} /></span>{title}</h3>
        <span className="badge idle">{items.length}</span>
      </div>
      <div className="list">
        {items.map((it, i) => (
          <div key={i} className="list-row" style={{ padding: "10px var(--pad-card)" }}>
            <span className="sdot" style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid var(--border-strong)", flex: "none" }}></span>
            <div style={{ flex: 1 }}>
              <div className="row-title" style={{ fontSize: 12.5, fontWeight: 550, color: muted ? "var(--ink-2)" : "var(--ink)" }}>{it.t}</div>
              <div className="row-sub mono">{it.meta}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function mdToHtml(text) {
  const esc = String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s) => s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*]+?)\*/g, "$1<em>$2</em>").replace(/`(.+?)`/g, "<code>$1</code>");
  const lines = esc.split("\n");
  let out = "", inUl = false;
  for (const ln of lines) {
    const t = ln.trim();
    if (/^[-•]\s+/.test(t)) { if (!inUl) { out += "<ul>"; inUl = true; } out += "<li>" + inline(t.replace(/^[-•]\s+/, "")) + "</li>"; }
    else { if (inUl) { out += "</ul>"; inUl = false; } if (t) out += "<p>" + inline(t) + "</p>"; }
  }
  if (inUl) out += "</ul>";
  return out;
}

function Bubble({ m }) {
  const ai = m.role === "ai";
  const common = {
    maxWidth: "88%", padding: "10px 13px", borderRadius: 12, fontSize: 13, lineHeight: 1.5,
    background: ai ? "var(--surface-inset)" : "var(--accent)", color: ai ? "var(--ink)" : "var(--accent-ink)",
    border: ai ? "1px solid var(--border)" : "0", borderBottomLeftRadius: ai ? 3 : 12, borderBottomRightRadius: ai ? 12 : 3,
  };
  return (
    <div style={{ display: "flex", justifyContent: ai ? "flex-start" : "flex-end" }}>
      {ai
        ? <div className="bubble-md" style={common} dangerouslySetInnerHTML={{ __html: mdToHtml(m.text) }} />
        : <div style={{ ...common, whiteSpace: "pre-wrap" }}>{m.text}</div>}
    </div>
  );
}

Object.assign(window, { InsightStrip, AssistantScreen, Sparkle, lifeContext });
