# Known limits

Things that are not built, or cannot work as the SRS wishes. Each one is either shown disabled in the UI with a short reason, or explained here.

## Platform limits

- **Background geofencing is best effort.** NFR 1.1 (3 s) holds with the app in the foreground, where every GPS fix is evaluated. In the background the OS wakes the app; Android documents typical latency under 2 minutes and up to 6 minutes when stationary. iOS monitors at most 20 regions, so Singalore registers only the nearest 15 landmarks with podcasts and uses a 100 m minimum OS radius.
- **Background arrivals notify, they do not autoplay.** When the app is woken in the background, Singalore sends an arrival notification. Tapping it opens the app and either autoplays (Autoplay Mode) or shows the prompt. Starting audio from a headless background task is not attempted (DECISION_LOG D16). Notification permission and "Allow all the time" location access are both needed for background arrivals. If location services are turned off during a background tour, the app does not notice until it returns to the foreground.
- **Search picker cap.** The search picker allows more than 11 picks; the user learns of the 11 stop cap only when closing the picker.
- **Long cached routes.** A cached draft or tour of 12 or more stops restores whole and gets the generic route error.
- **Autoplay needs alerts.** With Autoplay on and alerts or notification permission off, a background arrival gives no audio and no notification.
- **No offline basemap.** Offline, the map shows cached tiles if any, otherwise a plain background with pins, boundaries, route and user dot.
- **The public routing server has no SLA.** See DEPLOY.md for self hosting OSRM.
- **Podcast uploads on Vercel are limited to about 4.5 MB** by the platform's request body limit. The CMS accepts up to 50 MB when self hosted or run locally.
- **Local Android builds need JDK 21.** Android Studio's bundled JDK 25 fails the React Native CMake steps (see ANDROID_INSTALL.md).

## Seed podcasts

- **Preferred length has no effect.** Every seed episode runs 5 to 10 minutes and is classified `long` (DECISION_LOG D27), so the Preferred length setting in Tour Preferences never changes which episode plays.
- **Episodes are AI narrated and not fact checked.** The audio is synthesised by Kokoro. The episode facts were drafted by AI from public web sources and have not been independently fact checked.
- **The audio generator was only tested on macOS.** `npm run seed:audio` has not been run on Linux, WSL or Windows.

## Shown disabled in the app

- **Avoid steep inclines** and **Prefer covered walkways** (Tour Preferences, Route). The public OSRM foot profile has no incline or shelter data.
- **New episode alerts** (Tour Preferences, Notifications). There is no push service; local notifications cannot learn about new content while the app is closed.
- **Recommendations** (Tour Preferences). Recommendation logic is not built; the stored category and radius preferences are unused.

## Deferred by the owner (lean scope, 12 Oct 2026)

- OSM and Wikidata import UI in the CMS (the ingest code exists in `packages/ingest` and is used by the seed script).
- Load test script for NFR 5.1.
- Sentry crash reporting (NFR 6.1). The local diagnostics log (NFR 6.2) is built.
- Tour history polish.
- Debug path playback UI. Spoofing by long press works; `SpoofLocationSource.playPath` exists and is unit tested but has no screen.
- UI polish beyond the mockup layout.
- CMS beyond landmark and podcast create, edit and publish: no park editor, no map picker (latitude and longitude are typed), no image upload, no delete, no audit log screen (audit rows are written), no import screen. Parks are managed through the seed or Supabase Studio.
