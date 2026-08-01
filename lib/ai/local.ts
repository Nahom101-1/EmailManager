// lib/ai/local.ts
import type { ChatMessage } from "@/lib/ai/client"

const BASE_URL = process.env.OLLAMA_URL ?? "http://localhost:11434"
export const LOCAL_MODEL = process.env.OLLAMA_MODEL ?? "llama3.1:8b"

export async function ollamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/tags`, { signal: AbortSignal.timeout(1500) })
    return res.ok
  } catch {
    return false
  }
}

export async function callOllama(system: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: LOCAL_MODEL,
      stream: false,
      messages: [
        { role: "system", content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`Ollama error ${res.status}: ${detail.slice(0, 200)}`)
  }
  const data = (await res.json()) as { message?: { content?: string } }
  const text = data.message?.content?.trim()
  if (!text) throw new Error("Ollama returned no content")
  return text
}

export async function* streamOllama(
  system: string,
  messages: ChatMessage[]
): AsyncGenerator<string> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: LOCAL_MODEL,
      stream: true,
      messages: [
        { role: "system", content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  })
  if (!res.ok) throw new Error(`Ollama error ${res.status}`)
  const reader = res.body!.getReader()
  const dec = new TextDecoder()
  let buf = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split("\n")
    buf = lines.pop() ?? ""
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const evt = JSON.parse(line) as { message?: { content?: string }; done?: boolean }
        if (evt.message?.content) yield evt.message.content
        if (evt.done) return
      } catch {
        // ignore
      }
    }
  }
}
