"use client"

import { useState } from "react"
import { Btn } from "@/components/ui"
import { useSync } from "@/components/shell/SyncProvider"

export function AccountNotes({ accountId, initialNote }: { accountId: string; initialNote: string }) {
  const { toast } = useSync()
  const [note, setNote] = useState(initialNote)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(initialNote)
  const dirty = note !== savedAt

  async function save() {
    setSaving(true)
    try {
      await fetch(`/api/accounts/${accountId}/note`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) })
      setSavedAt(note)
      toast("Note saved", "ok")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <textarea
        className="input mono"
        style={{ height: 80, padding: 11, resize: "vertical", fontFamily: "var(--font-sans)" }}
        placeholder="Add a private note about this account…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="btn-row mt10" style={{ justifyContent: "flex-end" }}>
        <Btn size="sm" variant="primary" icon="note" disabled={saving || !dirty} onClick={save}>{saving ? "Saving…" : "Save note"}</Btn>
      </div>
    </div>
  )
}
