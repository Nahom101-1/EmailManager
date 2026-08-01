/**
 * Local sentence embeddings for email intelligence.
 * Prefers Xenova/all-MiniLM-L6-v2 via @huggingface/transformers; falls back to a
 * deterministic hashed n-gram embedder so sync never blocks on model download.
 */

export const EMBEDDING_DIMS = 384
export const TRANSFORMER_MODEL = "Xenova/all-MiniLM-L6-v2"
export const FALLBACK_MODEL = "lifeos-hash-v1"

type FeatureExtractor = (
  texts: string | string[],
  options?: { pooling?: string; normalize?: boolean }
) => Promise<{ data: Float32Array | number[] }>

let extractorPromise: Promise<FeatureExtractor> | null = null
let useFallback = false

function l2Normalize(vec: Float32Array): Float32Array {
  let sum = 0
  for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i]
  const norm = Math.sqrt(sum) || 1
  const out = new Float32Array(vec.length)
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm
  return out
}

/** Deterministic 384-d hashed bag-of-trigrams embedding (offline fallback). */
export function hashEmbed(text: string, dims = EMBEDDING_DIMS): Float32Array {
  const vec = new Float32Array(dims)
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim()
  if (!normalized) return vec

  const tokens = normalized.split(/[^a-z0-9@._+-]+/).filter(Boolean)
  for (const token of tokens) {
    const padded = ` ${token} `
    for (let i = 0; i < padded.length - 2; i++) {
      const gram = padded.slice(i, i + 3)
      let h = 2166136261
      for (let j = 0; j < gram.length; j++) {
        h ^= gram.charCodeAt(j)
        h = Math.imul(h, 16777619)
      }
      const idx = (h >>> 0) % dims
      const sign = (h & 0x80000000) === 0 ? 1 : -1
      vec[idx] += sign
    }
  }
  return l2Normalize(vec)
}

async function getExtractor(): Promise<FeatureExtractor | null> {
  if (useFallback) return null
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers")
      // Cache models under the project data dir when possible.
      env.allowLocalModels = false
      env.useBrowserCache = false
      return (await pipeline("feature-extraction", TRANSFORMER_MODEL, {
        dtype: "fp32",
      })) as unknown as FeatureExtractor
    })().catch((err) => {
      console.warn("[embeddings] transformer unavailable, using hash fallback:", err)
      useFallback = true
      throw err
    })
  }
  try {
    return await extractorPromise
  } catch {
    return null
  }
}

export function emailEmbedText(input: {
  from?: string | null
  subject?: string | null
  snippet?: string | null
  bodyText?: string | null
}): string {
  const parts = [
    input.from?.trim(),
    input.subject?.trim(),
    input.snippet?.trim(),
    input.bodyText?.trim()?.slice(0, 1200),
  ].filter(Boolean)
  return parts.join("\n")
}

function parseExtractorOutput(data: Float32Array | number[], count: number): Float32Array[] {
  const flat = data instanceof Float32Array ? data : Float32Array.from(data)
  if (count === 1) {
    if (flat.length === EMBEDDING_DIMS) return [flat]
    return [hashEmbed("")]
  }
  const dims = Math.floor(flat.length / count)
  const out: Float32Array[] = []
  for (let i = 0; i < count; i++) {
    out.push(flat.slice(i * dims, (i + 1) * dims))
  }
  return out
}

export async function embedText(text: string): Promise<{ vector: Float32Array; model: string }> {
  const [result] = await embedTexts([text])
  return result
}

/** Batch embed — uses the transformer once when available. */
export async function embedTexts(
  texts: string[]
): Promise<Array<{ vector: Float32Array; model: string }>> {
  if (texts.length === 0) return []

  const cleaned = texts.map((t) => t.replace(/\s+/g, " ").trim())
  const extractor = await getExtractor()
  if (!extractor) {
    return cleaned.map((t) => ({
      vector: t ? hashEmbed(t) : new Float32Array(EMBEDDING_DIMS),
      model: FALLBACK_MODEL,
    }))
  }

  try {
    // Encode in chunks to keep memory bounded.
    const CHUNK = 32
    const results: Array<{ vector: Float32Array; model: string }> = new Array(cleaned.length)
    for (let start = 0; start < cleaned.length; start += CHUNK) {
      const slice = cleaned.slice(start, start + CHUNK)
      const nonEmptyIdx: number[] = []
      const nonEmpty: string[] = []
      slice.forEach((t, i) => {
        if (t) {
          nonEmptyIdx.push(i)
          nonEmpty.push(t)
        } else {
          results[start + i] = { vector: new Float32Array(EMBEDDING_DIMS), model: FALLBACK_MODEL }
        }
      })
      if (nonEmpty.length === 0) continue

      const output = await extractor(nonEmpty.length === 1 ? nonEmpty[0] : nonEmpty, {
        pooling: "mean",
        normalize: true,
      })
      const vectors = parseExtractorOutput(output.data, nonEmpty.length)
      nonEmptyIdx.forEach((localIdx, j) => {
        const vector = vectors[j]
        if (!vector || vector.length !== EMBEDDING_DIMS) {
          results[start + localIdx] = { vector: hashEmbed(nonEmpty[j]), model: FALLBACK_MODEL }
        } else {
          results[start + localIdx] = { vector, model: TRANSFORMER_MODEL }
        }
      })
    }
    return results
  } catch (err) {
    console.warn("[embeddings] batch encode failed, using hash fallback:", err)
    useFallback = true
    return cleaned.map((t) => ({
      vector: t ? hashEmbed(t) : new Float32Array(EMBEDDING_DIMS),
      model: FALLBACK_MODEL,
    }))
  }
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length)
  let dot = 0
  for (let i = 0; i < n; i++) dot += a[i] * b[i]
  return dot
}

export function vectorToBuffer(vector: Float32Array): Buffer {
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength)
}

export function bufferToVector(buf: Buffer | Uint8Array): Float32Array {
  const copy = Buffer.isBuffer(buf) ? buf : Buffer.from(buf)
  // Ensure alignment for Float32Array view.
  const aligned = copy.byteOffset % 4 === 0 ? copy : Buffer.from(copy)
  return new Float32Array(aligned.buffer, aligned.byteOffset, aligned.byteLength / 4)
}
