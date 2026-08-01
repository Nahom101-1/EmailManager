import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react"
import { Icon } from "@/components/ui/Icon"

export { Icon } from "@/components/ui/Icon"

/* ---------- Button ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "" | "primary" | "ghost" | "danger"
  size?: "" | "sm" | "xs"
  icon?: string
  iconR?: string
}

export function Btn({
  variant = "",
  size = "",
  icon,
  iconR,
  children,
  className = "",
  ...rest
}: BtnProps) {
  const cls = ["btn", variant, size, icon && !children ? "icon" : "", className]
    .filter(Boolean)
    .join(" ")
  const isz = size === "xs" ? 13 : 15
  return (
    <button className={cls} {...rest}>
      {icon && <Icon name={icon} size={isz} />}
      {children}
      {iconR && <Icon name={iconR} size={isz} />}
    </button>
  )
}

/* ---------- Card ---------- */
export function Card({
  children,
  className = "",
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <div className={"card " + className} style={style}>
      {children}
    </div>
  )
}

/* ---------- Badge ---------- */
export function Badge({
  tone = "idle",
  dot,
  pulse,
  outline,
  children,
  style,
}: {
  tone?: "active" | "sync" | "error" | "warn" | "idle"
  dot?: boolean
  pulse?: boolean
  outline?: boolean
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <span className={`badge ${outline ? "outline" : tone}`} style={style}>
      {dot && <span className={"dot" + (pulse ? " pulse" : "")} />}
      {children}
    </span>
  )
}

/* ---------- StatusBadge ---------- */
const STATUS: Record<string, { cls: string; label: string }> = {
  active: { cls: "active", label: "Active" },
  syncing: { cls: "sync", label: "Syncing" },
  error: { cls: "error", label: "Error" },
  pending: { cls: "idle", label: "Pending" },
  inactive: { cls: "idle", label: "Inactive" },
  closed: { cls: "idle", label: "Closed" },
  ignore: { cls: "idle", label: "Ignored" },
  ignored: { cls: "idle", label: "Ignored" },
  cancelled: { cls: "idle", label: "Cancelled" },
  unknown: { cls: "warn", label: "Needs review" },
  "needs-review": { cls: "warn", label: "Needs review" },
}

export function StatusBadge({ status, pulse }: { status: string; pulse?: boolean }) {
  const s = STATUS[status] ?? STATUS.unknown
  return (
    <span className={"badge " + s.cls}>
      <span className={"dot" + (pulse ? " pulse" : "")} />
      {s.label}
    </span>
  )
}

/* ---------- Monogram tile ---------- */
export function Tile({
  mono,
  color,
  size = "",
}: {
  mono: ReactNode
  color?: string
  size?: "" | "sm" | "lg"
}) {
  const style: CSSProperties = color
    ? { background: color + "1a", color, borderColor: color + "33" }
    : {}
  return (
    <span className={"mono-tile " + size} style={style}>
      {mono}
    </span>
  )
}

/* ---------- Provider tile ---------- */
export function Provider({ provider, size = "" }: { provider: string; size?: "" | "sm" | "lg" }) {
  if (provider === "gmail" || provider === "google") {
    return (
      <span
        className={"mono-tile " + size}
        style={{ background: "var(--surface-inset)", color: "#4285F4", fontWeight: 800 }}
      >
        G
      </span>
    )
  }
  if (provider === "outlook") {
    return (
      <span
        className={"mono-tile " + size}
        style={{ background: "#0a64bf", color: "#fff", border: 0 }}
      >
        O
      </span>
    )
  }
  return (
    <span className={"mono-tile " + size}>
      <Icon name="mail" size={16} />
    </span>
  )
}

/* ---------- Confidence meter ---------- */
export function Conf({ value }: { value: number }) {
  const pct = value <= 1 ? value * 100 : value
  const bars = Math.round((pct / 100) * 5)
  return (
    <span className={"conf" + (pct < 70 ? " low" : "")} title={Math.round(pct) + "% confidence"}>
      {[0, 1, 2, 3, 4].map((i) => (
        <i key={i} className={i < bars ? "on" : ""} />
      ))}
    </span>
  )
}

/* ---------- Field ---------- */
export function Field({
  label,
  hint,
  children,
}: {
  label?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

/* ---------- helpers ---------- */
export function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function monogram(name: string) {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}
