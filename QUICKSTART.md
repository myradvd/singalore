# Quick start

Singalore runs on a shared online backend, so most people only install a few tools and run one command a day:

```bash
npm run dev
```

## Pick your guide

| You are... | Follow | Time |
| --- | --- | --- |
| Setting up the project for the team, **once** (online database, CMS, Expo builds) | [One-Time Project Setup (Host)](docs/setup/host-one-time-setup.md) | About 2 hours, mostly waiting |
| A teammate on **Windows** (with WSL Ubuntu) | [Developer Setup: Windows](docs/setup/windows-wsl.md) | About 45 minutes |
| A teammate on a **Mac** | [Developer Setup: Mac](docs/setup/mac.md) | About 30 minutes |

Teammates need **no** Supabase, Vercel or Expo accounts, no Docker and no Java. The host shares one app file and everyone connects to the same online backend.

## How it fits together

| Part | Where it runs | Who sets it up |
| --- | --- | --- |
| Database and files (Supabase) | Online, shared | Host, once |
| CMS and API (Next.js on Vercel) | Online, shared | Host, once |
| The app's code (Metro) | Your computer | Everyone: `npm run dev` |
| Android emulator | Your computer | Everyone, once |
| The installed app (Singalore Dev) | Built in Expo's cloud | Host builds it and shares the file |

## After setup

- **Making a change, shipping a fix, undoing a mistake:** [CONTRIBUTING.md](CONTRIBUTING.md).
- **Does the app need a new build?** Run `npm run app:check`.
