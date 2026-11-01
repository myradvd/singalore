# Singalore: instructions for Claude Code

Singalore is the SC2006 Group 4 heritage walking tour app: an Expo Android app (`apps/mobile`), a Next.js CMS and API (`apps/cms`), shared code (`packages/`) and Supabase (`supabase/`). The team rules are in `CONTRIBUTING.md` (R1 to R11) and the build spec is `docs/DESIGN_DECISIONS.md`. Follow both.

## Never leave the app broken

- Never commit to or push `main`. Work on a branch and open a pull request. `.claude/hooks/guard-git.mjs` blocks commits on `main`, pushes to `main`, force pushes, `--no-verify` and package installs.
- Prove the checks are green before changing anything, and after every step: `npm run typecheck`, `npm run lint`, `npm test -w <workspace>`. Run `npm run verify` before calling work done.
- Never skip, delete or weaken a test, a lint rule or a type to get green. If it stays red, undo the step and report.
- No package changes unless asked (R6). New migrations only, never edit an old one (R9). No secrets (R7).

## Subagents in `.claude/agents/`

Use them for these jobs. Each one's file says exactly how it works.

| Job | Agent | Edits files? |
| --- | --- | --- |
| What do the SC2006 lectures say about this? Does this doc, diagram or test plan meet the course standard? | `course-expert` | No |
| Does the app do everything the SRS and design docs say? | `srs-auditor` | No |
| Update the SRS and docs so they match the app exactly | `doc-syncer` | Docs only |
| What should we improve next? | `app-improver` | No |
| Build a feature, fix a bug, refactor | `safe-implementer` | Code, on a branch |
| Check a branch or PR before merging | `change-reviewer` | No |

Usual order for a change: `app-improver` (or the user) picks the task, `safe-implementer` builds it on a branch, `change-reviewer` reviews it, `srs-auditor` then `doc-syncer` bring the docs in line, and a human merges the PR. Pass each agent the previous agent's report so it does not start from scratch.

## Code and writing style

- Allman braces, two space indent, single quotes, semicolons (enforced by ESLint).
- No em dashes or en dashes anywhere (enforced by `scripts/check-no-emdash.mjs`).
- Module boundaries from SRS NFR 7.2 (enforced by `eslint.config.mjs`).
- Keep every existing comment unless its code is deleted. Add one short comment line above each new function saying what it does.
- The user is new to Linux and works in WSL Ubuntu. When you tell them to run a command, explain what every word of it does.
