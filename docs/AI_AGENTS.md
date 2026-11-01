# Using the Claude Code subagents

Singalore ships six Claude Code subagents in `.claude/agents/`, plus a safety hook. This page says what each one is for and how to use them. Every command is explained word by word.

## What you get

| Agent | Use it when you want to... | Changes files? |
| --- | --- | --- |
| `course-expert` | Check a document, diagram, test plan or process against exactly what the SC2006 lectures teach, or have a concept explained | No |
| `srs-auditor` | Find every place where the app and the SRS or design docs disagree, with file and test evidence | No |
| `doc-syncer` | Rewrite the SRS and docs so they describe the app exactly, in proper SRS style | Docs only |
| `app-improver` | Get a ranked list of the best next improvements, written as ready to file GitHub issues | No |
| `safe-implementer` | Build a feature, fix a bug or refactor, without ever leaving the app broken | Code, on a branch only |
| `change-reviewer` | Get a second opinion on a branch or pull request before merging | No |

The **safety hook** (`.claude/hooks/guard-git.mjs`, switched on by `.claude/settings.json`) runs before every shell command Claude tries. It blocks: committing on `main`, pushing to `main`, force pushing, `--no-verify`, `git reset --hard` on `main`, and installing or upgrading packages. This is the "enforce it, don't just ask" idea from the Agentic Software Engineering lecture. It only limits Claude. You can still do all of these yourself.

`CLAUDE.md` at the repo root tells Claude Code about the agents and the rules, so it picks the right one on its own.

## Before you start: point the agents at the SRS

The agents compare the app with `docs/SRS.md`. That file is not in git yet. Put your latest SRS there as Markdown (or tell the agent where it is when you ask).

## Starting Claude Code in the project

```bash
cd ~/repos/SWE/singalore-m
claude
```

- `cd`: "change directory", move into a folder.
- `~/repos/SWE/singalore-m`: the folder where you cloned the project. `~` means your home folder. Use your own path if it is different.
- `claude`: start Claude Code in this folder. It reads `CLAUDE.md` and finds the agents in `.claude/agents/` by itself.

Inside Claude Code, type `/agents` and press Enter to see the six agents listed.

## Asking for an agent

Just name it in plain words. Examples:

- `Use the course-expert agent to review our use case descriptions in docs/SRS.md against the Requirements Elicitation lectures.`
- `Use the srs-auditor agent to check the whole app against docs/SRS.md and give me the traceability table.`
- `Use the doc-syncer agent to update docs/SRS.md so it matches the app, using the auditor's report above.`
- `Use the app-improver agent to suggest the next five improvements, focused on the competition judging criteria.`
- `Use the safe-implementer agent to fix this bug: the podcast prompt shows twice when I walk back into the same landmark.`
- `Use the change-reviewer agent to review the current branch before I open the PR.`

## A safe change, start to finish

1. Ask `app-improver` for ideas, or bring your own task. Create a GitHub issue for it.
2. Ask `safe-implementer` to do it. It makes a branch, proves the tests pass first, writes the test first, and commits in small green steps.
3. Ask `change-reviewer` to review the branch. Fix anything it calls blocking.
4. Ask `srs-auditor` whether the docs still match, then `doc-syncer` to update them.
5. Push the branch and open the pull request (or ask Claude to). Wait for **verify** to go green and for a teammate to review, then merge as `CONTRIBUTING.md` says.

## If the hook blocks something you really want

Read the message: it says why. If you, the human, want it anyway, run the command yourself in your own terminal. To switch the hook off completely, delete the `hooks` section from `.claude/settings.json` (through a pull request, like any other change).

## Changing an agent

Each agent is one Markdown file in `.claude/agents/`. The part between the `---` lines at the top is its name, description (how Claude decides when to use it) and allowed tools. Everything below is its instructions. Edit the text and restart Claude Code to pick up the change.
