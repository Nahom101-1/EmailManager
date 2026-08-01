import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Keep native / heavy ML packages out of the Next bundler.
  serverExternalPackages: [
    "better-sqlite3",
    "@huggingface/transformers",
    "onnxruntime-node",
    "sharp",
  ],
}

export default nextConfig
