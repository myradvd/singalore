# Singalore

Location-aware heritage walking tour app for Singapore. Android app (Expo / React Native), plus a Next.js content manager and API backed by Supabase.

## Start here

**[QUICKSTART.md](QUICKSTART.md)** points you to the right setup guide:

| You are... | Guide |
| --- | --- |
| Setting up the online backend and app builds for the team, once | [One-Time Project Setup (Host)](docs/setup/host-one-time-setup.md) |
| A developer on Windows (WSL Ubuntu) | [Developer Setup: Windows](docs/setup/windows-wsl.md) |
| A developer on a Mac | [Developer Setup: Mac](docs/setup/mac.md) |

The database and CMS run online and are shared by the team, and the app is built in Expo's cloud. After setup, every day is one command:

```bash
npm run dev
```

Before your first change, read **[CONTRIBUTING.md](CONTRIBUTING.md)**: the team rules, and how a change gets from a branch to the app.

## Project layout

| Folder | Contents |
| --- | --- |
| `apps/mobile` | Expo mobile app |
| `apps/cms` | Next.js CMS and `/api/v1` |
| `packages/shared` | Shared schemas, types and utilities |
| `packages/ingest` | OpenStreetMap, Wikidata and Commons ingest |
| `supabase/` | Database migrations and seed content |
| `scripts/` | Seeding, setup checks and build tooling |
| `docs/` | Design decisions, decision log, known limits and setup guides |

## Docs

| Document | What it is |
| --- | --- |
| [QUICKSTART.md](QUICKSTART.md) | Setup: pick your guide |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Team rules; making, shipping and undoing a change |
| [docs/DESIGN_DECISIONS.md](docs/DESIGN_DECISIONS.md) | How the app is built and why |
| [docs/DECISION_LOG.md](docs/DECISION_LOG.md) | Every later change to a design decision, with the reason |
| [docs/KNOWN_LIMITS.md](docs/KNOWN_LIMITS.md) | What is not built yet |
