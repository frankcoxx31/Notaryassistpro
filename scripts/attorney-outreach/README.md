# Attorney Outreach Toolkit

AI-personalized cold outreach to Charlotte-area attorneys, built on the existing
NotaryAssistPro Firestore + email template.

## Files

| File | Purpose |
|------|---------|
| `leads.mjs` | The attorney lead list — single source of truth |
| `import-leads.mjs` | One-time import of leads into Firestore `customers` |
| `attorney-outreach-email.html` | The email layout/template |
| `save-template.mjs` | Saves the template into Firestore `marketingTemplates` (shows in the app's Send Email dropdown) |
| `personalize-outreach.mjs` | **Main script** — AI-personalizes the email per attorney and stages/sends it |
| `_drafts/` | Generated output (git-ignored): one `.html` per attorney + `index.html` + `review.csv` |

## How `personalize-outreach.mjs` works

For each attorney it:
1. Infers their practice area from firm name + title.
2. Asks **Gemini** for a tailored 2-paragraph intro + subject line.
3. Renders it into `attorney-outreach-email.html`.
4. Writes a ready-to-send `.html` (and a review sheet) to `_drafts/`.

**Safe by default — it only stages files. Nothing sends until you pass `--send`.**
Without `GEMINI_API_KEY` it still runs, using practice-area heuristics, so you can
preview the pipeline offline.

## Usage

```bash
# from the repo root
export GEMINI_API_KEY="..."                 # AI Studio key (free tier is plenty)

# stage all drafts, then review _drafts/index.html in a browser
node scripts/attorney-outreach/personalize-outreach.mjs

# send ONE test to a verified Resend domain first
node scripts/attorney-outreach/personalize-outreach.mjs --limit 1 --send \
     --from "Frank Coxx <frank@integrityclosingsclt.com>"
```

### Flags
- `--limit N` — only the first N leads (testing)
- `--send` — actually deliver via Resend (requires `RESEND_API_KEY` + `--from`)
- `--from "Name <email>"` — sender; must be a verified Resend domain
- `--out <dir>` — output folder (default `_drafts`)
- `--delay <ms>` — pause between sends (default 600)
- env `GEMINI_MODEL` — override model (default `gemini-2.5-flash`)

## Sending requirements
- `RESEND_API_KEY` in the environment (same provider the app uses).
- The `--from` address must be on a **domain verified in Resend**.
