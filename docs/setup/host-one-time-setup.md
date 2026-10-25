# One-Time Project Setup (Host)

This puts Singalore online for the whole team: the database, the CMS and API, and the app builds. One person does it, once. Afterwards teammates only follow the [Windows](windows-wsl.md) or [Mac](mac.md) developer guide.

**Time:** about 2 hours, mostly waiting for builds.
**You end with:** a live CMS, a shared database with demo content, the **Singalore Dev** and **Singalore Preview** app files to share, and automatic deploys.

| Step | What | Done when |
| --- | --- | --- |
| [0](#step-0-before-you-start) | Accounts and your own dev setup | `npm ci` finished in the project folder |
| [1](#step-1-create-the-database) | Create the database | Supabase project shows **Healthy** |
| [2](#step-2-create-the-tables) | Create the tables | `npm run db:push` finished |
| [3](#step-3-load-the-demo-content) | Load the demo content | `Seeded ... landmarks` printed 3 times |
| [4](#step-4-put-the-cms-and-api-online) | Put the CMS and API online | `/api/v1/health` shows `"status":"ok"` in a private window |
| [5](#step-5-save-the-api-address) | Save the API address | `npx expo config` runs without errors |
| [6](#step-6-link-the-app-to-expo) | Link the app to Expo | `npx eas project:info` shows your project |
| [7](#step-7-build-the-apps) | Build the apps | Both `.apk` files downloaded |
| [8](#step-8-turn-on-automatic-deploys) | Turn on automatic deploys | Deploy job runs without "skipped" |
| [9](#step-9-protect-main) | Protect `main` | Merging needs a green check |
| [10](#step-10-final-check) | Final check | `npm run app:check` says OK twice |

> **How to read commands:** type them in your terminal (Ubuntu on Windows, Terminal on a Mac) from the project folder unless a step says otherwise. `<angle brackets>` are placeholders: replace the whole thing, brackets included.

---

## Step 0. Before you start

1. Create free accounts: [Supabase](https://supabase.com), [Vercel](https://vercel.com) (sign in **with GitHub**) and [Expo](https://expo.dev).
2. Do your own developer setup first, up to and including `npm ci`: [Windows guide](windows-wsl.md) steps 1 to 4, or [Mac guide](mac.md) steps 1 to 3.

**Expect:** `npm ci` ends with `added ... packages`.

<details>
<summary>Why your own setup comes first</summary>

Every step below runs project tools (`supabase`, `eas`, `tsx`) that `npm ci` installs into the project. Without it you get `sh: 1: supabase: not found`.

</details>

---

## Step 1. Create the database

1. On supabase.com: **New project**.
2. **Region: Southeast Asia (Singapore)**. Check this before clicking create.
3. Set a database password and save it in a password manager. You need it in steps 2 and 8.
4. Wait until the project page shows **Healthy**.
5. Copy the **project ref**: the code in the address bar after `/project/` (about 20 letters).

**Expect:** a project home page with your URL, like `https://abcdefghijklmnopqrst.supabase.co`.

<details>
<summary>Picked the wrong region?</summary>

A Supabase project's region cannot be changed later. If the project is still empty (the home page says **No migrations**), create a new one in Singapore and delete the old one: **Project Settings > General > Delete project**. If you already ran `supabase link`, run it again with the new ref (step 2).

The free plan allows 2 active projects, so you can create the new one before deleting the old.

</details>

---

## Step 2. Create the tables

```bash
npx supabase login
```

- `npx supabase`: runs the Supabase tool installed with the project.
- `login`: connects it to your account. It prints a link; open it in your browser and approve.

```bash
npx supabase link --project-ref <project-ref>
```

- `link`: remembers which online project this folder uses. It asks for the database password from step 1.

```bash
npm run db:push
```

- Creates every table from the files in `supabase/migrations/`. If it asks **Do you want to push these migrations?**, type `y` and press Enter.

**Expect:** `Finished supabase db push.` In the Supabase dashboard, **Table Editor** now lists tables such as `heritage_parks`.

<details>
<summary>Errors in this step</summary>

| You see | Fix |
| --- | --- |
| `sh: 1: supabase: not found` | Packages are not installed. Run `npm ci` in the project folder, then try again |
| `npx supabase link` worked but `npm run db:push` says not found | Same cause: `npx` can fetch a temporary copy, `npm run` cannot. Run `npm ci` |
| `password authentication failed` | Wrong database password. Reset it: **Project Settings > Database > Reset database password**, then `link` again |
| `Cannot find project ref` | The ref has a typo, or you copied the project name instead of the ref |

</details>

---

## Step 3. Load the demo content

```bash
cp apps/cms/hosted-seed.env.example apps/cms/.env.hosted
nano apps/cms/.env.hosted
```

- `cp <from> <to>`: copies the template. Git ignores `.env.hosted`, so your keys never get uploaded.
- `nano <file>`: a simple editor in the terminal. Arrow keys move, **right-click** or **Ctrl+Shift+V** pastes, **Ctrl+O** then **Enter** saves, **Ctrl+X** exits.

Fill in the four lines. No spaces around `=`, no quotes:

| Line | Value |
| --- | --- |
| `SUPABASE_URL` | Your project URL from step 1, like `https://abcdefghijklmnopqrst.supabase.co`. Replace the **whole** placeholder, `<` and `>` included |
| `SUPABASE_SERVICE_ROLE_KEY` | **Project Settings > API Keys**: the `service_role` key (Legacy tab, starts `eyJ`) or the **Secret key** (starts `sb_secret_`). Not the `anon` or publishable key |
| `SEED_ADMIN_EMAIL` | Your email. It becomes the CMS login, not your Supabase login |
| `SEED_ADMIN_PASSWORD` | A **new** password, 12 or more characters. Save it: it is how you sign in to the CMS |

```bash
npm run seed:hosted
```

- Uploads 3 parks, 22 landmarks, photos and demo podcasts, and creates your CMS login.

**Expect:**

```
Seeded Tiong Bahru: 6 landmarks
Seeded Civic District: 8 landmarks
Seeded Telok Ayer and Tanjong Pagar: 8 landmarks
```

<details>
<summary>Errors in this step</summary>

| You see | Fix |
| --- | --- |
| `ZodError` ... `SUPABASE_URL` ... `Invalid URL` | The placeholder is still there, or there is a space or quote. The line must be exactly `SUPABASE_URL=https://<ref>.supabase.co` |
| `ZodError` ... `SEED_ADMIN_PASSWORD` ... `>=12 characters` | Make the password longer |
| `ZodError` ... `SUPABASE_SERVICE_ROLE_KEY` | Key missing or cut off when pasting. Paste the whole key again |
| `code: Exec format error` when opening VS Code | WSL cannot start Windows programs right now. Use `nano` as above, or see the [Windows guide](windows-wsl.md) troubleshooting |
| `new row violates row-level security` | You used the `anon` key. Use the `service_role` / secret key |

To check the file without showing your key: `grep -v SERVICE_ROLE apps/cms/.env.hosted` (`grep -v` prints every line except those containing the given text).

</details>

<details>
<summary>Keep the service role key private</summary>

It gives full access to the database, skipping every security rule. It lives only in `apps/cms/.env.hosted` on your computer and in Vercel's settings. Never commit it, paste it in chat, or put it in the app.

</details>

---

## Step 4. Put the CMS and API online

1. On vercel.com: **Add New > Project**.
2. If `singalore` is not in the list: click **Adjust GitHub App Permissions**, choose **Only select repositories**, pick your repo, **Save**. (The "paste a URL and Deploy" box only works for public repos.)
3. Click **Import** on the repo.
4. **Root Directory:** click **Edit**, choose `apps/cms`.
5. **Build and Output Settings:** switch on **Override** for these two:

   | Setting | Value |
   | --- | --- |
   | Install Command | `cd ../.. && npm ci` |
   | Build Command | `cd ../.. && npm run build:cms` |

6. **Environment Variables:** add each of these. Leave anything not listed **out** entirely (do not add it with an empty value).

   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | Same as in `.env.hosted` |
   | `SUPABASE_ANON_KEY` | **Project Settings > API Keys**: `anon` `public` (starts `eyJ`) or the **Publishable key** (starts `sb_publishable_`) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Same as in `.env.hosted` |
   | `RATE_LIMIT_SALT` | The output of `openssl rand -hex 24` (prints 48 random characters) |

7. **Deploy.** Wait for **Ready**.
8. **Settings > Deployment Protection:** set **Vercel Authentication** to **Disabled**, **Save**.
9. **Settings > Build and Deployment > Node.js Version:** `24.x`.
10. Open `https://<your-site>.vercel.app/api/v1/health` in a **private / incognito** window.

**Expect:** `{"status":"ok", ...}`. Copy your site address (without `/api/v1/health`); you need it in step 5.

<details>
<summary>Why each setting</summary>

- **Root Directory + overrides:** the CMS uses shared code in `packages/`, outside `apps/cms`. Installing from the top folder brings that code in; the default install only fetched about 500 of the project's 1,700 packages.
- **No empty variables:** an empty value counts as "set to nothing" and older code rejected it. Leaving a variable out lets the default apply (photos and audio come from Supabase storage).
- **Deployment Protection off:** otherwise Vercel shows a login page to everyone not signed in to your Vercel account, including the app, which then gets `401` errors. The CMS editing pages still need the content manager login from step 3.
- **Private window check:** your normal browser is signed in to Vercel, so it gets through even when protection is on.

</details>

<details>
<summary>Errors in this step</summary>

| You see | Fix |
| --- | --- |
| `Could not access the repository` | The repo is private and Vercel has no access: point 2 |
| Build log ends with `Command "npm run build" exited with 1` | Scroll up to `ZodError`. The `"path"` line names the variable, `"message"` says what is wrong (`received undefined` = missing, `Invalid URL`, `Too small`) |
| The failed log shows an old time | Vercel does not rebuild when settings change. **Deployments > ... > Redeploy** |
| Variables are marked **Sensitive** and you cannot see them | Normal. To fix a typo, **Edit** and paste the value again |
| Health check shows **Log in to Vercel** | Deployment Protection is still on: point 8 |
| `404` or `DEPLOYMENT_NOT_FOUND` | Wrong address, or the latest deploy failed. **Deployments** shows which |

</details>

---

## Step 5. Save the API address

```bash
nano apps/mobile/config/hostedProject.ts
```

Change the `apiBaseUrl` line to your site address **in single quotes**, ending with a comma:

```ts
  apiBaseUrl: 'https://<your-site>.vercel.app',
```

Save (**Ctrl+O**, **Enter**) and exit (**Ctrl+X**). Then check it:

```bash
cd apps/mobile
npx expo config --type public
cd ../..
```

- `npx expo config`: loads the app's settings and prints them. If anything in the settings is wrong, it shows the exact error.
- `--type public`: show only the settings the app itself uses.

**Expect:** a long block of settings containing `"apiBaseUrl": "https://<your-site>.vercel.app"`, and no `Error`.

<details>
<summary>Errors in this step</summary>

| You see | Fix |
| --- | --- |
| `SyntaxError ... Expected ',', got ':'` | Missing quotes. It must be `'https://...'`, not `https://...` |
| `EXPO_PUBLIC_API_BASE_URL is required` | `apiBaseUrl` is still `null` |
| A ZodError about `apiBaseUrl` | It must start with `https://` |

A trailing `/` is fine but not needed.

</details>

<details>
<summary>Why this file and not a .env file</summary>

These two values (the API address and, next step, the Expo project ID) are public, not secrets. Committing them means every teammate gets them with `git pull` and nobody writes a `.env` file. A local `apps/mobile/.env` still overrides them, for example to point the app at a backend on your own machine.

</details>

---

## Step 6. Link the app to Expo

```bash
cd apps/mobile
npx eas login
npx eas init
```

- `npx eas login`: signs in to Expo. It opens a browser login, or asks for email and password.
- `npx eas init`: creates the project on expo.dev.

Answers to its questions:

| It asks | Answer |
| --- | --- |
| Which account should own this project? | Your personal account |
| Would you like to create a project for @you/singalore? | **Yes** |

**Expect** it to end with a warning, then `Error: project:init command failed`. **This is normal.** The warning contains your project ID:

```
"projectId": "12345678-abcd-..."
```

Copy that ID. Do **not** edit `app.config.ts` as the warning suggests. Instead:

```bash
nano config/hostedProject.ts
```

Set `easProjectId` the same way, in quotes:

```ts
  easProjectId: '<the project id>',
```

Check, then save it to git:

```bash
npx eas project:info
cd ../..
git add apps/mobile/config/hostedProject.ts
git commit -m "Link the hosted backend and Expo project"
git push
```

- `npx eas project:info`: shows which Expo project this folder is linked to.
- `git add` / `git commit -m` / `git push`: save the file with a message and upload it, so every teammate gets both values.

**Expect:** `project:info` prints `@<you>/singalore` and the same ID.

<details>
<summary>Messages you can ignore here</summary>

- **`eas-cli@... is now available. To upgrade, run npm install -g eas-cli`**: ignore. The project pins its own version; do not install a global one.
- **`Found eas-cli in your monorepo dependencies`**: informational.
- **`Cannot automatically write to dynamic config`**: expected. The project reads the ID from `hostedProject.ts`.

</details>

<details>
<summary>Errors in this step</summary>

| You see | Fix |
| --- | --- |
| `expo/bin/cli config --json exited with non-zero code: 1` | Step 5 is not done, or has a typo. Run `npx expo config --type public` to see the real error |
| `You are not logged in` | Run `npx eas login` |

</details>

---

## Step 7. Build the apps

Two apps, both built in Expo's cloud:

| App | For | Needs Metro running? | Gets over-the-air updates? |
| --- | --- | --- | --- |
| **Singalore Dev** | Daily development, everyone | Yes | No (it loads code live) |
| **Singalore Preview** | Demos and testing updates | No | Yes |

```bash
npm run app:build:dev
```

Answers to its questions:

| It asks | Answer |
| --- | --- |
| Generate a new Android Keystore? | **Yes** (Expo stores it for you) |
| Install and run the Android build on an emulator? | **No** on Windows (Ubuntu cannot reach the Windows emulator). Yes is fine on a Mac with the emulator open |

**Expect:** about 10 to 30 minutes, sometimes 90+ at busy times (free builds use the slowest queue). It ends with `Build finished` and a link.

Get the `.apk` file:

```bash
cd apps/mobile
npx eas build:view <build-id>
cd ../..
```

- `build:view <build-id>`: shows one build's details. The build ID is the last part of the link it printed.

Copy the **Application Archive URL** (ends in `.apk`), open it in your browser, and the file downloads. In the Ubuntu terminal, copy with mouse selection and **Ctrl+Shift+C**.

Then the demo app, the same way:

```bash
npm run app:build:demo
```

**Share both `.apk` files** with the team (group chat or a shared drive). Teammates do not need Expo accounts.

<details>
<summary>Why not just the link on expo.dev</summary>

On a computer, the build page's **Install** button shows a QR code for phones, and the page may ask teammates to sign in to your Expo account. A plain `.apk` file avoids both.

</details>

<details>
<summary>Errors in this step</summary>

| You see | Fix |
| --- | --- |
| `Build failed` ... `Install dependencies` phase | Open **See logs**, the red phase, the last lines. If it mentions the lockfile or `npm ci`, check `eas.json` still sets `"node": "24.22.0"` in each profile |
| `adb executable doesn't seem to work` | The build **worked**; only the optional auto-install failed. Answer **No** to that question next time and install the `.apk` by hand |
| Build waits a long time in queue | Normal on the free plan. Never leave a build until the day of a demo |
| `versionCode will be initialized` / `Created update channel` | Informational, first build only |

</details>

---

## Step 8. Turn on automatic deploys

In your GitHub repo: **Settings > Secrets and variables > Actions**.

**Secrets** tab, **New repository secret** for each:

| Name | Where to get it |
| --- | --- |
| `EXPO_TOKEN` | expo.dev > Account settings > **Access tokens** > Create |
| `SUPABASE_ACCESS_TOKEN` | supabase.com > Account > **Access tokens** > Generate |
| `SUPABASE_DB_PASSWORD` | The database password from step 1 |

**Variables** tab, **New repository variable**: `SUPABASE_PROJECT_REF` = the project ref from step 1.

**Expect:** after the next merge to `main`, the **Actions** tab shows a **deploy** run whose steps all ran, and **app-build-check** reports on each pull request.

<details>
<summary>What these enable</summary>

| Secret | Turns on |
| --- | --- |
| `EXPO_TOKEN` | Publishing over-the-air updates on every merge, and the "needs a new build" check on pull requests |
| `SUPABASE_*` | Applying new database migrations on every merge |

Without them the deploy job still passes, but prints "Some deploy steps were skipped". Publish updates by hand meanwhile: `npm run app:update` (see [CONTRIBUTING.md](../../CONTRIBUTING.md) section 7).

</details>

---

## Step 9. Protect `main`

Follow the "Project owner, one time" box in [CONTRIBUTING.md](../../CONTRIBUTING.md) section 1: require a pull request, one approval and the **verify** check before merging. Also **Settings > General > Pull Requests**: keep only **Allow merge commits**.

**Expect:** the **Merge** button stays grey on a pull request until **verify** is green and someone has approved it.

<details>
<summary>Why merge commits only</summary>

On Vercel's free plan, a deploy triggered by a commit from someone outside your Vercel account can be blocked ("not part of the team"). A merge commit is made by the person who merges, which keeps deploys working while teammates author the changes.

</details>

---

## Step 10. Final check

```bash
npm run app:check
```

- Compares the app's code with the latest builds on Expo and says, per app, **OK** or **NEEDS A NEW BUILD**.

**Expect:** `OK` for both Singalore Preview and Singalore Dev.

Then install **Singalore Dev** on your emulator and run it once, following your [Windows](windows-wsl.md) or [Mac](mac.md) guide from "Install the app". You should see the map of Singapore with heritage pins.

You are done. Send the team the guide link and the two `.apk` files.

<details>
<summary>If the app opens but says "Unable to fetch nearby landmarks"</summary>

Open the app's developer tools: tap the **SINGALORE** title at the top 7 times quickly, then the **bug** icon on the map. Read the **network log**:

| Network log shows | Cause |
| --- | --- |
| `/api/v1/catalog 401` | Vercel Deployment Protection is on (step 4, point 8) |
| `/api/v1/catalog 500` | A Vercel environment variable is wrong: check the Vercel function logs |
| `network_error` | The emulator has no internet, or the address in step 5 is wrong |

If the "No heritage map yet" panel blocks the title, open developer tools from a terminal instead: see "Open developer tools without the title" in your developer guide.

</details>
