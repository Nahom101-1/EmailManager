import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  // Keep native / heavy ML packages out of the Next bundler.
  serverExternalPackages: [
    "better-sqlite3",
    "@huggingface/transformers",
    "onnxruntime-node",
    "sharp",
  ],
}

export default nextConfig
