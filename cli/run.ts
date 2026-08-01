#!/usr/bin/env tsx
import path from "node:path"
import { render } from "ink"
import React from "react"
import { App } from "./App.js"

// Set DB path before any DB imports happen.
// Matches the LIFEOS_DB_PATH env var used by lib/db/local.ts.
process.env.LIFEOS_DB_PATH =
  process.env.LIFEOS_DB_PATH ?? path.join(process.cwd(), "data", "lifeos.sqlite")

const { unmount } = render(React.createElement(App))

process.on("SIGINT", () => {
  unmount()
  process.exit(0)
})
