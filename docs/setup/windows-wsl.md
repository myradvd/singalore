# Developer Setup: Windows

Run Singalore on Windows: the code tools in **Ubuntu (WSL)**, the Android emulator on **Windows**. Do this once; afterwards each day is `npm run dev`.

**Time:** about 45 minutes, mostly downloads.
**You need from the host:** the repo address, GitHub access to it, and the **Singalore Dev** `.apk` file.
**You do not need:** Supabase, Vercel or Expo accounts, Docker or Java.

| Step | What | Done when |
| --- | --- | --- |
| [1](#step-1-check-ubuntu-wsl) | Check Ubuntu (WSL) | `wsl -l -v` shows Ubuntu, version 2 |
| [2](#step-2-install-build-tools) | Install build tools | `gcc --version` prints a version |
| [3](#step-3-install-nodejs) | Install Node.js | `node -v` prints `v24...` |
| [4](#step-4-get-the-code) | Get the code | `npm ci` ends with `added ... packages` |
| [5](#step-5-create-the-emulator) | Create the emulator | Android home screen in the emulator |
| [6](#step-6-let-the-emulator-reach-ubuntu) | Let the emulator reach Ubuntu | `.wslconfig` saved, WSL restarted |
| [7](#step-7-install-the-app) | Install the app | **Singalore Dev** in the emulator's app list |
| [8](#step-8-first-run) | First run | The map of Singapore with heritage pins |

> **How to read commands:** type them in the **Ubuntu** window and press Enter, unless a step says **PowerShell**. `<angle brackets>` are placeholders: replace the whole thing, brackets included.

---

## Step 1. Check Ubuntu (WSL)

In **PowerShell** (Start menu, type PowerShell):

```powershell
wsl -l -v
```

- `wsl`: the Windows tool that manages Linux.
- `-l -v`: list installed Linux systems with their version.

**Expect:** a line with `Ubuntu` and `2` in the VERSION column.

<details>
<summary>No Ubuntu, or version 1</summary>

- **Nothing listed:** run `wsl --install` in PowerShell **as administrator** (right-click PowerShell > Run as administrator), restart the computer, then open **Ubuntu** from the Start menu and create a username and password.
- **Version 1:** run `wsl --set-version Ubuntu 2`.

Remember your Ubuntu password: `sudo` commands ask for it, and nothing shows on screen while you type it. That is normal.

</details>

---

## Step 2. Install build tools

Open **Ubuntu** from the Start menu.

```bash
sudo apt update && sudo apt install -y build-essential python3
```

- `sudo`: run as administrator (asks for your Ubuntu password).
- `apt update`: refresh Ubuntu's list of software.
- `&&`: run the next command only if the first worked.
- `apt install -y`: install, answering yes to the confirmation.
- `build-essential python3`: compilers and Python, which a few packages need while installing.

**Expect:** it ends without `E:` errors. If it says `already the newest version`, that is fine.

---

## Step 3. Install Node.js

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

- `curl -o-`: download and print it.
- `|`: pass that output to the next command.
- `bash`: run it. This installs **nvm**, which installs and switches Node versions.

**Close the Ubuntu window and open a new one**, then:

```bash
nvm install 24
node -v
```

- `nvm install 24`: install Node.js 24 (comes with `npm`).
- `node -v`: print the version.

**Expect:** `v24.` followed by numbers.

<details>
<summary>`nvm: command not found`</summary>

You did not open a new window after installing nvm. Close Ubuntu, open it again, and retry.

</details>

---

## Step 4. Get the code

```bash
cd ~
git clone <repo-address>
cd <repo-folder>
npm ci
```

- `cd ~`: go to your Linux home folder. **Keep the project here, not under `/mnt/c/...`** (your Windows drive): from WSL that is very slow, and saving a file will not reload the app.
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

Use `npm install <name>` only when you deliberately add a package (see CONTRIBUTING.md).

</details>

---

## Step 5. Create the emulator

On **Windows**, not in Ubuntu:

1. Download and install [Android Studio](https://developer.android.com/studio), **Standard** setup.
2. Welcome screen: **More Actions > Virtual Device Manager** (or **Device Manager** in an open project).
3. **+ > Create Virtual Device**, pick **Pixel 8**, choose a **Google Play** image for **API 35** or **36**, **Finish**.
4. Press **play** next to it.

**Expect:** an Android phone screen, after a minute or two on first boot.

<details>
<summary>Already have emulators from an older setup?</summary>

Their names do not matter; any emulator works, including ones named after this project. Pick the newest API version. If it still has an old **Singalore Dev** installed, step 7 shows how to replace it.

</details>

<details>
<summary>Emulator slow or will not start</summary>

- Close other heavy apps. The emulator, WSL and Android Studio together want about 8 GB of RAM.
- Android Studio > **Settings > Languages & Frameworks > Android SDK > SDK Tools**: make sure **Android Emulator** and **Android Emulator hypervisor driver** are installed.
- Once the emulator is running you can close Android Studio's main window; the emulator stays open.

</details>

---

## Step 6. Let the emulator reach Ubuntu

The emulator runs on Windows and the app's code server (Metro) in Ubuntu. By default WSL hides Ubuntu behind its own network, so the emulator cannot reach it. **Windows 11** can make them share a network:

1. Open **Notepad** and paste:

   ```
   [wsl2]
   networkingMode=mirrored
   ```

2. **File > Save As**. Go to `C:\Users\<your-windows-name>`, set **Save as type** to **All Files**, name it `.wslconfig` (dot first, no `.txt`), **Save**.
3. In **PowerShell**:

   ```powershell
   wsl --shutdown
   ```

   - `wsl --shutdown`: stops Ubuntu fully, so it restarts with the new setting.

4. Open Ubuntu again.

**Expect:** nothing visible yet. Step 8 proves it works.

<details>
<summary>Windows 10</summary>

Mirrored mode needs Windows 11. On Windows 10, skip this step. Each time you start, find Ubuntu's address:

```bash
hostname -I
```

- `hostname -I`: (capital i) prints Ubuntu's network addresses. Use the **first** one, like `172.20.74.100`.

In step 8 and every day, connect the app to `http://<that-address>:8081` instead of `http://10.0.2.2:8081`. The address changes when WSL restarts.

</details>

---

## Step 7. Install the app

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

[Expo Orbit](https://docs.expo.dev/build/orbit) is a small Windows app that installs builds onto the emulator from expo.dev links. Download the **Windows** file (`.exe` or `.zip`) from its releases page, not the `.rpm`, `.deb` or `.dmg`. If Windows says **Windows protected your PC**, click **More info > Run anyway**. Dragging the `.apk` works just as well.

</details>

---

## Step 8. First run

In Ubuntu, in your project folder:

```bash
npm run dev
```

- Checks your setup, then starts **Metro**, the program that sends your code to the app. Leave this window open while you work.

**Expect:** `ok` lines for Node, the project location and the API, then a QR code and `Logs for your project will appear below`.

In the emulator, open **Singalore Dev**. On the server screen, type `http://10.0.2.2:8081` in the box and tap **Connect**. (`10.0.2.2` is how the emulator reaches the computer it runs on; `8081` is Metro.)

**Expect:** a progress bar. The **first** load takes 1 to 3 minutes while Metro prepares the code; the Ubuntu window shows `Android Bundling ...%`. Then the map of Singapore with heritage pins. Allow location when asked.

<details>
<summary>Errors in this step</summary>

| You see | Fix |
| --- | --- |
| `Failed to connect to /10.0.2.2:8081` | Step 6 is not done, or WSL was not restarted (`wsl --shutdown`). Windows 10: use the `hostname -I` address |
| Connecting takes very long and the Ubuntu window shows no `Bundling` line | The app is not reaching Metro: same fix as above |
| `Bundling` stuck at the same % for over a minute | `Ctrl+C`, then `npm run dev:clear` (same as `dev` but rebuilds Metro's cache) |
| `npm run dev` says `WARN ... API did not answer` | The online backend is down. Tell the host |
| Red screen `Unable to load script` | Metro stopped. Start `npm run dev` again |
| `No API address is set` | Run `git pull`; the host's setup is not in your copy yet |
| Pressing `a` says no Android device found | Expected on Windows: Ubuntu cannot see the Windows emulator. Open the app in the emulator yourself |
| `3 packages may need updating` | Ignore. Do not run `npx expo install --fix` |

</details>

---

## Every day

1. Start the emulator: Android Studio > **Device Manager** > play.
2. Ubuntu, **tab 1**:

   ```bash
   cd ~/<repo-folder>
   git pull
   npm ci
   npm run dev
   ```

   - `git pull`: get teammates' merged changes. `npm ci`: install any package changes they made.

3. Open **Singalore Dev**, tap the server in the list.
4. Use a **second Ubuntu tab** (Windows Terminal: **+**, or **Ctrl+Shift+T**) for git and other commands. Leave tab 1 running Metro.

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

If the app shows "No heritage map yet" and the title cannot be tapped, open the tools from **PowerShell**:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" shell am start -a android.intent.action.VIEW -d "singalore://debug"
```

- `&`: run the program at the quoted path.
- `adb.exe`: Android's tool for controlling emulators, installed by Android Studio.
- `shell am start -a android.intent.action.VIEW -d "singalore://debug"`: ask the emulator to open the app's own `debug` link.

The **network log** names the problem: `401` means the host's Vercel protection is on, `network_error` means no connection.

</details>

---

## More troubleshooting

<details>
<summary>`code .` says Exec format error</summary>

WSL cannot start Windows programs at the moment. Quick fix: in PowerShell, `wsl --shutdown`, then reopen Ubuntu. If it keeps happening, run this once in Ubuntu:

```bash
echo ':WSLInterop:M::MZ::/init:PF' | sudo tee /usr/lib/binfmt.d/WSLInterop.conf
```

- `echo '...'`: the text is a rule that tells Linux to run Windows programs through WSL.
- `| sudo tee <file>`: writes it, as administrator, into a settings file read at every start.

Then `wsl --shutdown` again. Meanwhile, edit files with `nano <file>`.

</details>

<details>
<summary>`sh: 1: <tool>: not found` (supabase, tsx, expo, eas)</summary>

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
- **The whole emulator reboots:** Windows is low on memory. Task Manager (**Ctrl+Shift+Esc**) > **Performance > Memory**; above about 90%, close browser tabs and Android Studio's main window.
- **"Singalore keeps stopping":** a crash. Copy the red error from the Metro tab and send it to the team.

</details>
