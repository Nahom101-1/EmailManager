/** Primary IA from docs/UI_UX_SPEC.md §1. */

export type NavItem = {
  href: string
  label: string
  icon: string
  /** Match nested routes under this href */
  match?: "exact" | "prefix"
  /** Shown in desktop sidebar primary list */
  desktop?: boolean
  /** Shown in mobile bottom tab bar */
  mobile?: boolean
  /** Shown in mobile "More" sheet */
  more?: boolean
  /** Keyboard go-to sequence after `g` (e.g. "t" → g t) */
  goKey?: string
}

export const PRIMARY_NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Today",
    icon: "dashboard",
    match: "exact",
    desktop: true,
    mobile: true,
    goKey: "t",
  },
  {
    href: "/focus",
    label: "Focus",
    icon: "flag",
    match: "prefix",
    desktop: true,
    mobile: true,
    goKey: "f",
  },
  {
    href: "/waiting",
    label: "Waiting",
    icon: "clock",
    match: "prefix",
    desktop: true,
    more: true,
    goKey: "w",
  },
  {
    href: "/subscriptions",
    label: "Money",
    icon: "subs",
    match: "prefix",
    desktop: true,
    more: true,
    goKey: "m",
  },
  {
    href: "/accounts",
    label: "Accounts",
    icon: "accounts",
    match: "prefix",
    desktop: true,
    more: true,
    goKey: "a",
  },
  {
    href: "/people",
    label: "People",
    icon: "user",
    match: "prefix",
    desktop: true,
    more: true,
    goKey: "p",
  },
  {
    href: "/history",
    label: "History",
    icon: "archive",
    match: "prefix",
    desktop: true,
    more: true,
    goKey: "h",
  },
  {
    href: "/assistant",
    label: "Ask",
    icon: "bolt",
    match: "prefix",
    desktop: true,
    mobile: true,
    goKey: "q",
  },
]

export const UTILITY_NAV: NavItem[] = [
  {
    href: "/review",
    label: "Review",
    icon: "flag",
    match: "prefix",
    desktop: true,
    more: true,
    goKey: "r",
  },
  {
    href: "/emails",
    label: "Emails",
    icon: "mail",
    match: "prefix",
    more: true,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: "settings",
    match: "prefix",
    desktop: true,
    more: true,
    goKey: "s",
  },
  {
    href: "/connect",
    label: "Connect",
    icon: "connect",
    match: "prefix",
    more: true,
  },
  {
    href: "/inbox-sync",
    label: "Inbox sync",
    icon: "sync",
    match: "prefix",
    more: true,
  },
]

export const MOBILE_TABS: NavItem[] = [
  PRIMARY_NAV.find((n) => n.href === "/dashboard")!,
  PRIMARY_NAV.find((n) => n.href === "/focus")!,
  PRIMARY_NAV.find((n) => n.href === "/assistant")!,
  {
    href: "#search",
    label: "Search",
    icon: "search",
    mobile: true,
  },
  {
    href: "#more",
    label: "More",
    icon: "dots",
    mobile: true,
  },
]

export function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.href.startsWith("#")) return false
  if (item.match === "exact") return pathname === item.href
  return pathname === item.href || pathname.startsWith(item.href + "/")
}

export const ALL_NAV = [...PRIMARY_NAV, ...UTILITY_NAV]
