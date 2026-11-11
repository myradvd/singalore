## What and why

<!-- One or two sentences: what this changes and why. -->

Closes #

## Kind of change

- [ ] App code (`apps/mobile`, `packages/shared`)
- [ ] CMS or API (`apps/cms`)
- [ ] Database migration (`supabase/migrations/`)
- [ ] App config, permissions or a native package (needs a new app build)
- [ ] Documents or diagrams only

## Maintenance type

<!-- Tick one and add the matching label (docs/setup/github-project-board.md section 4). -->

- [ ] `corrective`: fixes a fault
- [ ] `adaptive`: adapts to a changed environment (a platform, package or service change)
- [ ] `perfective`: adds or improves functionality, or refactors

## How I tested it

<!-- What you ran or tried, for example: npm test, opened the screen in Singalore Dev, set a location near a landmark. -->

## Checklist

- [ ] The **verify** check is green
- [ ] I added or updated tests for any logic I changed
- [ ] No secrets, `.env` files or keys in the diff
- [ ] No package upgrades, unless that is the point of this PR (CONTRIBUTING.md R6)
- [ ] A design change has a row in `docs/DECISION_LOG.md`
- [ ] If **app-build-check** says a new build is needed, I said so above
- [ ] Co-authors (a teammate who paired with me, or AI help) are credited with `Co-authored-by:` lines in the commits
