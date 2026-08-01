import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

process.env.ENCRYPTION_SECRET ??= "ci-test-encryption-secret"
process.env.LIFEOS_DB_PATH ??= path.join(
  mkdtempSync(path.join(tmpdir(), "lifeos-vitest-")),
  "test.sqlite"
)
process.env.GOOGLE_CLIENT_ID ??= "ci-placeholder-client-id"
process.env.GOOGLE_CLIENT_SECRET ??= "ci-placeholder-client-secret"
