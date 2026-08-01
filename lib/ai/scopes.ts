import type { AiScopeId } from "@/lib/db/local"

export interface AiScopeMeta {
  id: AiScopeId
  label: string
  desc: string
}

// The opt-in sources the assistant may read. Order is the display order in the
// "Cloud AI · N/5 sources" access-control dropdown. `content` is the sensitive
// one and defaults OFF (see DEFAULT_AI_SETTINGS).
export const AI_SCOPES: AiScopeMeta[] = [
  { id: "inboxes", label: "Inboxes & sync", desc: "connected accounts and their status" },
  { id: "subscriptions", label: "Subscriptions", desc: "detected recurring charges" },
  { id: "accounts", label: "Accounts", desc: "services tied to your email" },
  {
    id: "metadata",
    label: "Email metadata",
    desc: "senders, subjects and dates — no message text",
  },
  { id: "content", label: "Message contents", desc: "snippets and body text, not just metadata" },
]
