# Singalore

Singalore is a location-aware heritage walking tour app built for Singapore by SC2006 Group 4. Pick a park or district, follow a walking route, and listen to short podcasts about the landmarks along the way. Once you've downloaded a park, you can use the tour offline too.

The project is made up of three main parts:

- **Android app** (Expo / React Native): Handles the map, walking routes, location tracking, landmark audio and offline downloads.
- **Content manager and API** (Next.js, hosted on Vercel): Lets staff manage landmarks and podcasts. The mobile app gets its content through `/api/v1`.
- **Database and storage** (Supabase): Stores the app's content, audio files and images.

## Getting started

1. Install the APK on an Android phone or emulator: **APK link: TODO, paste the latest preview build link here**.
2. Allow location access when prompted, choose a park (such as the NTU campus), and start a tour.
3. **Trying the app outside Singapore?** Tap the **Singalore** title seven times within three seconds to enable developer mode. You can then long-press anywhere on the map to simulate your location and trigger landmark audio.

You can also check whether the API is running here: <https://singalore-m-dmyvrad.vercel.app/api/v1/health>.

## Team

Each team member is responsible for a particular part of the project and covers that area during the demo and Q&A. The paths listed below are relative to `apps/mobile/` wherever they start with `src/`.

| Member | Responsibility | Main folders and features |
| --- | --- | --- |
| Lee Zi Jie | Repository setup, data pipeline and app integration | Root config, `.github/`, `docs/`, `supabase/`, `scripts/`, `packages/ingest/`, mobile config and assets, `src/app/`, `src/composition/` |
| Myra Dwivedi | Backend, API and shared core | `apps/cms/`, `packages/shared/`, `src/core/` |
| Yong Jia | Location, geofencing and navigation | `src/modules/` location, geofence, routing and flow; `src/ui/map/`; route, permission and prompt features |
| Pratham Sandhu | Audio, offline downloads and catalog | `src/modules/` audio, offline, notifications and catalog; player, downloads, explore and summary card features |
| Avanish Avale | App structure, home screen and user settings | `src/modules/` prefs, saved, history, debug and diagnostics; `src/ui/` primitives, theme and hooks; home, search, shell, layers, preferences, saved, history and help features |

## Project structure

The repository is organised into a few main workspaces:

| Folder | What you'll find there |
| --- | --- |
| `apps/mobile` | The Expo Android app |
| `apps/cms` | The Next.js content manager and `/api/v1` endpoints |
| `packages/shared` | Schemas, types, geographic utilities and route ordering used by both the app and API |
| `packages/ingest` | Data ingestion from OpenStreetMap, Wikidata and Wikimedia Commons |
| `supabase/` | Database migrations and seed content |
| `scripts/` | Seeding, podcast audio processing, setup checks and build tools |
| `docs/setup/` | Setup guides |

The mobile app also has separate `core`, `modules` and `ui` layers. We use lint rules to enforce these boundaries, so UI code cannot directly access the database layer.

## Project documentation

If you want to understand how the project works or how to contribute, these documents are a good place to start:

| Document | Description |
| --- | --- |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Team guidelines (R1 to R11) and the process for taking a change from a branch into the app |
| [QUICKSTART.md](QUICKSTART.md) | Setup instructions for running the project locally |

## Testing

We run the **verify** workflow through GitHub Actions for every pull request. A pull request must pass these checks before it can be merged:

- TypeScript type checking across all workspaces.
- ESLint, including checks for module boundaries and writing style.
- Around 1,060 unit tests, using Jest for the mobile app and Vitest for the API and shared packages.
- Seed content validation, a production build of the CMS, and mobile export and prebuild checks.

You can run the same checks locally with:

```bash
npm run verify
```

## Running the project locally

Start with [QUICKSTART.md](QUICKSTART.md), which links to the setup guide for your environment.

| If you're... | Follow this guide |
| --- | --- |
| Setting up the hosted backend and app builds for the first time | [One-Time Project Setup (Host)](docs/setup/host-one-time-setup.md) |
| Developing on Windows with WSL Ubuntu | [Developer Setup: Windows](docs/setup/windows-wsl.md) |
| Developing on a Mac | [Developer Setup: Mac](docs/setup/mac.md) |

Once everything is set up, starting the development environment is straightforward:

```bash
npm run dev
```

Scan the QR code using Expo Go on an Android phone, or drag the latest APK into a running Android Studio emulator. A Google Pixel 8 emulator image is recommended. Give the emulator a little time to start before testing the app.

## Development notes

- **Repository and deployment:** Development and deployment were handled through a separate private repository. We used this arrangement because Vercel's free Hobby plan does not support deployments from private GitHub organisation repositories. The final code was subsequently copied into this repository.
- **AI use:** TODO: Add a description of how the team used AI coding assistants, following the SC2006 AI policy.
- **Version:** The current project version is `0.1.0`.
