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

Then, scan the QR on an android phone with the ExpoGo App installed, or drag the latest APK onto a running virtual device on Android Studio (Recommended: Google Pixel 8, or any previously set-up emulator device). 
Note: Current emulator is buggy and may need some set-up time.
Click on the "Singalore" title 7 times fast (within 3 seconds) to enable developer mode and simulate location (if turned on) by long pressing any area on the map.

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
| [CONTRIBUTING.md](CONTRIBUTING.md) | Team rules; making, shipping and undoing a change. Ensuring safe and proper development of this project |

## Notes

The latest available version is Version 0.1.0, and can be found under the docs/ folder.
