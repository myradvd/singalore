# Developer Setup: Mac

Run Singalore on a Mac: the code tools in **Terminal**, the Android emulator from Android Studio. Do this once; afterwards each day is `npm run dev`.

**Time:** about 30 minutes, mostly downloads.
**You need from the host:** the repo address, GitHub access to it, and the **Singalore Dev** `.apk` file.
**You do not need:** Supabase, Vercel or Expo accounts, Docker or Java.

| Step | What | Done when |
| --- | --- | --- |
| [1](#step-1-install-apples-developer-tools) | Install Apple's developer tools | `git --version` prints a version |
| [2](#step-2-install-nodejs) | Install Node.js | `node -v` prints `v24...` |
| [3](#step-3-get-the-code) | Get the code | `npm ci` ends with `added ... packages` |
| [4](#step-4-create-the-emulator) | Create the emulator | Android home screen in the emulator |
| [5](#step-5-install-the-app) | Install the app | **Singalore Dev** in the emulator's app list |
| [6](#step-6-first-run) | First run | The map of Singapore with heritage pins |

> **How to read commands:** open **Terminal** (Spotlight: **Cmd+Space**, type Terminal), type each command and press Enter. `<angle brackets>` are placeholders: replace the whole thing, brackets included.

---

## Step 1. Install Apple's developer tools

```bash
xcode-select --install
```

- `xcode-select --install`: installs Apple's command line tools: `git`, compilers and other basics. A window opens; click **Install**.

**Expect:** the install window, about 5 minutes. If it says `already installed`, that is fine.

---

## Step 2. Install Node.js

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

- `curl -o-`: download and print it.
- `|`: pass that output to the next command.
- `bash`: run it. This installs **nvm**, which installs and switches Node versions.

**Close Terminal and open it again**, then:

```bash
nvm install 24
node -v
```

- `nvm install 24`: install Node.js 24 (comes with `npm`).
- `node -v`: print the version.

**Expect:** `v24.` followed by numbers.

<details>
<summary>`nvm: command not found`</summary>

Terminal was not reopened, or your shell profile was not updated. Quit Terminal fully (**Cmd+Q**), reopen it, retry. If it still fails, run `touch ~/.zshrc` (creates your shell settings file if missing), run the nvm install command again, and reopen Terminal.

</details>

<details>
<summary>Already use Homebrew?</summary>

`brew install node@24` works too. Check `node -v` shows `v24`; if not, run `brew link --overwrite node@24`. Use one method, not both.

</details>

---

## Step 3. Get the code

```bash
cd ~
git clone <repo-address>
cd <repo-folder>
npm ci
```

- `cd ~`: go to your home folder.
- `git clone <repo-address>`: download the repo into a new folder.
- `cd <repo-folder>`: go into it (the folder has the repo's name).
- `npm ci`: install exactly the package versions the project lists. Takes a few minutes.

**Expect:** `added ... packages`. Warnings above it are normal (see below).

<details>
<summary>Messages you can ignore in npm ci</summary>

- `npm warn deprecated ...`: an old library inside a tool. Harmless.
- `... vulnerabilities ... run npm audit fix --force`: **do not run that.** `--force` jumps packages to new major versions and breaks the app.
- `install-scripts not yet covered by allowScripts`: newer npm skips some setup scripts until approved. None are needed for development.

</details>

<details>
<summary>Use npm ci, not npm install</summary>

`npm ci` installs exactly what `package-lock.json` lists and never changes that file. `npm install` may rewrite it, which later blocks `git checkout` with `Your local changes ... would be overwritten`. If that happens: `git restore package-lock.json`, then `npm ci`.

</details>

<details>
<summary>Avoid iCloud-synced folders</summary>

Do not put the project in **Desktop** or **Documents** if iCloud Drive syncs them: syncing thousands of package files is slow and can corrupt `node_modules`. Your home folder (`~`) is safe.

</details>

---

## Step 4. Create the emulator

1. Download [Android Studio](https://developer.android.com/studio) for **Mac** (Apple chip or Intel, matching your Mac: Apple menu > **About This Mac**). Install it with the **Standard** setup.
2. Welcome screen: **More Actions > Virtual Device Manager** (or **Device Manager** in an open project).
3. **+ > Create Virtual Device**, pick **Pixel 8**, choose a **Google Play** image for **API 35** or **36**, **Finish**.
4. Press **play** next to it.

**Expect:** an Android phone screen, after a minute or two on first boot.

Unlike Windows, no networking step is needed: the emulator and Metro run on the same machine.

<details>
<summary>Make `adb` available in Terminal (recommended)</summary>

With `adb` on your path, pressing `a` in Metro opens the app on the emulator by itself. Add Android's tools to your shell once:

```bash
echo 'export ANDROID_HOME="$HOME/Library/Android/sdk"' >> ~/.zshrc
echo 'export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"' >> ~/.zshrc
```

- `echo '...' >> ~/.zshrc`: adds that line to the end of your shell settings file, read every time Terminal opens.
- `ANDROID_HOME`: where Android Studio keeps its tools.
- `PATH`: the folders Terminal searches for commands; this adds `adb` and `emulator`.

Reopen Terminal, then `adb devices` should list `emulator-5554` while the emulator runs.

</details>

---

## Step 5. Install the app

1. Make sure the emulator is running.
2. **Drag the Singalore Dev `.apk` file onto the emulator window.**
3. Swipe up on the emulator's home screen to see all apps.

**Expect:** **Singalore Dev** in the app list after a few seconds.

<details>
<summary>"App not installed" or INSTALL_FAILED_UPDATE_INCOMPATIBLE</summary>

An older Singalore Dev from a previous setup is installed, signed with a different key. Long-press it, **Uninstall**, then drag the `.apk` on again.

</details>

<details>
<summary>Want one-click installs? (optional)</summary>

[Expo Orbit](https://docs.expo.dev/build/orbit) is a small menu-bar app that installs builds onto the emulator from expo.dev links. On a Mac: `brew install expo-orbit`, or download the `.dmg` from its releases page.

</details>

---

## Step 6. First run

In Terminal, in your project folder:

```bash
npm run dev
```

- Checks your setup, then starts **Metro**, the program that sends your code to the app. Leave this window open while you work.

**Expect:** `ok` lines for Node, the project location and the API, then a QR code and `Logs for your project will appear below`.

Press `a` in that window (if you set up `adb` in step 4), or open **Singalore Dev** in the emulator, type `http://10.0.2.2:8081` and tap **Connect**. (`10.0.2.2` is how the emulator reaches your Mac; `8081` is Metro.)

**Expect:** a progress bar. The **first** load takes 1 to 3 minutes; Terminal shows `Android Bundling ...%`. Then the map of Singapore with heritage pins. Allow location when asked.

<details>
<summary>Errors in this step</summary>

| You see | Fix |
| --- | --- |
| `Bundling` stuck at the same % for over a minute | `Ctrl+C`, then `npm run dev:clear` (same as `dev` but rebuilds Metro's cache) |
| `npm run dev` says `WARN ... API did not answer` | The online backend is down. Tell the host |
| Red screen `Unable to load script` | Metro stopped. Start `npm run dev` again |
| `No API address is set` | Run `git pull`; the host's setup is not in your copy yet |
| Pressing `a` says no Android device found | `adb` is not on your path (step 4 details), or the emulator is not running |
| macOS asks to allow `node` to accept incoming connections | Click **Allow** |
| `3 packages may need updating` | Ignore. Do not run `npx expo install --fix` |

</details>

---

## Every day

1. Start the emulator: Android Studio > **Device Manager** > play (or `emulator -list-avds`, then `emulator -avd <name>` if `adb` is set up).
2. Terminal, **tab 1**:

   ```bash
   cd ~/<repo-folder>
   git pull
   npm ci
   npm run dev
   ```

   - `git pull`: get teammates' merged changes. `npm ci`: install any package changes they made.

3. Press `a`, or open **Singalore Dev** and tap the server in the list.
4. Use a **second Terminal tab** (**Cmd+T**) for git and other commands. Leave tab 1 running Metro.

Save a file and the app updates within seconds. Press `r` in tab 1 to reload by hand.

Making and shipping a change: [CONTRIBUTING.md](../../CONTRIBUTING.md).

<details>
<summary>Why the app sometimes reloads by itself</summary>

Metro reloads the app whenever project files change: when you save, but also during `git pull`, `git checkout` or `npm run app:update`. Run those before testing, not during. The demo app (**Singalore Preview**) never does this, because it does not use Metro.

</details>

---

## Testing tools inside the app

<details>
<summary>Developer mode and simulated location</summary>

1. On the map, tap the **SINGALORE** title 7 times quickly. A message says **Developer Mode Enabled**, and a **bug** icon appears on the map.
2. Tap the bug icon for **Developer tools**: simulated location, geofence rings, the API address in use, a network log and a diagnostics log.
3. Turn on **Simulate location**, go back, and **long-press** the map to move your position there. Long-press on a landmark pin to trigger its podcast prompt.

Developer mode switches off when the app restarts, by design.

</details>

<details>
<summary>Use the emulator's own location instead</summary>

Emulator side bar **... > Location**: pick a point in Singapore and click **Set location**. For movement, the **Routes** tab plays a walk between two points. Allow location **all the time** in the app for background features.

</details>

<details>
<summary>Open developer tools without the title</summary>

If the app shows "No heritage map yet" and the title cannot be tapped:

```bash
adb shell am start -a android.intent.action.VIEW -d "singalore://debug"
```

- `adb shell am start`: ask the emulator to open something.
- `-a android.intent.action.VIEW -d "singalore://debug"`: open the app's own `debug` link.

The **network log** names the problem: `401` means the host's Vercel protection is on, `network_error` means no connection.

</details>

<details>
<summary>iOS Simulator (optional, untested)</summary>

Macs can also run the iOS Simulator, and the project has an iOS simulator build profile. iOS has not been tested on this project yet, so treat it as an experiment. It needs **Xcode** from the App Store and an iOS simulator build from the host (`eas build --platform ios --profile development`). Simulator builds do not need a paid Apple account.

</details>

---

## More troubleshooting

<details>
<summary>`sh: <tool>: command not found` (supabase, tsx, expo, eas)</summary>

The project's packages are not installed in this folder. Run `npm ci`.

</details>

<details>
<summary>"Your local changes would be overwritten" on git checkout or pull</summary>

Usually `package-lock.json`, changed by an `npm install`. Undo it: `git restore package-lock.json`, then `npm ci`. If it names a file you edited on purpose, commit it first (CONTRIBUTING.md).

</details>

<details>
<summary>An Expo command asks "Fix dependencies?"</summary>

Answer **n**. Upgrading packages can stop updates reaching installed apps. If you pressed yes by accident: `git restore package.json package-lock.json apps/mobile/package.json`, then `npm ci`.

</details>

<details>
<summary>The app or emulator keeps restarting</summary>

- **Only the app reloads:** Metro saw file changes (see "Every day").
- **The whole emulator reboots:** the Mac is low on memory. **Activity Monitor > Memory**; if Memory Pressure is red, close browser tabs and Android Studio's main window.
- **"Singalore keeps stopping":** a crash. Copy the red error from the Metro tab and send it to the team.

</details>
