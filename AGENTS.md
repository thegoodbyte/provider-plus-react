# Multi-agent coordination protocol

This repository is worked on concurrently by multiple AI coding agents under the same account — Claude Code, Codex, and Gemini. Codex is the agent that performs production deploys. Without coordination, agents have duplicated work (the same bug fixed twice, independently, in the same session window) and tracking files have gone stale (one agent reporting work as "pending deployment" when another agent had already pushed and deployed it). This document exists to prevent that. Follow it every session, not just the first one.

## Before starting any ticket

1. **Re-fetch, don't trust a cached state.** Run `git fetch origin production` and compare against your local worktree before assuming anything about what's already shipped. A worktree created an hour ago can already be behind.
2. **Check the Jira ticket's current status and comments** — not just its description. Another agent may have already implemented, pushed, or even deployed it since you last looked. If it's already done, say so and stop; don't re-implement.
3. **Check for a claim.** Look for a `claimed-by:<agent>` label or a recent "Claiming —" comment from another agent (see below). If one exists and looks active (recent timestamp, no sign of abandonment), don't start the same ticket — ask the user, or pick something else.

## Claiming a ticket

Once you've confirmed a ticket is actually unclaimed and not already done:
- Add a comment: `Claiming — agent=<claude|codex|gemini>, branch=<branch name>, worktree=<worktree name>, started=<timestamp>`.
- Add the label `claimed-by:<agent>` (one of `claimed-by:claude`, `claimed-by:codex`, `claimed-by:gemini`).
- Remove the label once your work is pushed, deployed, or abandoned (leave a comment saying which, so the next agent doesn't have to guess).

## Git hygiene (hard rules, not suggestions)

- **Never edit a shared `production`-checked-out worktree directly.** Always create a dedicated branch and worktree off a freshly-fetched `origin/production` for each ticket.
- **Re-fetch `origin/production` immediately before pushing**, not just at the start of the session — the tip can move underneath you while you work, since other agents push concurrently.
- If you find unfamiliar uncommitted/staged changes in a worktree that isn't yours, don't assume it's stale garbage — it may be another agent's in-progress work. Investigate before touching it; when in doubt, leave it alone and ask the user.

## Deployment record ownership

Before reusing a ticket worktree for a release, read its local `DEPLOYMENT_STATUS.md` and `deployment-status.json`, plus the shared workspace `release-ledger.json` and `PUSH_MANIFEST.md`. These receipts cover listed commits only: fetch production and compare newer commits/uncommitted changes before deciding a follow-up is already deployed. The releasing agent regenerates receipts with the workspace `update-ticket-deployment-notes.py` before and after release tracking changes. Keep local receipts out of application commits.

- **Whoever actually pushes to `origin/production` and deploys is the one who writes the final record**: the "deployed and verified" Jira comment, the `RELEASE_LOG.md` entry, and the `release-ledger.json` entry, with real commit SHAs and deployment IDs.
- An agent that only implements and commits locally (doesn't push) must only ever claim "implemented, not pushed" state in Jira and in any tracking files it touches. Never write or imply "deployed" unless you personally did the push and verified it live.
- If you discover another agent already pushed/deployed something you were about to do, don't push a redundant or conflicting version. Check what actually shipped, compare against what you had, and report the difference (if any) rather than silently overwriting it.

## Jira status flow

**"Push Review" means pushed, not "ready to push."** This was conflated early on — tickets got moved to Push Review the moment they were implemented and committed locally, before anything was actually pushed. That's wrong: Push Review's own status category is "done," and it's meant to mean the fix is live and pending final review/QA, not a to-do.

The corrected flow: To Do → In Progress → **Ready for PROD** → Push Review → Do QA → Done.

- **Ready for PROD** — implemented, tested, committed locally, **not yet pushed**. This is your hand-off point after finishing a ticket: transition here, not to Push Review, and leave a comment with what changed, the commit hash/repo/worktree, and how to verify.
- **Push Review** — actually pushed to `origin/production` (and deployed, if applicable). Only the agent that did the push moves a ticket here, with the real commit SHA and deployment ID per the deployment record ownership rule above.
- A ticket sitting in Ready for PROD is exactly what Codex should look for when deciding what to push next.

## No human code review gate

The user does not do code reviews. Don't block on or request one. The gate is: implement → test thoroughly → commit → Jira "Ready for PROD" with a clear comment → wait for the user's explicit instruction to push (e.g. "push re") before deploying, unless the user has said otherwise for a specific batch of work.
