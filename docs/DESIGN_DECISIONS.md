# Singalore Design Decisions

Prepared 12 October 2026 for the SC2006 Group 4 project "Self-Guided Heritage & History Walk Explorer".
Written for Claude Code in plan mode. A human (Pratham) reviews the plan before any code is written.

## 0. How to use this document

Everything marked **Decided** is a default. The plan may deviate, but only with a written reason in `docs/DECISION_LOG.md`.
Anything marked **Verify at plan time** depends on library behaviour that changes quickly. Check current docs before committing to it.

Source precedence when files disagree:

| Area | Winner, then fallbacks |
| --- | --- |
| Behaviour and requirements | `docs/SRS.md` sections 1 to 5, then Appendix A, then Appendix B |
| Screen flow and navigation | `design/dialog-map-latest.puml`, then `design/dialog-map-cache-states.puml`, then `design/dialog-map-final.png` |
| Look, layout, copy | `design/ui-*.png` |
| Data shape | SRS Data Dictionary, then `design/class-diagram-*.png`, then section 7 of this document where it extends them |
| Technology | This document. The AI-written stack in the original team document assumed five people and is partly replaced here |

The wordmark in the mockups reads SINGALORE. Treat it as the working app name and keep it in one constant (`APP_NAME`).
The mockup images are low resolution. Open all of them before planning and note details this document does not mention.

## 1. What is being built

A mobile app (iOS and Android) that lets a walker explore Singapore heritage sites on a live map. Entering a landmark's geofence offers a short podcast about it.
Walkers can build a custom walking itinerary, get a walking route with turn by turn guidance, and download a heritage park's podcasts for offline use.
Content managers maintain landmarks and audio through a web CMS without shipping an app update. Developers get a hidden debug mode that spoofs location.

Definition of done for the whole build:

1. `npm run verify` at the repo root passes. It runs typecheck, lint, unit tests, the CMS production build, and an Expo export or prebuild check.
2. The mobile app builds as a development build and launches on at least one simulator or emulator, if the toolchain exists on the machine. If it does not, say so in `docs/PROGRESS.md` and prove the build with `expo export` and `expo prebuild`.
3. Every SRS v1.0 use case and every Tier 2 item in section 2 has working code and at least one automated test of its core logic.
4. `docs/TESTING.md` contains the manual device checklist for the things automation cannot prove (section 12).
5. No stub that pretends to work. Anything not built is listed in `docs/KNOWN_LIMITS.md` and visibly disabled in the UI.
6. The repo holds everything needed to put the app on an Android phone and to host the backend: `eas.json`, `docs/ANDROID_INSTALL.md`, `docs/DEPLOY.md`, and `docs/HUMAN_TASKS.md` (the steps only the owner can do). See section 16.

## 2. Scope

**Tier 1, must work.** SRS v1.0 FR 1.1 to 5.5 and NFR 1.1 to 8.3, and all 17 use cases 1.1.1 to 1.5.5.

**Tier 2, build.** These appear in the SRS Data Dictionary, the mockups, or Appendix A, so the team clearly expects them.

- Explore menu: browse heritage parks by name or district, independent of proximity.
- Search with debounced autocomplete, tolerant of misspellings and aliases (A1).
- Preferences screens: Podcast and Audio, Route Preferences, Recommendations, Notifications, Manage Downloads, Help Centre link (A3, A-FR8).
- Saved Routes and Sites, including bookmarking from the site summary card (A4).
- Tour History.
- Podcast transcript view (A5).
- Geofence trigger switch and Autodetect start toggle (A2, plus the Data Dictionary meaning of Autodetect).
- Route editor with drag reorder, Auto-Order, Restore, Clear All, and an undo path.
- Exit navigation modal (A6) and offline connectivity banner with downloads shortcut (A7).
- Map layer toggle.
- Resume cards that offer to continue an unfinished tour or route draft after a restart.

**Tier 3, tooling.** Content management web app, ingest from OpenStreetMap and Wikidata, Developer Debug Mode (Appendix B), diagnostics log, crash reporting.

**Out of scope.** Explorer accounts, social features, remote push notifications, offline basemap tiles, tablet layouts, analytics, multi language UI, generating podcasts inside the app.

## 3. Architecture

```
Mobile app (Expo, React Native, TypeScript)        Next.js app on Vercel                    Supabase
-------------------------------------------        ---------------------------------        ---------------------------
UI: Expo Router + MapLibre                          /api/v1/catalog        (cached) -------> Postgres (content only)
Flow machine (pure reducer)                         /api/v1/parks/:id/pack (cached) -------> Storage (audio, images, public)
Modules: location, geofence, audio, catalog,        /api/v1/route, /route/table  --------->  Auth (content managers only)
  offline, routing, prefs, saved, history,                |
  debug, diagnostics                                      +--> Routing provider (OSRM compatible, foot)
SQLite: catalog cache and all user data             /cms  (UI and server actions)
File system: downloaded audio and images            ingest: Overpass, Wikidata, Wikimedia Commons
```

Decided:

- The mobile app never talks to Supabase directly. It only calls `/api/v1`. No Supabase key ships in the app.
- All database access is server side in the Next.js app. Row level security is enabled with no public policies as a second lock.
- Content is served as a full snapshot with an ETag, not as deltas. At a few hundred landmarks the snapshot is small, and replace-all sync has far fewer failure modes than delta sync with tombstones.
- Explorers have no account. All user data lives in on-device SQLite. `explorerID` in the Data Dictionary is a random UUID generated on first launch that never leaves the device.
- One monorepo using npm workspaces. If Metro cannot resolve workspace packages in the M0 spike, fix the Metro config rather than switching tools.

### Repo layout

```
apps/mobile        Expo app
apps/cms           Next.js app (CMS UI and /api/v1)
packages/shared    zod schemas, DTO types, geo and ordering utilities, constants
supabase/          migrations, seed
docs/              SRS.md, DESIGN_DECISIONS.md, PLAN.md, PROGRESS.md, DECISION_LOG.md, design/
scripts/           seed, demo audio, load test
CLAUDE.md          conventions and commands, created first
```

## 4. Stack

| Area | Decision | Reason |
| --- | --- | --- |
| Language | TypeScript, strict, `noUncheckedIndexedAccess` | One language for app, CMS, API |
| Mobile | Expo, latest stable SDK at plan time, development client, prebuild (native folders gitignored) | Background location and MapLibre need native code. Expo Go cannot be used |
| Navigation | Expo Router. Home is one route that hosts the map and overlays. Secondary screens are stack routes | Keeps the map mounted for performance and state |
| Map | `@maplibre/maplibre-react-native` with OpenFreeMap vector style via env var | OSM data, no API key, data driven layers keep 60 FPS |
| Location | `expo-location` and `expo-task-manager` | Foreground watch plus OS geofencing |
| Audio | `expo-audio` behind an `AudioEngine` interface | Background playback and lock screen controls. Interface lets us swap to react-native-track-player if a spike fails |
| Local DB | `expo-sqlite`, hand written versioned migrations, repository layer, no ORM | Fewer moving parts |
| Files | `expo-file-system` current API | Resumable downloads, free disk check |
| Connectivity | `@react-native-community/netinfo` plus a health probe | NetInfo alone cannot detect captive or flaky links |
| State | Zustand per module. Pure reducers for the flow machine | Testable without React |
| Validation | zod on every network response and every DB row read | Fail loudly at boundaries |
| Geo math | Own haversine for hot paths. `@turf/*` for nearestPointOnLine, circle, bbox | Hot path stays allocation light |
| Search | Fuse.js over the local catalog | Handles typos and aliases offline |
| Gestures and sheets | Reanimated and Gesture Handler. Use `@gorhom/bottom-sheet` only if it supports the installed Reanimated, otherwise a small in-house sheet | Library compatibility is a known trap |
| Backend | Next.js App Router, TypeScript | One deployable for CMS and API |
| Data and media | Supabase Postgres, Storage (public bucket for media), Auth for content managers. No PostGIS | A few hundred rows do not need spatial indexes |
| Routing | OSRM compatible HTTP behind a `RoutingProvider` interface. Default `https://routing.openstreetmap.de/routed-foot` | See verified facts below |
| Ingest | Overpass API, Wikidata, Wikimedia Commons, run from the CMS server | Backend owns external APIs, as the SRS Backend Server class says |
| Crash reports | `@sentry/react-native`, active only when a DSN is set, no PII | NFR 6.1 |
| Tests | `jest-expo` (mobile), Vitest (shared, cms), Playwright (CMS smoke) | |
| CI | GitHub Actions running the same steps as `npm run verify` | |
| Hosting | Local first with `supabase start`. Then hosted Supabase, Vercel for the CMS, EAS for mobile builds | Lets Claude Code run everything without cloud accounts |

Verified on 12 October 2026:

- Expo SDK 56 shipped on 21 May 2026 with React Native 0.85 and React 19.2. Use whatever is latest stable when planning, and install packages with `npx expo install` so versions match the SDK.
- The FOSSGIS foot router answered `/route/v1/foot/...` and `/table/v1/foot/...` for Singapore coordinates (about 2.3 km between two test points returned 1869 s, roughly 4.5 km/h). It is a free public service with no stated SLA.
- OpenFreeMap is free, needs no API key and requires attribution. Bulk tile download from the public instance is not clearly permitted.

Not verified, so check at plan time: exact OpenFreeMap style URL, MapLibre React Native and Reanimated and bottom-sheet compatibility on the chosen SDK, current `expo-audio`, `expo-file-system` and `expo-location` APIs. Expo docs pages are available as markdown by appending `.md` to the URL.

## 5. Mobile module design

Mapping from the SRS boundary and control classes to code:

| SRS class | Module | Responsibility |
| --- | --- | --- |
| BackendServer | `catalog` | `CatalogApi`, `CatalogSync`, repositories, local search index |
| GeofenceMonitor | `geofence` | Pure `GeofenceEvaluator`, `GeofenceEngine`, OS region window, background task |
| PlaybackController | `audio` | `AudioEngine`, session persistence, podcast picker |
| OfflineManager | `offline` | Download queue, pack state machine, storage accounting, connectivity |
| RouteOptimizer | `routing` | `RoutePlanner`, `RoutingClient`, ordering, ETA, maneuver text, off-route detection |
| PreferenceManager | `prefs`, `saved`, `history` | Preferences, saved routes and sites, tour history |
| DebugSession | `debug` | Spoof source, overlays, force trigger, network log |
| Map, PodcastPrompt, AudioPlayer, ExploreMenu, RouteEditorInterface, PreferenceInterface | `ui/*` | Screens and components |

Plus `location` (sources and engine), `flow` (dialog map state machine), `diagnostics` (local log), and `core` (config, http client, event bus, db, logger).

Rules, enforced by lint (`eslint-plugin-boundaries` or `import/no-restricted-paths`). This is SRS NFR 7.2.

- `ui` may import modules. Modules never import `ui`.
- Modules talk to each other only through `core/events` (typed event bus) or through interfaces declared in `core`.
- `location` and `geofence` must not import `audio`. `audio` must not import `location`.
- A composition root (`src/app/container.ts`) wires real implementations. Tests wire fakes.
- Every module that touches a device API exposes an interface plus a real and a fake implementation.

Code conventions (remove this block from `CLAUDE.md` if you prefer defaults):

- Minimal comments. Only add one where the code cannot say why.
- Allman braces enforced with ESLint `@stylistic/brace-style` set to `allman`. Do not add Prettier, because it rewrites braces.
- Verbose, explicit names over clever compact code.
- No em dashes in UI copy, docs, commit messages, or comments.

## 6. Behaviour decisions

### 6.1 Geofencing (the hardest part, plan it carefully)

Two cooperating engines. The foreground evaluator is the authority. OS geofencing is only a wake-up hint.

- **Foreground evaluator.** Pure TypeScript. On every location fix it compares distance to each landmark in the catalog and emits `enter` and `exit`. Injected clock, no globals, fully unit tested.
- **Entry rule.** Enter when `distance <= radius` and `horizontalAccuracy <= 40 m`. First qualifying fix is enough, so a 1 Hz feed meets the 3 second target (NFR 1.1).
- **Exit rule.** Exit when `distance > radius + max(15 m, 0.5 * radius)` on two consecutive fixes or for 5 seconds. This hysteresis stops flapping at the boundary and implements UC 1.3.5.
- **Radius.** Per landmark, set in the CMS, range 15 to 100 m, seed default 30 m. The SRS value of 20 m is an example ("e.g."). GPS error in Singapore's dense areas is often 10 to 30 m, so 20 m will miss entries.
- **OS geofencing window.** iOS allows 20 monitored regions per app and Android 100 (**verify at plan time**). The catalog may hold more than that, so register only the nearest 15 landmarks that have a podcast and refresh the set when the user has moved more than about 150 m. Register OS regions at `max(radius, 100 m)` because OS region monitoring is unreliable below that.
- **Background flow.** An OS enter event wakes the task. The task takes one high accuracy fix and runs the evaluator. If the user is inside the real radius it raises a local notification (and tries autoplay if Autoplay Mode is on). If not, it starts a short high accuracy "approach" watch.
- **While a tour is active and the app is backgrounded.** Use a low power location task to keep the OS window fresh. On Android this needs a foreground service notification. Needs "Always" location permission, so build a rationale screen before the OS prompt.
- **Honest reading of NFR 1.1.** The 3 second target holds with the app in the foreground. Background triggering is best effort and can take much longer. State this in `docs/KNOWN_LIMITS.md`.
- **Prompt rules.** One prompt per entry. After a dismiss, suppress that landmark for 10 minutes unless the user exits and re-enters. A landmark already played in the current tour is not re-prompted. Landmarks without a published podcast never prompt (UC 1.3.2.2). If audio is currently playing, show a small "Next up" chip instead of a prompt, and in Autoplay Mode queue the next episode if the user is still inside that geofence when the current one ends.

Three separate switches, all easy to confuse, so name them exactly:

| Setting | Meaning | Where |
| --- | --- | --- |
| Geofence triggers | Master switch (A2). Off means no prompts, no autoplay, no OS regions registered | Preferences, Podcast and Audio |
| Autoplay Mode | On entry, play immediately instead of showing the prompt (FR 3.3, UC 1.3.3) | Preferences, Podcast and Audio |
| Autodetect start | Data Dictionary meaning. On the Route Confirmation screen, begin navigation automatically when the user is within `detectionRadius` (default 50 m) of the first stop | Route Confirmation screen |

### 6.2 Location engine

- A `LocationSource` interface with `DeviceLocationSource` (expo-location) and `SpoofLocationSource` (debug). The engine consumes whichever is active, so spoofed fixes take the exact same path as real ones (UC 1.6.3).
- Modes. `browse`: balanced accuracy, 15 m distance filter. `tour`: high accuracy, 5 m, about 1 s. The engine switches by flow state and by app state to save battery (A-NFR2).
- No fix for 10 seconds raises a "Waiting for GPS signal" state and a diagnostics entry (NFR 6.2, UC 1.1.2.1).
- Permission states are modelled explicitly: undetermined, foreground only, always, denied, services off. Each maps to UI from the dialog map (Location Permission Modal with "Go to Settings").
- Only the latest fix is held in memory. See 6.9.

### 6.3 Audio

- One player. States: idle, loading, buffering, playing, paused, ended, error.
- Controls: play, pause, resume, skip back and forward 10 s, seek bar, playback speed (mockup shows a speed control), lock screen and notification controls, background playback.
- Audio mode: play in silent mode, interrupt other apps' audio rather than mix (UC 1.3.3.1), resume or stay paused according to the interruption type.
- Source choice: local file if the pack is downloaded and the file passes a size check, otherwise stream. Offline with no local file shows the UC 1.4.2.1 error.
- Prefetch metadata and prepare the player when the prompt is shown, so playback starts within 1.5 s on activation (NFR 1.2).
- Persist `audio_session` every 5 s while playing and on every state change and on app background. On launch restore to paused and show a resume card. Never autoplay on launch.
- Leaving the geofence mid-episode never touches playback. It shows a non blocking "You are out of range of X. Audio continues." notice (UC 1.3.5).
- Podcast choice is a pure function `pickPodcast(landmark, prefs)` using voice, accent and length class when variants exist. The schema allows several podcasts per landmark. The seed data has one. Settings for voice, accent and length show only options the catalog offers.

### 6.4 Catalog, search and explore

- On launch and on each foreground, if online, call `/api/v1/catalog` with `If-None-Match`. On 200, replace the cached tables in one transaction and keep download state keyed by IDs. On 304 or failure, use the cache.
- First launch with no network and no cache shows a clear empty state, not a spinner.
- "Nearby landmarks" (FR 2.1) is a local query over the cached catalog. Map pins come from a GeoJSON source with clustering. Do not render one React view per landmark.
- Search: Fuse.js over name, aliases, category, park name, district. 300 ms debounce. Results grouped into parks and landmarks. Empty state text from A1.
- Explore: parks list filterable by name and district, park detail with landmarks, "Read more" expansion, "See on map", "+" to add to the itinerary, and the Download prompt with estimated size.
- Layers: Standard and Heritage boundaries always. Satellite only if `EXPO_PUBLIC_SATELLITE_TILE_URL` is set, otherwise hidden.
- Show map attribution (OpenStreetMap contributors, OpenFreeMap). It is a licence requirement.

### 6.5 Offline

- The light catalog (names, coordinates, radius, park, duration, short text) is cached automatically on any successful sync, because the geofence engine needs it offline.
- A **pack** is the manual download of one park (FR 4.1): audio, images, long descriptions, transcripts. `GET /api/v1/parks/:id/pack` lists the files with byte sizes, plus SHA-256 checksums for audio. Images are verified by size.
- Pack states: `not_downloaded`, `downloading`, `paused`, `downloaded`, `failed`, `update_available`.
- Downloads are resumable, verify checksums and sizes, check free disk first (UC 1.4.1.2), honour "Download over Wi-Fi only", report progress, and send a local notification on completion if enabled.
- Connectivity banner (A7, UC 1.4.1.1): show "Your internet is unstable" with a "Go to downloads?" link when NetInfo says offline, or when 2 of the last 5 API calls failed or took over 3 s. Dismissable.
- Offline behaviour: tracking, geofencing and playback of downloaded podcasts continue. Pins and boundaries come from cache. Undownloaded podcasts show a disabled state with the reason.
- There are no offline basemap tiles. Offline, the map shows cached tiles if any, otherwise a plain background with pins, boundaries, route and the user dot. This is a known limit.

### 6.6 Routing and navigation

Pipeline: selected stops, optional Auto-Order, route request, decode, metrics, render.

- **Auto-Order.** Fetch a duration matrix from `/api/v1/route/table` for the user position plus stops. Solve locally in `packages/shared`: exact dynamic programming up to 9 stops, nearest neighbour plus 2-opt above that. Start fixed at the user, end free. Unit test against brute force.
- **Route.** `/api/v1/route` with `steps`, polyline6 geometry, full overview. Decode on device.
- **ETA.** Provider duration multiplied by a pace factor (slow 1.25, normal 1.0, fast 0.85). Also show total time including podcast durations (the route editor mockup shows both).
- **Provider fallback.** On timeout or error show the SRS message (UC 1.5.2.1). Also offer a straight line guide using haversine distance, labelled approximate, with no turn by turn.
- **Turn text.** OSRM returns maneuver type and modifier, not sentences. Build the instruction strings on device with a small tested formatter.
- **Progress.** Project the user fix on the polyline (turf `nearestPointOnLine`) to get the current step and distance to the next maneuver. Mark a stop visited when its geofence is entered.
- **Off-route (UC 1.5.4.1).** More than 40 m from the line for 5 s raises a prompt: Return to path, or Recalculate from here through the remaining stops.
- **Modify route (UC 1.5.5).** Add or remove stops, then recalculate. The editor shows the previous route until the new one arrives. Clear All is undoable with Restore.
- **Persist the planned route** (polyline, stops, progress index) in `flow_cache` so an active tour survives a restart and keeps working offline (NFR 2.1, 2.3).
- **Preferences that cannot be honoured.** The routing provider has no elevation or covered walkway data. Show "Avoid steep inclines" and "Prefer covered routes" as persisted but disabled with the caption "Not available yet". Walking pace and distance units are real.
- **Server proxy.** `POST /api/v1/route` and `/route/table`. Validate that every coordinate is inside the allowed region (Singapore bounding box plus margin), cap at 12 coordinates, rate limit per IP, 8 s upstream timeout, one retry. Use POST so coordinates never appear in URLs. Do not log request bodies. Log status and latency only.

### 6.7 Exit navigation

The mockup shows a three button dialog, "Save before leaving?", which supersedes the plain "Are you sure?" in A6.

- **Save and Exit.** Writes the itinerary to Saved Routes and a Tour History entry, clears the active route.
- **Discard and Exit.** Writes a Tour History entry (completed or abandoned) but does not save the itinerary, clears the route.
- **Cancel.** Resumes navigation.

Exiting also stops the OS geofence window and resets the location engine to browse mode (A6 notes).

### 6.8 Preferences, saved items, history

- `preferences` is a typed key value table validated by zod, with Reset to defaults and an unsaved changes guard (A3).
- Saved Routes and Sites holds bookmarked landmarks and saved itineraries. Works fully offline (A-NFR3).
- Tour History stores itinerary, start and end time, completion status and the visited landmark IDs. It never stores GPS traces.
- Notifications: local only, via `expo-notifications`. Route updates (off-route while backgrounded), download completions, geofence arrivals while backgrounded. The "new episodes" toggle is persisted but disabled with "Not available yet" because it needs remote push.

### 6.9 Privacy (NFR 3.2)

- Raw user coordinates are never written to disk or sent anywhere, with one exception: the transient route and table requests to the proxy.
- Persisted state stores the planned route, the next stop index, and the landmark ID of the active geofence. On restart the app re-acquires a fresh fix. This satisfies NFR 2.3 without keeping a location history.
- Sentry runs with `sendDefaultPii: false` and a `beforeSend` that strips anything resembling coordinates. The diagnostics log stores event types and error codes, never positions.
- Add a short `docs/PRIVACY.md` that states exactly what leaves the device.
- A unit test asserts the API client only sends coordinates to the two route endpoints.

### 6.10 Flow machine

Implement the dialog map as a pure reducer `flowReducer(state, event)` with a typed state union, typed events and named guards, in `src/modules/flow`. Unit test it as a transition table taken from `dialog-map-latest.puml`.

- Top level modes: `Empty`, `RouteEditor` (draft), `RouteInProgress`. These are the three cache states the app restores on launch (`flow_cache`).
- Transient overlays (Sidebar, Search, Expanded Map, modals) are a navigation stack, so the "origin" bookkeeping in the diagram is implicit. Do not store `origin` by hand.
- Secondary pages (Preferences, Downloads, Help Centre, Saved, History, Explore) are stack routes that return to wherever they were opened from.
- Add states the diagrams omit but the mockups show: Splash, Location Permission Modal, Exit Navigation Modal (three actions), Transcript sheet, Resume card.

## 7. Data

### 7.1 Postgres (content, managed by the CMS)

```
heritage_parks      id uuid pk, slug unique, name, district, description, center_lat, center_lng,
                    boundary jsonb null (GeoJSON Polygon), thumbnail_path, status draft|published,
                    created_at, updated_at
heritage_landmarks  id uuid pk, park_id fk not null, slug unique, name, aliases text[], category,
                    lat, lng, geofence_radius_m int default 30 check 15..100,
                    short_description, description, thumbnail_path, image_path,
                    built_year int null, architectural_style text null,
                    wikidata_id null, osm_type null, osm_id null, attribution text,
                    sort_order, status, created_at, updated_at
podcasts            id uuid pk, landmark_id fk, title, audio_path, duration_seconds, file_size_bytes,
                    checksum_sha256, transcript text null, voice null, accent null,
                    length_class null (short|standard|long), status, created_at, updated_at
content_managers    user_id uuid pk refs auth.users, display_name, role editor|admin, created_at
content_audit       id, user_id, entity, entity_id, action, at
```

Rules: a published landmark needs a published park. A published podcast needs `audio_path`, `duration_seconds`, `file_size_bytes` and a checksum. Categories are a fixed list: religious, residential, civic, commercial, transport, museum, military, other.

### 7.2 API (all shapes are zod schemas in `packages/shared`)

| Endpoint | Purpose | Caching |
| --- | --- | --- |
| `GET /api/v1/health` | Liveness and server time | none |
| `GET /api/v1/catalog` | Published parks, landmarks, podcasts, light fields. Returns `etag` and `generatedAt` | `public, s-maxage=60, stale-while-revalidate=600`, ETag, 304 |
| `GET /api/v1/parks/:id/pack` | Full details, transcripts, media list with bytes, and SHA-256 for audio | same as catalog |
| `POST /api/v1/route` | Walking route with steps | none |
| `POST /api/v1/route/table` | Duration matrix | none |

Errors are `{ "error": { "code": string, "message": string } }`. Audio and images are served straight from the public Supabase Storage CDN.

### 7.3 SQLite (device)

```
meta, parks, landmarks, podcasts           catalog cache, replaced on sync
landmark_detail                            filled by packs (long text, transcript)
downloads, download_files                  pack state and per file state
audio_session                              single row, restore point
flow_cache                                 single row, mode and payload for restart
preferences                                key, value_json
itineraries                                saved and draft itineraries
saved_items                                bookmarked landmarks and saved itineraries
tour_history                               outcome rows, no GPS traces
diagnostics_log                            ring buffer, 500 rows
```

There is no table that stores user coordinates. Migrations are versioned with `PRAGMA user_version` and unit tested against an in-memory database.

### 7.4 Seed content

Singapore, three parks of 5 to 8 landmarks each. The mockups show Tiong Bahru Estate, Tiong Bahru Market, Thian Hock Keng Temple, Tanjong Pagar Railway Station, Chijmes, Victoria Theatre, National Museum of Singapore and Raffles Hotel. Group landmarks by their true neighbourhood, for example Tiong Bahru, Civic District, and Telok Ayer with Tanjong Pagar. Do not copy the mockup grouping, it mixes areas.
Fetch real coordinates and descriptions from Wikidata and OSM through the same ingest code the CMS uses. Store attribution. Treat all text and audio as demo content.
Demo narration: generate short audio with a local text to speech tool if one exists (`say` and `afconvert` on macOS, `espeak-ng` and `ffmpeg` elsewhere), otherwise a tone fallback. Real narration is a content task done through the CMS, not a code task.
Also include a generator that creates 150 synthetic landmarks for NFR 5.2 tests and the geofence window tests.

## 8. UI

### 8.1 Visual language (read from the mockups, confirm by sampling the PNGs)

- Dark chrome, translucent "glass" cards, one gold accent. Approximate values: background `#101010` to `#181818`, borders `#383830`, gold `#B8A858` (sample a more exact value), light text `#F2F2F2`, muted text about `#A0A0A0`, destructive red for Exit.
- Map base is light and low saturation for sunlight legibility. Route line is gold with a dark casing. Heritage boundaries use a clearly different tone (UC 1.1.3 notes).
- Wordmark: uppercase, wide tracking. Headings semibold. Body regular.
- Tokens live in one `theme` file. A unit test checks that every text and background pair meets WCAG AA contrast (NFR 4.2).

### 8.2 Primitives

IconButton (minimum 48 dp, player controls 56 dp or more, NFR 4.3), PrimaryButton (gold pill), Card, BottomSheet, Toast, Banner, Toggle, Chip, ListRow, StatTile, SeekBar, Modal, EmptyState, ErrorState. Every screen uses these. Respect system font scaling (A-NFR1), screen readers, and reduce motion.

### 8.3 Screens

| Screen | Mockup | Dialog map state | Use cases |
| --- | --- | --- | --- |
| Home with map, search bar, pins, boundaries, recenter, layers, headphones shortcut, GPS status icon | 01, 03 | Home_Empty | 1.1.1 to 1.1.3, 1.2.1, 1.2.2 |
| Site summary card, with bookmark and Read more | 01, 02 | Home_Empty | 1.2.2, A4 |
| Podcast prompt and mini player | 02, 04 | Home_RIP or Home_Empty | 1.3.2, 1.3.4 |
| Full audio player with transcript | 02, 09 | MainNav | 1.3.4, A5 |
| Route editor strip and expanded editor | 02, 05 | Home_REO, RouteEd | 1.5.1, 1.5.5 |
| Route confirmation with autodetect toggle | 08 | RouteConfirm | 1.5.2 to 1.5.4, A2 |
| Active navigation with turn card and audio panel | 09 | MainNav | 1.5.4, 1.3.5 |
| Exit navigation modal | 04 | ConfirmDiscard | A6 |
| Sidebar | 06 | Sidebar | navigation |
| Tour Preferences and sub pages | 06 | PrefPage | A3, A8 |
| Search and Explore results | 07 | Search | 1.2.3 (A1), 1.5.1 |
| Manage Downloads | 06 | Downloads | 1.4.1, 1.4.2, A7 |
| Saved Routes and Sites, History, Help Centre | 06 | sidebar targets | A4, Data Dictionary |
| Debug tools | none | none | 1.6.x |

Open questions the mockups do not settle, so decide in the plan and log it: what the right hand bottom bar icon does (default: opens Explore), the exact contents of the right hand map button cluster (default: layers, recenter, podcast preferences), and whether the sidebar "Explore" item and the bottom bar item are the same destination (default: yes).

## 9. CMS

- Auth: Supabase Auth email and password. Only users in `content_managers` get in. Invites are done in the Supabase dashboard, the CMS only lists users.
- Pages: dashboard (counts, drafts), parks, landmarks, podcasts, import, audit log.
- Landmark editor: map picker for coordinates with a live circle showing the geofence radius, aliases, category, facts, thumbnail upload.
- Podcast editor: upload audio (mp3, m4a, aac, up to 50 MB), server side duration and checksum, transcript text, publish toggle.
- Import: choose a bounding box or park, query Overpass for heritage and historic objects with names, enrich from Wikidata and Commons, create drafts with attribution. A manager reviews and publishes. This is how FR 2.1 "query OpenStreetMap or Wikidata" is met, through the backend.
- Playwright smoke test: sign in, create a landmark, upload a small audio fixture, publish, and see it in `/api/v1/catalog`.

## 10. Developer Debug Mode

- Gate: build flag `EXPO_PUBLIC_DEBUG_TOOLS=1` (on for development and preview, off for production) and a hidden gesture (tap the wordmark 7 times). The state does not survive reinstall (UC 1.6.1 notes). No login.
- GPS metadata overlay: latitude, longitude, accuracy, active geofence, refresh rate. Never blocks map touches.
- Location spoof: long press on the map to jump, a path playback tool that walks a saved path at a chosen speed, and "Restore real location". A persistent banner shows while spoofing.
- Force trigger or clear any podcast prompt, bypassing proximity checks.
- Network log: the device only calls our backend, so the log shows those calls with status and latency. This is the right reading of the original "OSM and Wikidata" wording. The CMS server logs its own upstream calls separately.
- Diagnostics log viewer and a geofence visualizer that draws entry and exit rings.
- Be clear in `docs/TESTING.md` that spoofing tests the engine logic only. It does not exercise OS level geofencing.

## 11. NFR traceability

| NFR | How it is met | Verified by |
| --- | --- | --- |
| 1.1 Geofence 3 s | Foreground evaluator on every fix, 1 Hz in tour mode | Unit test with fake clock, manual walk |
| 1.2 Audio start 1.5 s | Prepare player when prompt shows, stream with range requests | Manual timing |
| 1.3 60 FPS | GeoJSON layers not views, throttled camera updates | Manual perf check on a mid range Android |
| 2.1 Offline failover | Cache first, persisted route, local audio | Unit and manual airplane mode test |
| 2.2 99.5 percent uptime | Edge cached endpoints, cache first client. Depends on hosting | Documented |
| 2.3 Session persistence | `audio_session` and `flow_cache` | Unit test and manual kill and relaunch |
| 3.1 Encryption in transit | HTTPS only. Cleartext allowed only in development builds | Config test |
| 3.2 Location privacy | Section 6.9 | Unit test and review |
| 4.1 No account friction | No explorer auth anywhere | Review |
| 4.2 Outdoor contrast | Token contrast test, light basemap | Unit test |
| 4.3 Touch targets | Primitive minimum sizes | Unit test on primitives |
| 5.1 1000 concurrent users | Cacheable snapshot, CDN media | `scripts/loadtest` against catalog |
| 5.2 100 landmarks | Synthetic 150 landmark dataset | Unit and perf tests |
| 6.1 Crash reporting | Sentry, no PII | Review |
| 6.2 Diagnostics log | Ring buffer in SQLite | Unit test |
| 7.1 CMS without app update | CMS plus snapshot sync | Playwright |
| 7.2 Modularity | Lint boundaries, interfaces and fakes | Lint in CI |
| 8.1 iOS and Android | Expo development builds for both | Build check |
| 8.2 Audio rerouting | OS default routing, correct audio mode | Manual with headphones |
| 8.3 Screen sizes | Flexible layouts | Manual at small and large phone sizes |

## 12. Testing

Automated:

- Pure logic with unit tests: geofence evaluator (entry, exit, hysteresis, accuracy gating, window selection), Auto-Order, ETA, maneuver text, off-route, podcast picker, flow reducer, migrations, contrast tokens, API client privacy rule.
- Module tests with fakes: audio engine, offline manager, catalog sync, routing client with recorded fixtures.
- Component tests with React Native Testing Library for key screens and their empty and error states.
- CMS: Vitest for server code, Playwright smoke test.

Manual, listed in `docs/TESTING.md` with exact steps:

- Background geofence entry on a real iPhone and a real Android phone (or simulator and emulator location playback).
- Lock screen and headphone controls, audio focus with another app playing.
- Kill and relaunch during playback and during navigation.
- Airplane mode during a tour.
- Low accuracy GPS behaviour near tall buildings.

## 13. Build order

Run milestones in order. Each ends with a green `npm run verify`, an updated `docs/PROGRESS.md`, and a commit. Do not start the next milestone on a red gate.

| Milestone | Content | Gate |
| --- | --- | --- |
| M0 Foundations and spikes | Repo, tooling, CI, `CLAUDE.md`, shared schemas, Supabase schema and seed, CMS shell and `/api/v1` skeleton, mobile dev build that shows a MapLibre map with the live dot, requests background location, plays a hosted audio file in the background, and registers a geofence task. `eas.json` profiles exist from the start | Spike results recorded in `docs/SPIKES.md`. If a spike fails, stop and report alternatives (react-native-maps, react-native-track-player) instead of improvising |
| M1 Catalog and map shell | Sync, SQLite, pins, boundaries, summary card, recenter, layers, home shell, flow reducer v1, search and explore basics | Tests plus app launches with seeded data |
| M2 Location and geofence | Location engine, evaluator, prompt, autoplay logic, OS window, debug mode core (spoof, overlay, force trigger) | Evaluator test suite, spoof drives a prompt in the app |
| M3 Audio | Engine, mini and full player, lock screen, persistence, transcript, out of range notice | Audio tests, restore works |
| M4 Offline | Download manager, banner, offline playback, storage screen | Offline manager tests |
| M5 Routes | Itinerary, editor, Auto-Order, confirmation, navigation, off-route, exit modal, saved routes, history, proxy endpoints | Route tests, end to end route in app against the routing provider |
| M6 Shell and preferences | Sidebar, all preferences screens, saved sites, help centre, notifications, resume cards, permission flows, empty and error states | Screen tests |
| M7 CMS complete | CRUD, upload, import, publish, audit, Playwright | Playwright green |
| M8 Hardening and delivery | NFR checks, perf pass, accessibility pass, Sentry, README, `PRIVACY.md`, `TESTING.md`, `KNOWN_LIMITS.md`, `DESIGN_DELTA.md`, `ANDROID_INSTALL.md`, `DEPLOY.md`, `HUMAN_TASKS.md`, Android build proof | Full verify, final report |

`docs/DESIGN_DELTA.md` lists every place the code differs from the SRS class diagram, boundary and control classes, or dialog map. The team needs it for their report.

## 14. Risks and limits

1. Background geofencing is controlled by the OS. Delays, minimum radii and permission prompts vary. Foreground behaviour is reliable, background is best effort.
2. The public routing server has no SLA and is not sized for 1000 concurrent walkers. For a real launch, self host OSRM with the foot profile on a Singapore extract behind the same `RoutingProvider`. Provide an optional `infra/osrm` docker compose file if time allows.
3. No offline basemap. A tile provider that permits offline packs, or self hosted PMTiles, would fix it.
4. Native module churn between Expo SDKs. Pin versions after the M0 spike and do not upgrade mid build.
5. Narration audio is synthetic. Real episodes must be recorded and uploaded through the CMS.
6. Claude Code cannot test on real phones. Anything needing a device is in the manual checklist, not claimed as verified.
7. Forty plus use cases in one pass tends to produce shallow implementations. The milestone gates and tests are the guard. Do not skip them to save time.
8. Wikipedia and Wikidata text is licensed with attribution. Store and display it.

## 15. Assumptions made (change these in the plan if wrong)

- Pratham is the sole developer, with Claude Code doing the implementation.
- Launch region is Singapore.
- Local development uses Docker for `supabase start`. If Docker is missing, ask for a hosted Supabase project URL and keys during planning.
- Code style is minimal comments and Allman braces.
- Sentry is optional and off until a DSN is provided.
- Apple and Google developer accounts are not needed for development builds on simulators and emulators.
- Claude Code runs locally on the owner's Mac. The owner tests on an Android phone and uses the iOS simulator only.
- The owner will host the backend (Supabase and Vercel, or a temporary tunnel) before any outdoor test.

## 16. Delivery to a phone

The end product is a repository, not an installable file. The APK is built from it with one command. These items make that path work.

- The primary test target is an Android phone. iOS must still build and run in the simulator. Both come from the same code.
- `eas.json` has three profiles.
  - `development`: development client, APK output, API URL from env, cleartext HTTP allowed so a phone can reach a laptop over Wi-Fi. Needs the Metro dev server running.
  - `preview`: standalone release APK, no dev server, HTTPS API URL only, debug tools flag on, Sentry on only if a DSN is set, internal distribution.
  - `production`: placeholder with debug tools off. It is not exercised.
- API base URL, map style URL and debug flag are set per profile through env, never hard coded. A preview build must never point at localhost or a LAN address.
- Walking outdoors needs a reachable backend, because route planning always calls the API. `docs/DEPLOY.md` covers two routes: a hosted Supabase project plus Vercel, and a temporary tunnel (cloudflared or ngrok) to the laptop. Catalog data and downloaded podcasts keep working offline after one sync on Wi-Fi.
- Android specifics to handle in code and docs:
  - Background location: show a rationale screen, then send the user to the app's system settings, because Android 10 and later grant "Allow all the time" only there.
  - `POST_NOTIFICATIONS` on Android 13 and later.
  - A location foreground service for the active tour task.
  - Battery optimisation exemption for aggressive vendors such as Xiaomi and some Samsung models. Explain it in the docs and link to the setting where the OS allows.
- Prove the Android build. If the Android SDK is installed, build a debug APK locally (`expo prebuild`, then Gradle) and record the result in `docs/PROGRESS.md`. If it is not installed, say so.
- `docs/ANDROID_INSTALL.md` gives exact steps: enable Developer options and USB debugging, run `npx expo run:android`, produce and sideload the preview APK (EAS cloud build or local build), grant permissions, run the first sync, download a park pack, and read logs with `adb logcat`.
- `docs/HUMAN_TASKS.md` is an ordered checklist of what only the owner can do:
  - install Xcode, Android Studio and Docker Desktop
  - enable USB debugging on the phone
  - run `eas login`
  - create the hosted Supabase and Vercel projects and paste in the keys
  - provide an optional Sentry DSN
  - record real podcast audio and review content and attributions
  - walk-test with the checklist in `docs/TESTING.md`
  - update the class diagram and dialog map using `docs/DESIGN_DELTA.md`
