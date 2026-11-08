# Daily Brief (GitHub Actions)

A research agent that runs every morning on GitHub's servers. It pulls free feeds and SEC filings,
then Claude picks the 3-4 most important items and **actually reads them** (filings, articles) before
writing a short brief. The brief is saved into this repo and optionally published as a web page.

```
Schedule (daily)
  -> collect feeds + EDGAR (fixed code)
  -> agent: Claude chooses what to open, reads pages with a fetch tool, writes the brief
  -> briefs/YYYY-MM-DD.md committed -> site (optional)
```

No Vercel, no database, no paid plan. Runs on GitHub's free Actions minutes.

## How the agent works

- **Fixed part:** the code always collects the same sources, so coverage never depends on the model's mood.
- **Agent part:** Claude gets one tool, `fetch_url`, and a hard budget (default 8 page reads, 12 turns, 8 minutes).
  It opens the most important items. For SEC filings it follows the index page to the main document.
- **Guardrails:** it can only read hosts that appeared in today's feeds, plus sec.gov, over https. Page text is
  treated as untrusted data. The brief ends with a list of the pages it actually read, added by the code.
- **Never lose a day:** if the agent step fails for any reason, the run falls back to the basic single-call brief
  and says so at the bottom of it.
- **Brief sections:** The 5 signals, What I read, Commentary worth your time, Deals and money movement,
  Questions to chase, Not verified.
- **Cost:** a rough estimate is around 10x the basic brief, since the model makes several calls and reads pages.
  Check your usage in the Anthropic console after the first few runs. Lower `MAX_FETCHES` or set `AGENT_MODE=off`
  to cut it.

## Setup (about 5 minutes)

1. **Put this folder in a GitHub repo.** Use the repo you already have, replacing its contents with these files,
   or create a new one.
2. **Add the secrets.** Repo -> Settings -> Secrets and variables -> Actions -> *Secrets* tab -> New repository secret:
   - `ANTHROPIC_API_KEY`: your key from console.anthropic.com (starts with `sk-ant-`)
   - `SEC_USER_AGENT`: e.g. `DailyBrief Your Name you@example.com` (the SEC requires a real contact)
3. **Allow the workflow to save briefs.** Settings -> Actions -> General -> Workflow permissions ->
   choose **Read and write permissions** -> Save.
4. **Run it once.** Actions tab -> *Daily Brief* -> **Run workflow**. When it goes green, open the
   `briefs/` folder in the repo. Your first brief is there. After that it runs by itself every day at
   12:00 UTC (6am US Central in winter, 7am in summer).

## Reading it

**Option A: read it in GitHub.** Open `briefs/` and click the newest file. GitHub renders the Markdown,
including on the GitHub mobile app. If your repo is **private**, only you can see it. This is the
simplest option and needs no extra setup.

**Option B: a web page (GitHub Pages).**
1. Settings -> Pages -> Source: **GitHub Actions**.
2. Settings -> Secrets and variables -> Actions -> *Variables* tab -> New repository variable:
   `ENABLE_PAGES` = `true`.
3. Run the workflow again. The page URL appears in the run summary and under Settings -> Pages.

Heads up: on a free GitHub account, Pages only works from **public** repos, so the page and the briefs would be
public. The page has `noindex`, but anyone with the link can read it. Your watchlist and focus text
live in repo *variables* (not in the code), but the briefs themselves reveal what you follow. If that
matters, use Option A.

## Make it yours

Add these under Settings -> Secrets and variables -> Actions -> *Variables* (all optional):

- `WATCHLIST`: comma-separated tickers, e.g. `NVDA,MSFT,TSM`. Adds each company's latest EDGAR filings.
- `BRIEF_FOCUS`: one or two sentences on what you care about. This steers the whole brief.
- `LOOKBACK_HOURS`: how far back to look (default 36).
- `ENABLE_WEB_SEARCH`: `1` also lets the agent run up to 4 web searches per run to chase leads (costs more).
- `AGENT_MODE`: set to `off` to skip the agent and use the basic single-call brief.
- `MAX_FETCHES` (default 8), `MAX_TURNS` (default 12), `AGENT_BUDGET_SECONDS` (default 480): limits on the agent.

To add or remove feeds, edit `FEEDS` in `lib/sources.ts`. Broken feeds are skipped, not fatal.
The writing instructions (sections, tone, rules) are the `SYSTEM` prompt in `lib/brief.ts`.

## Things to know

- **Paid newsletters:** RSS only exposes what the publisher makes free, often just a preview, so the brief can
  only summarize what's in the feed.
- **If the brief says "the agent stage failed today"**, open that run's log in the Actions tab and look for
  "Agent stage failed". The basic brief was saved instead, so nothing is lost.
- **If a run fails**, you'll see a red X in the Actions tab. The most common causes are a missing/wrong secret,
  or Workflow permissions still set to read-only (step 3). The log lines starting with `[collect] skipped`
  show which feeds failed.
- **GitHub pauses scheduled workflows** after 60 days with no repo activity. The daily brief commit counts as
  activity, but if runs ever stop, re-enable the workflow in the Actions tab.
- Scheduled runs can start a few minutes late when GitHub is busy.

## Run locally

```
npm install
cp .env.example .env     # fill in keys, then load them, e.g.: export $(grep -v '^#' .env | xargs)
npm run brief            # writes briefs/YYYY-MM-DD.md
npm run site             # builds site/ from everything in briefs/
```
