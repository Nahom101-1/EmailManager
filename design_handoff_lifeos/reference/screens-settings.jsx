/* Settings */
const { useState: useStateS } = React;

function SettingRow({ icon, title, desc, children, danger }) {
  return (
    <div className="list-row" style={{ alignItems: "center" }}>
      {icon && <span className="mono-tile sm" style={{ color: danger ? "var(--st-error)" : "var(--ink-2)" }}><Icon name={icon} size={14} /></span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row-title" style={{ fontSize: 12.5, color: danger ? "var(--st-error)" : "var(--ink)" }}>{title}</div>
        {desc && <div className="row-sub">{desc}</div>}
      </div>
      <div className="center gap8">{children}</div>
    </div>
  );
}

function SettingsScreen({ app }) {
  const [enc, setEnc] = useStateS(true);
  const [aiOn, setAiOn] = useStateS(true);
  const [aiScopes, setAiScopes] = useStateS(window.DATA.aiScopes.map(s => ({ ...s })));
  const t = app.tweaks;
  return (
    <div className="page fade-in" style={{ maxWidth: 860 }}>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Settings</div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Manage local data, security, and connected services. Everything runs on this machine.</p>
        </div>
      </div>

      <div className="grid" style={{ gap: 18 }}>
        {/* Appearance */}
        <Card>
          <div className="card-head"><h3 className="center gap8"><Icon name="sliders" size={15} className="muted" />Appearance</h3></div>
          <div className="list">
            <SettingRow icon={app.theme === "dark" ? "moon" : "sun"} title="Theme" desc="Switch between light and dark surfaces">
              <Seg value={app.theme} onChange={app.setTheme} options={[{ v: "light", label: "Light" }, { v: "dark", label: "Dark" }]} />
            </SettingRow>
            <SettingRow icon="layers" title="Density" desc="Compactness of tables and cards">
              <Seg value={t.density} onChange={(v) => app.setTweak("density", v)} options={[{ v: "compact", label: "Compact" }, { v: "cozy", label: "Cozy" }, { v: "comfy", label: "Comfy" }]} />
            </SettingRow>
          </div>
        </Card>

        {/* AI assistant */}
        <Card>
          <div className="card-head"><h3 className="center gap8"><Sparkle size={15} />AI assistant</h3><span className={"badge " + (aiOn ? "active" : "idle")}>{aiOn ? "Opt-in · on" : "Off"}</span></div>
          <div className="list">
            <SettingRow icon="bolt" title="Cloud AI assistant" desc="Process inbox data in the cloud to power briefings and chat. Off by default.">
              <button className={"switch" + (aiOn ? " on" : "")} onClick={() => setAiOn(!aiOn)}></button>
            </SettingRow>
            <SettingRow icon="send" title="Assistant voice" desc="How the assistant talks to you">
              <Seg value="direct" onChange={() => {}} options={[{ v: "calm", label: "Calm" }, { v: "direct", label: "Direct" }, { v: "warm", label: "Warm" }]} />
            </SettingRow>
          </div>
          <div className="card-pad" style={{ borderTop: "1px solid var(--border)", opacity: aiOn ? 1 : 0.5, pointerEvents: aiOn ? "auto" : "none" }}>
            <div className="section-label" style={{ margin: "0 0 10px" }}>What the assistant can see</div>
            <div className="grid" style={{ gap: 8 }}>
              {aiScopes.map((s) => (
                <div key={s.id} className="between">
                  <div className="center gap10">
                    <span className="mono-tile sm" style={{ color: s.on ? "var(--accent)" : "var(--ink-3)" }}><Icon name={s.id === "content" ? "eye" : s.id === "money" ? "receipt" : s.id === "calendar" ? "clock" : "mail"} size={13} /></span>
                    <div><div className="row-title" style={{ fontSize: 12.5 }}>{s.label}</div><div className="row-sub">{s.desc}</div></div>
                  </div>
                  <button className={"switch" + (s.on ? " on" : "")} onClick={() => setAiScopes(aiScopes.map(x => x.id === s.id ? { ...x, on: !x.on } : x))}></button>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Local data */}
        <Card>
          <div className="card-head"><h3 className="center gap8"><Icon name="db" size={15} className="muted" />Local data</h3><span className="badge active"><Icon name="lock" size={11} />On this machine</span></div>
          <div className="list">
            <SettingRow icon="db" title="Database location" desc="SQLite file storing all scanned metadata">
              <span className="mono faint" style={{ fontSize: 11.5 }}>~/Library/LifeOS/lifeos.db</span>
            </SettingRow>
            <SettingRow icon="download" title="Export data" desc="Download a portable copy of your data as JSON">
              <Btn size="sm" icon="download" onClick={() => app.toast("Exporting data…")}>Export</Btn>
            </SettingRow>
            <SettingRow icon="archive" title="Backup SQLite file" desc="Copy the database to a location of your choice">
              <Btn size="sm" onClick={() => app.toast("Backup created", "ok")}>Back up</Btn>
            </SettingRow>
            <SettingRow icon="trash" title="Clear local data" desc="Permanently remove all scanned metadata" danger>
              <Btn size="sm" variant="danger" onClick={() => app.toast("Clearing requires confirmation", "err")}>Clear</Btn>
            </SettingRow>
          </div>
        </Card>

        {/* Security */}
        <Card>
          <div className="card-head"><h3 className="center gap8"><Icon name="shield" size={15} className="muted" />Security</h3></div>
          <div className="list">
            <SettingRow icon="lock" title="Local encryption" desc={enc ? "Database is encrypted at rest" : "Database is not encrypted"}>
              <span className={"badge " + (enc ? "active" : "warn")}>{enc ? "Enabled" : "Disabled"}</span>
              <button className={"switch" + (enc ? " on" : "")} onClick={() => setEnc(!enc)}></button>
            </SettingRow>
            <SettingRow icon="key" title="Rotate local encryption secret" desc="Re-encrypt the database with a new key">
              <span className="badge idle">Coming soon</span>
            </SettingRow>
            <SettingRow icon="link" title="Disconnect all accounts" desc="Remove every inbox and clear stored tokens" danger>
              <Btn size="sm" variant="danger" onClick={() => app.toast("This will disconnect 3 inboxes", "err")}>Disconnect all</Btn>
            </SettingRow>
          </div>
        </Card>

        {/* Google */}
        <Card>
          <div className="card-head"><h3 className="center gap8"><Provider provider="google" size="sm" />Google</h3></div>
          <div className="list">
            <SettingRow title="Connected OAuth client" desc="alex.rivera@gmail.com · read-only Gmail">
              <span className="badge active"><span className="dot"></span>Active</span>
            </SettingRow>
            <SettingRow icon="refresh" title="Reconnect account" desc="Re-run the Google consent flow">
              <Btn size="sm" icon="refresh" onClick={() => app.toast("Reconnecting Google…")}>Reconnect</Btn>
            </SettingRow>
            <SettingRow icon="trash" title="Revoke & delete token locally" desc="Remove stored OAuth token from this machine" danger>
              <Btn size="sm" variant="danger" onClick={() => app.toast("Token revoked", "ok")}>Revoke</Btn>
            </SettingRow>
          </div>
        </Card>

        {/* IMAP */}
        <Card>
          <div className="card-head"><h3 className="center gap8"><Icon name="mail" size={15} className="muted" />IMAP</h3></div>
          <div className="list">
            {window.DATA.providers.filter(p => p.id !== "custom").map((p) => (
              <SettingRow key={p.id} title={p.name} desc={<span className="mono">{p.server}:{p.port} · SSL</span>}>
                <Btn size="xs" icon="bolt" onClick={() => app.toast("Testing " + p.name + "…")}>Test</Btn>
                <Btn size="xs" variant="ghost" icon="trash" onClick={() => app.toast("Credentials removed")} />
              </SettingRow>
            ))}
          </div>
        </Card>

        {/* Developer */}
        <Card>
          <div className="card-head"><h3 className="center gap8"><Icon name="bolt" size={15} className="muted" />Developer</h3><span className="sub">Environment checks</span></div>
          <div className="card-pad grid" style={{ gap: 0 }}>
            <div className="kv"><span className="k">App version</span><span className="v mono">LifeOS 0.9.2 · build 412</span></div>
            <div className="kv"><span className="k">Environment</span><span className="v center gap6"><span className="badge active"><Icon name="check" size={11} />All checks passed</span></span></div>
            <div className="kv"><span className="k">Google redirect URI</span><span className="v mono" style={{ fontSize: 11 }}>http://localhost:8787/oauth/callback</span></div>
            <div className="kv"><span className="k">Gmail API status</span><span className="v"><span className="badge active"><span className="dot"></span>Enabled</span></span></div>
            <div className="kv"><span className="k">IMAP module</span><span className="v"><span className="badge active"><span className="dot"></span>Loaded</span></span></div>
            <div className="kv"><span className="k">SQLite</span><span className="v mono" style={{ fontSize: 11.5 }}>v3.45 · WAL mode</span></div>
          </div>
        </Card>
      </div>
    </div>
  );
}

window.SettingsScreen = SettingsScreen;
