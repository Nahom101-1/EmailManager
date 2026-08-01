"use client"

import { Card, Icon } from "@/components/ui"
import { useTheme, type Accent } from "@/components/theme/ThemeProvider"

const ACCENTS: Array<{ v: Accent; c: string }> = [
  { v: "green", c: "oklch(0.52 0.085 158)" },
  { v: "blue", c: "oklch(0.55 0.12 252)" },
  { v: "violet", c: "oklch(0.55 0.14 295)" },
  { v: "amber", c: "oklch(0.62 0.13 62)" },
  { v: "graphite", c: "oklch(0.42 0.012 250)" },
]

function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ v: T; label: string }>
  onChange: (v: T) => void
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.v} className={value === o.v ? "on" : ""} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Row({
  icon,
  title,
  desc,
  children,
}: {
  icon: string
  title: string
  desc: string
  children: React.ReactNode
}) {
  return (
    <div className="list-row" style={{ alignItems: "center" }}>
      <span className="mono-tile sm" style={{ color: "var(--ink-2)" }}>
        <Icon name={icon} size={14} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row-title" style={{ fontSize: 12.5 }}>
          {title}
        </div>
        <div className="row-sub">{desc}</div>
      </div>
      <div className="center gap8">{children}</div>
    </div>
  )
}

export function AppearanceCard() {
  const { theme, style, accent, density, set } = useTheme()
  return (
    <Card>
      <div className="card-head">
        <h3 className="center gap8">
          <Icon name="sliders" size={15} className="muted" />
          Appearance
        </h3>
      </div>
      <div className="list">
        <Row
          icon={theme === "dark" ? "moon" : "sun"}
          title="Theme"
          desc="Switch between light and dark surfaces"
        >
          <Seg
            value={theme}
            onChange={(v) => set("theme", v)}
            options={[
              { v: "light", label: "Light" },
              { v: "dark", label: "Dark" },
            ]}
          />
        </Row>
        <Row icon="layers" title="Surface style" desc="Card shape and depth">
          <Seg
            value={style}
            onChange={(v) => set("style", v)}
            options={[
              { v: "flat", label: "Flat" },
              { v: "soft", label: "Soft" },
              { v: "grid", label: "Grid" },
            ]}
          />
        </Row>
        <Row icon="db" title="Density" desc="Compactness of tables and cards">
          <Seg
            value={density}
            onChange={(v) => set("density", v)}
            options={[
              { v: "compact", label: "Compact" },
              { v: "cozy", label: "Cozy" },
              { v: "comfy", label: "Comfy" },
            ]}
          />
        </Row>
        <Row icon="tag" title="Accent" desc="The highlight colour across the app">
          <div className="center gap8" style={{ padding: "2px 0" }}>
            {ACCENTS.map((o) => (
              <button
                key={o.v}
                onClick={() => set("accent", o.v)}
                title={o.v}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  background: o.c,
                  border: accent === o.v ? "2px solid var(--ink)" : "2px solid var(--border)",
                  outline: accent === o.v ? "2px solid var(--bg)" : "none",
                  outlineOffset: -4,
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        </Row>
      </div>
    </Card>
  )
}
