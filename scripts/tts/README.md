# Podcast narration (Kokoro)

`npm run seed:audio` turns the scripts in `supabase/seed/scripts/<landmark slug>.md` into podcast episodes in `supabase/seed/audio/`. The scripts and `manifest.json` are the source and live in git. The `.m4a` files are generated, so git ignores them and `npm run seed:hosted` uploads them to Supabase Storage. Speech comes from [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M), run locally. It works on macOS and on Linux, including WSL. This folder is plain Python and is not part of the npm workspaces.

## One time setup

Install the system tools:

| | macOS | Ubuntu or WSL |
| --- | --- | --- |
| ffmpeg | `brew install ffmpeg` | `sudo apt install ffmpeg` |
| espeak-ng | `brew install espeak-ng` | `sudo apt install espeak-ng` |
| Python 3.10 to 3.12 | `brew install python@3.12` | `sudo apt install python3.12-venv` |

Kokoro does not support Python 3.13 or newer yet. Then, from the repo root:

```bash
python3.12 -m venv scripts/tts/.venv
scripts/tts/.venv/bin/pip install -r scripts/tts/requirements.txt
```

The first run downloads the Kokoro model (about 330 MB) from Hugging Face. To use a Python somewhere else, set `KOKORO_PYTHON` to its path.

## Running

```bash
npm run seed:audio
npm run seed:audio -- --only raffles-hotel,thian-hock-keng
npm run seed:audio -- --force
```

- An episode is only synthesised again when its script text, voice or `pronunciations.json` changed. `--force` ignores that cache.
- Files are named `<slug>-<suffix>-<first 8 characters of the file sha256>.m4a`, because the seed uploads them with a one year cache. Old local files are ignored by git and safe to delete.
- After generating, run `npm run seed:hosted` and commit `manifest.json`, in that order, so nobody gets a manifest that points at audio not yet uploaded.
- Landmarks with no script keep their existing manifest entries.
- The manifest is saved after each landmark, so a crash keeps the finished episodes in the cache.
- The run fails if a script breaks the rules below or an episode is shorter than 300 s, longer than 600 s or over 4.5 MB (the Vercel upload limit). That landmark keeps its old manifest entries, and the others still update. Silences over 3 s and clipping are reported as warnings.
- `npm run seed:check` also fails when a script changed but its episode was not generated again.

## Writing a script

```markdown
---
title: "Raffles Hotel: from beach house to national monument"
sources:
  - https://en.wikipedia.org/wiki/Raffles_Hotel
verify:
  - A claim a person must check before publishing
---

Spoken paragraphs, separated by a blank line.
```

- The body is only what the narrator says: 750 to 1500 words, no markdown, no brackets, no stage directions, no em or en dashes.
- Write years and numbers as digits if you like. The generator reads `1887` as "eighteen eighty seven" and `St Andrew's` as "Saint Andrew's".
- Put local names the voice gets wrong in `pronunciations.json` as an English respelling, for example `"Telok Ayer": "Teh lock Ah yer"`. The transcript keeps the real spelling.
- Voices: British male `bm_george` for every park, plus American female `af_heart` for civic-district.
