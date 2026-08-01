"use client"

const ROWS: { keys: string; action: string }[] = [
  { keys: "⌘K / /", action: "Open command palette" },
  { keys: "g t", action: "Go to Today" },
  { keys: "g f", action: "Go to Focus" },
  { keys: "g m", action: "Go to Money" },
  { keys: "g a", action: "Go to Accounts" },
  { keys: "g h", action: "Go to History" },
  { keys: "g r", action: "Go to Review" },
  { keys: "g q", action: "Go to Ask" },
  { keys: "g s", action: "Go to Settings" },
  { keys: "?", action: "Show this help" },
  { keys: "esc", action: "Close palette / help" },
]

export function ShortcutsHelp({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div
      className="cmdk-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose()
      }}
    >
      <div className="cmdk shortcuts-help" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
        <div className="cmdk-input-row">
          <strong>Keyboard shortcuts</strong>
          <button type="button" className="btn ghost xs" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="shortcuts-list">
          {ROWS.map((row) => (
            <div key={row.keys} className="shortcuts-row">
              <kbd>{row.keys}</kbd>
              <span>{row.action}</span>
            </div>
          ))}
        </div>
        <div className="cmdk-footer">
          <span>j/k · e · s · r coming with Focus keyboard nav</span>
        </div>
      </div>
    </div>
  )
}
