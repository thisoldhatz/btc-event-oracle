# Deploy

The site is split in two:

- **Dashboard** (static Next.js export) lives in `public_html/btc/` on the cPanel host
  → served at **https://vadym.online/btc**. Built with `cd web && npm run build`, uploaded with
  `deploy/sftp_upload.py web/out public_html/btc`.
- **Engine** runs hourly on **GitHub Actions** (`.github/workflows/hourly.yml`) and SFTP-pushes the
  three JSON snapshots into `public_html/btc/data/`, which the dashboard fetches.

## One-time GitHub setup

1. Create a GitHub repo and push this code to it (`main` branch).
2. Add these **repository secrets** (Settings → Secrets and variables → Actions):

   | Secret | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | your Anthropic API key (used only server-side, never shipped to browsers) |
   | `SFTP_HOST` | `premium115.web-hosting.com` |
   | `SFTP_PORT` | `21098` |
   | `SFTP_USER` | `vadyfnoc` |
   | `SFTP_PASS` | the cPanel/SSH password |

3. Run the workflow once manually: **Actions → hourly-forecast → Run workflow**. After it succeeds,
   it runs every hour on its own.

## How state persists

GitHub runners are ephemeral, so the forecast-history SQLite db is kept on a dedicated **`state`**
orphan branch (single force-pushed commit each run — no history bloat, keeps `main` clean). The
workflow restores it before each run and saves it after, so the accuracy scorecard accumulates
across runs.

## Notes

- Secrets live only in GitHub Actions secrets and the host — never committed. The deploy scripts read
  all credentials from environment variables.
- GitHub scheduled crons are best-effort (may drift a few minutes); fine for an hourly cadence.
- Rotate the cPanel password after launch (it was shared in chat); then update the `SFTP_PASS` secret.
