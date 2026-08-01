# Security

## Reporting

If you find a security issue, email [nahom@berhane.no](mailto:nahom@berhane.no). Do not open a public issue for sensitive reports.

## Secrets

Never commit `.env`, `.env.local`, OAuth tokens, IMAP passwords, or SQLite databases under `data/`. The repository should use GitHub secret scanning and push protection.

Local secrets live in `.env.local` (see `.env.example`):

- `ENCRYPTION_SECRET` — encrypts stored IMAP credentials
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Gmail OAuth
- `ANTHROPIC_API_KEY` — optional cloud assistant (opt-in)

## Privacy

LifeOS is local-first. Cloud AI and email body/snippet access must stay gated on user settings (`cloudAiEnabled` + `scopes.content`). Do not bypass those checks in tools, extract, or context builders.

## Dependencies

Dependabot opens weekly update PRs. CI runs `npm audit --audit-level=critical` on production dependencies before merge. Some high findings in `next` / `sharp` / `@huggingface/transformers` currently have no safe upgrade path; re-check when upstream ships fixes.

## Production / deploy

If you deploy (e.g. Vercel), set the same env vars in the host — never in the repository. Prefer keeping mailbox data on the user's machine for this app.
