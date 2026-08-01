# Copilot code review instructions

LifeOS is a local-first Next.js 16 inbox intelligence app (TypeScript, Tailwind v4, SQLite via better-sqlite3).

- Prefer small, focused pull requests
- Match existing patterns and `@/` imports
- Keep cloud AI / email body access gated on user scopes (`scopes.content`)
- Add or update tests in `tests/` for detection, intent, crypto, and other pure logic
- Do not commit secrets, `.env` files, or local SQLite databases under `data/`
- Native packages (`better-sqlite3`, transformers) stay in `serverExternalPackages`
