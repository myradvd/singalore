# Rules for changing Singalore

How every change, from a typo to a new feature, gets from your computer to the app on people's phones. Read this once before your first change. First-time setup is in [QUICKSTART.md](QUICKSTART.md).

## The short version

1. Pick (or create) a GitHub **issue** and assign yourself.
2. Make a **branch**. Never commit straight to `main`.
3. Make the change and run `npm run dev` to try it in the emulator.
4. Push the branch and open a **pull request** (PR) that says `Closes #<issue number>`.
5. Wait for the **verify** check to go green, and get one teammate to review.
6. **Merge** with "Create a merge commit".
7. The **deploy** job ships it. Check the **Actions** tab.
8. **Open the demo app twice** to receive it (section 6).

Everything below explains each step and why it exists.

---

## 1. The rules

| # | Rule | Why |
| --- | --- | --- |
| R1 | Never commit directly to `main`. Every change goes through a branch and a pull request | `main` is what the live CMS and the demo app run. A PR lets the tests and a teammate check a change before it goes live |
| R2 | Only merge when the **verify** check is green | Verify runs the type check, lint, about 390 unit tests, the CMS build and the mobile build checks. Red means something is broken |
| R3 | At least one teammate reviews every PR | A second pair of eyes catches mistakes the tests cannot, and reviews show everyone's participation in the history |
| R4 | Merge with **"Create a merge commit"**, not squash or rebase | The merge commit is made by the person who merges. On the free Vercel plan, deploys from commits by people outside the Vercel account can be blocked |
| R5 | One change per PR, with a clear title | Small PRs are easy to review, and easy to undo if something goes wrong |
| R6 | Do not upgrade packages unless the change is about upgrading them | Upgrades can break the build, and upgrading native packages stops over-the-air updates reaching installed apps (section 4). Add flagged packages to `expo.install.exclude` instead, and log it in `docs/DECISION_LOG.md` |
| R7 | Never commit secrets: keys, passwords, `.env` files | The repo may be shared or public. Secrets live in Vercel settings, GitHub Actions secrets and your own gitignored files |
| R8 | Any change to how the app should behave by design gets a row in `docs/DECISION_LOG.md` | The markers and your teammates can see what changed and why |
| R9 | Database changes only through a new migration file in `supabase/migrations/` | The deploy job applies migrations in order. Editing tables by hand in the Supabase dashboard makes the online database differ from the code |
| R10 | Every pull request links its GitHub issue (`Closes #12` in the description) | Each task has an owner and a record of who did it, which is how the team shows fair task distribution |
| R11 | A commit carries the name of the person who did the work. Pairing or AI help is credited with a `Co-authored-by:` line | Git history is used as evidence of contribution, so it has to be true |

### How the rules are enforced

R1 and R2 are enforced by GitHub itself, through a **ruleset** on `main`. The project owner sets it up once, after the first **verify** run has finished (GitHub only lets you require a check it has seen):

1. **Settings > Rules > Rulesets > New ruleset > New branch ruleset.** Name `main`, **Enforcement status: Active**, **Target branches: Add target > Include default branch**.
2. Tick these rules:

| Rule | Setting | Enforces |
| --- | --- | --- |
| Restrict deletions | On | Nobody can delete `main` |
| Block force pushes | On | Nobody can rewrite shared history |
| Require a pull request before merging | Required approvals **1**, **Dismiss stale approvals when new commits are pushed**, **Require conversation resolution before merging**, Allowed merge methods **Merge** | R1, R3, R4 |
| Require status checks to pass | Add check **verify** | R2 |
| Bypass list | **Repository admin**, **For pull requests only** | Emergencies only; nobody pushes straight to `main` |

3. **Settings > General > Pull Requests:** only **Allow merge commits** on, and **Automatically delete head branches** on.

Do not require `app-build-check` (it only warns) or `deploy` (it runs after a merge).

On GitHub Free, rulesets only work on **public** repos. A private repo needs GitHub Pro, free for students through the GitHub Student Developer Pack. Without it, R1 and R2 are a team agreement, not enforced.

---

## 2. Making a change, step by step

Run these in Ubuntu, in your project folder (`cd ~/repos/SWE/singalore-m`, or wherever you cloned it).

### Step 1. Start from the latest main

```bash
git checkout main
git pull
npm ci
```

- `git checkout main`: switch to the `main` branch.
- `git pull`: download everyone else's merged changes.
- `npm ci`: install exactly the package versions in `package-lock.json`. Run it after every pull, in case someone changed packages.

### Step 2. Make a branch

```bash
git checkout -b fix-podcast-button-label
```

- `git checkout -b <name>`: create a new branch and switch to it. Use a short name that says what the change is, with dashes instead of spaces.

### Step 3. Make the change and try it

```bash
npm run dev
```

- `npm run dev`: checks your setup, then starts Metro. Open **Singalore Dev** in the emulator. Every time you save a file, the app reloads with your change. Press `Ctrl+C` to stop.

Changing the CMS instead? Push your branch and open a pull request: Vercel posts a preview link of your version of the CMS on it.

### Step 4. Run the checks yourself (optional, saves waiting)

```bash
npm test
```

- `npm test`: runs every unit test. Faster than waiting for GitHub to find a failure.

If you added logic, add a test next to it: a file ending in `.test.ts` in the same folder (mobile) or in the package's `tests/` or `test/` folder.

### Step 5. Commit and push

```bash
git add -A
git commit -m "Podcast button: say Listen instead of Play"
git push -u origin fix-podcast-button-label
```

- `git add -A`: mark every changed file to be saved.
- `git commit -m "<message>"`: save a snapshot with a short description of what and why.
- `git push -u origin <branch>`: upload the branch to GitHub. `-u origin` remembers the link, so next time `git push` is enough.

### Step 6. Open a pull request

GitHub shows a **Compare & pull request** button after you push. Click it. The description box fills with the team's checklist (from `.github/pull_request_template.md`): fill in what changed, the issue it closes, and how you tested it, tick the boxes, and click **Create pull request**. Ask a teammate to review it.

### Step 7. Wait for checks and review

- **verify** runs automatically (about 15 minutes). Green tick: passed. Red cross: click **Details** to see what failed, fix it on the same branch, commit and push again. The check reruns by itself.
- **app-build-check** says whether the change needs a new app build (section 5). A yellow warning means merging it will stop over-the-air updates reaching installed apps until someone rebuilds.
- **Vercel** posts a preview link if the CMS changed.
- The reviewer leaves comments or approves. Push fixes to the same branch.

### Step 8. Merge

Click **Merge pull request**, choose **Create a merge commit**, confirm. Then click **Delete branch**: the work is safe in `main`.

### Step 9. Watch it ship

Open the repository's **Actions** tab. A **verify** run starts on `main`, then a **deploy** run. When deploy is green, the change is live (section 3 says what that means for each kind of change).

---

## 3. What happens to each kind of change

| What you changed | How it reaches users | Rebuild the app? |
| --- | --- | --- |
| **Content**: landmark text, photos, podcasts | Edit it in the CMS (`https://<your-site>/cms`). No code, no PR. The app shows it next time it loads the catalog | No |
| **CMS or API code** (`apps/cms`) | Vercel redeploys the site from `main` in a minute or two | No |
| **Database tables** (`supabase/migrations/`) | The deploy job applies new migrations to the online database | No |
| **App screens and logic** (`apps/mobile/src`, `packages/shared`) | The deploy job publishes an **over-the-air update** to the demo app | No |
| **App config, permissions, plugins, or a package with native code** | Needs a new build (section 5) | **Yes** |

---

## 4. How over-the-air updates work (the explanation)

An installed app has two layers:

1. **The native shell**: the compiled Android part. It contains the map engine, GPS, audio, notifications and every package written in Java or Kotlin. Only a **build** can change it.
2. **The JavaScript bundle**: your screens, logic and text. This is what you edit almost every day.

An **over-the-air update** replaces only layer 2. The deploy job runs `eas update`, which uploads a new JavaScript bundle to Expo's servers on the `preview` channel. Every installed **Singalore Preview** app checks that channel each time it starts.

**The fingerprint.** A new bundle only works with the native shell it was written for. Expo calculates a **fingerprint** (a code that summarises everything native: packages, config, plugins) for each build and each update. An app only accepts an update with the **same fingerprint**. This is why R6 matters: upgrading a native package changes the fingerprint, so installed apps silently ignore new updates until they are rebuilt. It is a safety feature, because a bundle that expects native code the app does not have would crash.

**Why "open twice".** To start fast, the app always opens the bundle it already has, and downloads a new one in the background. The new bundle is used from the **next** launch. So the first open downloads the update, and the second open runs it.

**Which app gets updates:**

| App | Package | Code comes from | Gets over-the-air updates? |
| --- | --- | --- | --- |
| **Singalore Dev** | `com.singalore.app.dev` | Metro on your computer, live | No, it does not need them: it always runs your current files |
| **Singalore Preview** (demo app) | `com.singalore.app.preview` | The built-in bundle, then updates from the `preview` channel | **Yes** |

---

## 5. When you need a new build

### How you find out

You do not have to remember the list below: a check tells you.

- **On every pull request**, the **app-build-check** job compares the code's fingerprint with the latest finished builds on Expo. If a rebuild is needed it shows a yellow **warning** on the PR ("Singalore Preview needs a new build") and writes the details, including which files caused it, in the job's **Summary**. It needs the `EXPO_TOKEN` secret ([host setup](docs/setup/host-one-time-setup.md) step 8); without it the job only says it could not ask Expo.
- **On your own computer**, any time:

```bash
npm run app:check
```

- `app:check`: works out the fingerprint of the code in your folder and compares it with the newest Singalore Preview and Singalore Dev builds on Expo. For each app it prints **OK** (updates still reach it) or **NEEDS A NEW BUILD**, with the command to run and the files that likely caused it. It needs `npx eas login` once.

Check before merging a PR that touched packages or app config, and before a demo.

### What causes it

Rebuild after any of these, then reinstall:

- adding, removing or upgrading a package that has native code (most `expo-*` and `react-native-*` packages; if unsure, rebuild),
- changing `apps/mobile/app.config.ts` (name, permissions, plugins, icons),
- changing `apps/mobile/eas.json`, the `scripts` in `apps/mobile/package.json`, or the files in `apps/mobile/config/`,
- changing the app icons or splash image in `apps/mobile/assets/`.

```bash
npm run app:build:dev
npm run app:build:demo
```

- `app:build:dev`: new **Singalore Dev** app for everyone's daily development.
- `app:build:demo`: new **Singalore Preview** demo app. Older demo apps stop receiving updates once the fingerprint changes, so everyone reinstalls this one.

Answer **no** when it asks to install on an emulator (it cannot reach the Windows emulator from Ubuntu). Download the `.apk` from the link it prints and drag it onto the emulator. Free builds can wait **90 minutes or more** in Expo's queue, so never leave a build until the day of a demo.

---

## 6. Launching the app after an update

### Demo app (Singalore Preview)

1. Make sure the **deploy** run in the **Actions** tab finished green (or that `npm run app:update` finished, if you published by hand).
2. Open **Singalore Preview** on the emulator or phone, with internet. Wait about 10 seconds: it downloads the update in the background.
3. **Close it fully**: open recent apps (the square button, or swipe up and hold) and swipe it away. Pressing Home is not enough.
4. **Open it again.** It now runs the new code.

To confirm which code it runs: expo.dev > your project > **Updates** lists every published update with its message. The newest one on the `preview` channel is what the app will load.

### Dev app (Singalore Dev)

No update step. Run `git pull`, then `npm run dev`, and open the app. It loads whatever is in your project folder.

---

## 7. Publishing an update by hand

Normally the deploy job does this when a PR is merged. Do it by hand only if the GitHub secrets are not set up yet, or just before a demo:

```bash
git checkout main
git pull
npm run app:update
```

- `npm run app:update`: bundles the app's code from your folder and publishes it to the `preview` channel, using your last commit message as its description.

Only publish from an up-to-date `main`. Publishing from a branch sends unreviewed code to everyone's demo app.

---

## 8. If a change breaks something: undo it

**Fastest and safest: revert the pull request.**

1. On GitHub, open the merged pull request that caused the problem.
2. Click **Revert**. GitHub creates a new pull request that undoes it exactly.
3. Wait for **verify**, then merge it as usual.

The deploy job then ships the old code again: Vercel redeploys the CMS, and a new over-the-air update restores the app. Users get the fix by opening the app twice.

**Database migrations do not undo themselves.** A revert removes the migration file but not the change it already made to the online database. Write a new migration that reverses it.

---

## 9. Troubleshooting

| Problem | Fix |
| --- | --- |
| **verify** is red | Click **Details** on the check, scroll to the first red line. Fix on the same branch and push |
| verify fails at **expo-doctor** with "packages out of date" | Expo released new patch versions. Add those packages to `expo.install.exclude` in `apps/mobile/package.json` (R6) and log it |
| PR shows an old commit and the check does not rerun | GitHub occasionally misses a push. Push an empty commit: `git commit --allow-empty -m "Rerun checks"` then `git push` |
| deploy job says steps were **skipped** | The GitHub secrets are missing ([host setup](docs/setup/host-one-time-setup.md) step 8). Publish by hand (section 7) meanwhile |
| Demo app does not show the update | Open it twice (section 6). If still old: run `npm run app:check`. If it says NEEDS A NEW BUILD, the fingerprint changed and only a rebuild helps (section 5). Otherwise check the update exists on expo.dev on the `preview` channel |
| Vercel deploy blocked, "not part of the team" | A commit by someone outside the Vercel account. Merge with a merge commit (R4), or make the repo public |
| App shows "Unable to fetch nearby landmarks" | Open developer tools (tap the SINGALORE title 7 times, then the bug icon) and read the network log. `401` means Vercel Deployment Protection is on ([host setup](docs/setup/host-one-time-setup.md) step 4) |
