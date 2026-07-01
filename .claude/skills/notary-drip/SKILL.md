---
name: notary-drip
description: Advance and send the Integrity Closings CLT follow-up email drip sequences (Real Estate, Estate Planning, Hospital & Nursing Home). Use when the user says "run the drip", "send today's follow-ups", "advance the drip sequences", or wants to schedule automatic drip sends. Sends the next due email per enrolled contact via Resend, capped in small daily batches.
---

# Notary Drip Sender

Runs the follow-up drip engine for Integrity Closings CLT. Each contact tagged
for a sequence receives 4 emails on a Day 0 / 4 / 11 / 21 cadence. This skill
advances every enrolled contact by one step per run and sends what's due,
capped to protect sender reputation.

Engine: `scripts/drip-sequences/drip-engine.mjs` (run from the repo root
`C:\Users\FrankCoxx\Desktop\Notaryassistpro`). Email bodies come from the
`marketingTemplates` created by `scripts/drip-sequences/save-drip-templates.mjs`.
Enrollment state lives in Firestore `dripEnrollments`.

## Before running (one-time)
- Templates loaded: `node scripts/drip-sequences/save-drip-templates.mjs`
- Contacts tagged so the engine knows who belongs in each sequence (tag-only —
  nothing is auto-enrolled by customerType):
  - Real Estate → tag `real-estate` (also `realtor` / `title` / `lender`)
  - Estate Planning → tag `estate-planning` (also `estate` / `elder-law`)
  - Hospital & Nursing Home → tag `hospital` / `nursing-home` / `hospice` / `assisted-living`
- These env vars available:
  `GOOGLE_SERVICE_ACCOUNT_JSON` (Firestore access, same as the app) — always required.
  For real sends also: `RESEND_API_KEY`, `FROM_EMAIL` (a Resend-verified sender), `APP_URL`, `UNSUBSCRIBE_SECRET`.

## Steps to perform when invoked
1. **Dry-run first** to show what's due, no sending:
   ```
   node scripts/drip-sequences/drip-engine.mjs
   ```
   (add `--sequence real-estate` to scope to one sequence)
2. Report the plan to the user: how many would send, to whom, which step.
3. **Send**, capped in a small batch (default 25/run):
   ```
   node scripts/drip-sequences/drip-engine.mjs --send --cap 25 --from "Frank Coxx <frank@integrityclosingsclt.com>"
   ```
4. Report the result: sent/advanced count, any failures, remaining budget.

## Safety
- Never send without doing the dry-run and confirming the plan looks right,
  unless the user explicitly asked for a fully unattended run.
- Keep `--cap` small (≤25) unless the sending domain is well warmed up.
- The engine skips anyone marked `unsubscribed` and honors the app's unsubscribe links.

## Running automatically (scheduled)
To make this hands-off, schedule a **daily** run. Two options:
- A Claude Code **Routine** (cron) that fires this skill each morning with the
  send command above — set it up with the `/schedule` skill or `create_trigger`
  (e.g. cron `0 13 * * *` for ~9am ET daily).
- Any external cron (Task Scheduler, GitHub Action, cron-job.org) that runs the
  `--send` command on a schedule with the env vars set.

Because the engine is idempotent and cap-limited, a daily run simply sends
whatever became due since yesterday and stops at the cap.
