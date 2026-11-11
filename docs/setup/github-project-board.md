# GitHub Project Board, Milestones and Releases

How the team tracks sprints on GitHub (Scrum, SC2006 lecture 9) and versions each demo build (maintenance, lecture 21). Do this once in each repository: `myradvd/singalore` and `softwarelab3/2006-TDDB-U4`. Everything is done in the browser on github.com, except the tag in section 3.

## 1. Milestones

One milestone for each build milestone in `docs/DESIGN_DECISIONS.md` section 13.

1. Open the repository on github.com and click **Issues**, then **Milestones**, then **New milestone**.
2. Create these nine, one at a time. Type the title exactly, and copy the description from the Content column of section 13:

| Title |
| --- |
| M0 Foundations and spikes |
| M1 Catalog and map shell |
| M2 Location and geofence |
| M3 Audio |
| M4 Offline |
| M5 Routes |
| M6 Shell and preferences |
| M7 CMS complete |
| M8 Hardening and delivery |

3. Close the milestones that are already done: open each one and click **Close**. Closed milestones still show their issues, so the history stays visible.
4. From now on, give every new issue and pull request a milestone (right side of the issue page, **Milestone**).

## 2. Project board with one column per milestone

1. Click your profile picture (top right), then **Your projects**, then **New project**.
2. Choose the **Board** template, name it `Singalore sprints` and click **Create project**.
3. Link it to the repository: in the project, click the three dots (top right), then **Settings**, then **Manage access**, and add the repository. Then open the repository, click **Projects**, then **Link a project**, and choose `Singalore sprints`.
4. Make the columns the milestones: click the arrow next to the view name **View 1**, choose **Column by**, then **Milestone**. The board now has one column for each milestone, plus **No milestone**.
5. Add the work: click **+ Add item** at the bottom of a column, type `#` and pick an issue or pull request. Its milestone decides its column.
6. Keep the status too: click the arrow next to the view name again, choose **Group by**, then **Status**. Each milestone column is then split into **Todo**, **In Progress** and **Done**.
7. Click **Save** next to the view name so everyone sees the same board.

At the end of each sprint, check that everything in the milestone is **Done**, close the milestone, and tag the demo build (section 3).

## 3. Tagging a demo build

A tag is a permanent name for one commit, so the build that was demonstrated can always be found again. Tag only commits on `main` that have a green **verify** check.

1. Write the version in `CHANGELOG.md` and the root `package.json` in a pull request, and merge it.
2. In the WSL Ubuntu terminal:

```bash
git switch main
git pull
git tag -a v0.2.0 -m "Demo build 0.2.0"
git push origin v0.2.0
```

- `git switch main` moves your copy to the `main` branch.
- `git pull` downloads the newest `main` from GitHub, including the merged pull request.
- `git tag` makes a tag. `-a` makes it an annotated tag, which records who made it and when. `v0.2.0` is the tag name. `-m "Demo build 0.2.0"` is the tag message.
- `git push origin v0.2.0` uploads that one tag to GitHub (`origin`). Pushing a tag does not change `main`.

3. Make it a release: on github.com click **Releases** (right side of the repository page), then **Draft a new release**. Under **Choose a tag** pick `v0.2.0`, use `Singalore 0.2.0` as the title, paste that version's section of `CHANGELOG.md` as the description, and click **Publish release**.

The first demo build was released before tags were used. To tag it, run `git tag -a v0.1.0 -m "Demo build 0.1.0" 30094be` and then `git push origin v0.1.0`. The extra `30094be` is the commit to tag, the merge of PR #23 in `myradvd/singalore`. In `softwarelab3/2006-TDDB-U4` the history is different, so tag only from `v0.2.0` on there.
