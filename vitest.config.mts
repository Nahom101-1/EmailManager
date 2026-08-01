import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.{ts,tsx}"],
      exclude: [
        "lib/db/**",
        "lib/google/**",
        "lib/imap/**",
        "lib/ai/pipeline.ts",
        "lib/ai/client.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": root,
    },
  },
})
