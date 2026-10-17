# Multi-agent coordination protocol (read this every session)

You (Gemini) are one of three AI coding agents working concurrently on this repository under the same account — alongside Claude Code and Codex (which performs production deploys). Without coordination, agents have duplicated work (the same bug fixed twice, independently) and tracking files have gone stale (claiming work was "pending deployment" when another agent had already pushed and deployed it). Follow the protocol below every session, not just the first one. The full version lives in `AGENTS.md` in this repo — read it too if anything here is unclear.

## Before starting any ticket

1. **Re-fetch, don't trust a cached state.** Run `git fetch origin production` and compare against your local worktree before assuming anything about what's already shipped.
2. **Check the Jira ticket's current status and comments**, not just its description. It may already be implemented, pushed, or deployed by another agent since you last looked. If so, say so and stop.
3. **Check for a claim** — a `claimed-by:<agent>` label or a recent "Claiming —" comment from another agent. If one looks active, don't start the same ticket.

## Claiming a ticket

- Comment: `Claiming — agent=gemini, branch=<branch name>, worktree=<worktree name>, started=<timestamp>`.
- Add the label `claimed-by:gemini`.
- Remove the label once your work is pushed, deployed, or abandoned, with a comment saying which.

## Git hygiene (hard rules)

- Never edit a shared `production`-checked-out worktree directly. Always a dedicated branch/worktree off a freshly-fetched `origin/production`.
- Re-fetch `origin/production` immediately before pushing, not just at session start.
- Unfamiliar uncommitted/staged changes in a worktree that isn't yours may be another agent's in-progress work — investigate before touching, ask the user if unsure.

## Deployment record ownership

Before reusing a ticket worktree for a release, read its local `DEPLOYMENT_STATUS.md` and `deployment-status.json`, plus the shared workspace `release-ledger.json` and `PUSH_MANIFEST.md`. These receipts cover listed commits only: fetch production and compare newer commits/uncommitted changes before deciding a follow-up is already deployed. The releasing agent regenerates receipts with the workspace `update-ticket-deployment-notes.py` before and after release tracking changes. Keep local receipts out of application commits.

- Whoever actually pushes and deploys writes the final Jira "deployed and verified" comment, `RELEASE_LOG.md` entry, and `release-ledger.json` entry.
- If you only implemented locally (didn't push), only ever claim "implemented, not pushed." Never imply deployment happened unless you did it and verified it live.
- If you discover another agent already shipped something you were about to do, don't push a redundant/conflicting version — compare and report the difference instead.

## Jira status flow

**"Push Review" means pushed, not "ready to push."** The corrected flow: To Do → In Progress → **Ready for PROD** (implemented, tested, committed, not yet pushed — your hand-off point) → Push Review (actually pushed/deployed — only the pushing agent moves it here) → Do QA → Done. Codex looks at Ready for PROD to decide what to push next.

## No human code review gate

The user does not do code reviews. The gate is: implement → test → commit → Jira "Ready for PROD" with a clear comment → wait for the user's explicit push instruction.
