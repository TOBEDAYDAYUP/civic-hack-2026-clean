# Repository instructions

- Read CONTRIBUTING.md before editing. Keep each change limited to its assigned feature.
- Work in this clean repository. Do not merge or copy the old team-merged branch wholesale.
- Keep route files thin, feature UI under features/, and shared navigation under components/navigation/.
- Preserve the structured detail pages and their evidence/uncertainty distinctions. Do not replace them with one-sentence modals.
- No database migration or integration unless explicitly requested.
- Coordinate global CSS, package dependencies, shared types, and CityCouncilApp changes.
- Never commit secrets, node_modules, .next, or local generated notice data.
- Use the committed lockfile. Run npm run check before publishing changes.
- Do not claim branch protection is enabled without verifying GitHub settings.

## Git workflow for every AI agent (effective after this policy update)

1. Before editing, read `CONTRIBUTING.md` and `docs/GIT-WORKFLOW.md`. Inspect `git status --short --branch` and the remote. Preserve all existing user changes; never stash, discard or commit somebody else's files automatically.
2. One task gets one short-lived branch from the latest `origin/main`, e.g. `feat/map-markers`, `fix/notice-address`, or `docs/setup`. Do not create a permanent branch per person or copy the whole project to integrate changes.
3. If the working tree is clean, fetch origin, switch to main, pull with `--ff-only`, then create the task branch. If unrelated changes prevent switching, use a separate worktree or ask how to preserve them. Never reset the checkout to make it clean.
4. Never push directly to main, force-push any shared branch, delete main, or merge your own PR by default. A maintainer must explicitly authorize any exception. Authorization to implement a feature does not itself authorize bypassing PR review.
5. Keep edits within the assigned module. Coordinate edits to shared files before expanding scope. Stage specific task files, not `git add .` blindly. Review `git diff --cached` for unrelated files and secrets.
6. Use `npm ci` with the committed lockfile. For code changes, run `npm run format` and `npm run check`; report failures honestly. For documentation-only changes, check links, commands and `git diff --check`; do not claim application tests ran when they did not.
7. Push only the task branch and open a PR to main. Include the problem, resulting behavior, files/modules, checks and limitations. If you cannot open a PR, provide the branch URL and the concrete blocker; do not silently push to main instead.
8. To integrate newer main changes, fetch origin and merge `origin/main` into the task branch. Do not blindly accept either side of a conflict. Re-run relevant checks after resolving conflicts. Stop if the intended behavior cannot be determined.
9. The designated human integrator reviews and merges PRs one at a time (Squash merge preferred). After a merge, start the next task from updated main; do not keep developing on the old task branch.
10. Branch protection is a GitHub setting, separate from this file. Do not say it is enforced unless verified. Never change repository permissions or protection settings merely to make a push succeed.

User instructions take precedence. If the user explicitly requests a workflow exception, explain its effect briefly and keep the exception limited to that task.
