// Everything you'd want to tweak lives here.

export type Feed = { name: string; url: string; category: string };

// Free RSS feeds. Paid newsletters usually only expose their free posts via RSS,
// which is still useful as a "what did they just publish" signal.
// If a feed 404s, the collector skips it and logs a warning, so it's safe to experiment.
export const FEEDS: Feed[] = [
  // Strategy / tech commentary
  { name: "Stratechery (free articles)", url: "https://stratechery.com/feed/", category: "commentary" },
  { name: "Not Boring", url: "https://www.notboring.co/feed", category: "commentary" },
  { name: "Newcomer", url: "https://www.newcomer.co/feed", category: "commentary" },
  { name: "Lenny's Newsletter", url: "https://www.lennysnewsletter.com/feed", category: "commentary" },
  { name: "The Pragmatic Engineer", url: "https://newsletter.pragmaticengineer.com/feed", category: "commentary" },

  // Deal flow / venture
  { name: "TechCrunch Venture", url: "https://techcrunch.com/category/venture/feed/", category: "deals" },

  // Broad signal
  { name: "Hacker News (200+ points)", url: "https://hnrss.org/frontpage?points=200", category: "signal" },

  // Primary source: the SEC's live stream of 8-K current reports
  {
    name: "SEC EDGAR: latest 8-Ks",
    url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&count=40&output=atom",
    category: "filings",
  },
];

// Tickers whose filings you want to follow closely, e.g. WATCHLIST="NVDA,MSFT,TSM"
export const WATCHLIST: string[] = (process.env.WATCHLIST ?? "")
  .split(",")
  .map((t) => t.trim().toUpperCase())
  .filter(Boolean);

export const edgarCompanyFeed = (ticker: string): Feed => ({
  name: `SEC EDGAR: ${ticker} filings`,
  url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${ticker}&type=&dateb=&owner=include&count=10&output=atom`,
  category: "watchlist",
});

// Your own focus. This steers what Claude pulls out and what it ignores.
// Note: GitHub Actions passes unset variables as empty strings, so use || (not ??) for defaults.
export const FOCUS =
  process.env.BRIEF_FOCUS?.trim() ||
  "Business strategy, venture and private markets, capital allocation, and AI/tech industry structure.";

// Read a positive number from an env var, falling back to a default when unset, empty or invalid.
export function envNumber(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// How far back to look (hours). 36 covers a daily run with some overlap.
export const LOOKBACK_HOURS = envNumber("LOOKBACK_HOURS", 36);
