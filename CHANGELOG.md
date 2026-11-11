# Changelog

Every demo build gets a version and a git tag (`v` plus the version, for example `v0.2.0`). Versions follow semantic versioning: the middle number goes up for a demo with new features or tests, the last number goes up for a demo with fixes only. How to tag a release is in `docs/setup/github-project-board.md` section 3.

The version is the one in the root `package.json`. The app version in `apps/mobile/app.config.ts` stays at 0.1.0 on purpose: the app config feeds the native fingerprint, so changing it can stop over-the-air updates reaching the installed preview app until it is rebuilt. Change it only together with a new app build.

## 0.2.0 (2026-11-11)

Added
- `docs/TESTING.md`: equivalence classes for the geofence radius, the control flow graph, cyclomatic complexity and basis paths for `GeofenceEvaluator.evaluate`, the coverage report, the acceptance smoke test and the manual device checklist.
- Equivalence class tests for the geofence radius (`apps/cms/tests/content.test.ts`) and basis path tests for the geofence evaluator.
- `npm run test:coverage -w @singalore/mobile` for the Jest coverage report.
- Playwright smoke test that signs in to the CMS and lists the landmarks (`npm run e2e`).
- `docs/setup/github-project-board.md`: milestones, the project board and release tags.

Changed
- Seed content and UI fixes (PR #24).
- Podcast seeking holds the released position, and the tour points the walker to the next stop when an episode ends (PR #25).

Fixed
- The verify job passes again. Three new Expo SDK 57 patch releases are in `expo.install.exclude` (D48), so the deploy job ships migrations and app updates again.

## 0.1.0 (2026-11-02)

First demo build: the Android app (map, geofenced podcasts, offline packs, routes, preferences) and the CMS with the `/api/v1` endpoints, released in PR #23.
