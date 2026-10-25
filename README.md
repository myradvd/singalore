# Singalore

Location-aware heritage walking tour app for Singapore. Android app (Expo / React Native), plus a Next.js content manager and API backed by Supabase.

## Run it

Follow **[docs/SETUP.md](docs/SETUP.md)**. It covers Windows and macOS from a fresh machine.

You will need:

| Software | Version |
| --- | --- |
| Node.js | 24 LTS (minimum 20.19) |
| Docker Desktop | 4.x |
| Java JDK | **21** (17 also works, 22 or newer fails the Android build) |
| Android Studio | latest, with Android SDK Platform 36 |
| Git | any recent |

Quick start once those are installed:

```sh
npm install
npm run db:start
npm run env:local
npm run db:reset
npm run seed
npm run dev:cms                      # CMS and API on http://localhost:3000
# new terminal, with an emulator running and apps/mobile/.env set (docs/SETUP.md section 5.1)
cd apps/mobile && npx expo run:android
```

## Project layout

| Folder | Contents |
| --- | --- |
| `apps/mobile` | Expo mobile app |
| `apps/cms` | Next.js CMS and `/api/v1` |
| `packages/shared` | Shared schemas, types and utilities |
| `packages/ingest` | OpenStreetMap, Wikidata and Commons ingest |
| `supabase/` | Database migrations and seed content |
| `scripts/` | Seed, env and build tooling |

## More docs

- `docs/SETUP.md`: install and run on Windows or macOS
- `docs/ANDROID_INSTALL.md`: Android build details and standalone APK
- `docs/DEPLOY.md`: hosting the backend
- `docs/KNOWN_LIMITS.md`: what is not built
