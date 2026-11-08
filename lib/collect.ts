import Parser from "rss-parser";
import { FEEDS, WATCHLIST, edgarCompanyFeed, LOOKBACK_HOURS, type Feed } from "./sources";

export type Item = {
  source: string;
  category: string;
  title: string;
  link: string;
  published: string; // ISO
  snippet: string;
};

const parser = new Parser();

// SEC requires a descriptive User-Agent with a contact. Set SEC_USER_AGENT in your env,
// e.g. "MyBrief you@example.com". Other sites just get a generic one.
function headersFor(url: string) {
  const isSec = url.includes("sec.gov");
  return {
    "User-Agent": isSec
      ? process.env.SEC_USER_AGENT || "daily-brief-agent (set SEC_USER_AGENT)"
      : "daily-brief-agent/0.1",
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
  };
}

const clean = (s: string | undefined, max = 320) =>
  (s ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export async function readFeed(feed: Feed, cutoff: number): Promise<Item[]> {
  try {
    const res = await fetch(feed.url, {
      headers: headersFor(feed.url),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const parsed = await parser.parseString(await res.text());
    return (parsed.items ?? [])
      .map((it) => {
        const when = new Date(it.isoDate ?? it.pubDate ?? 0).getTime();
        return {
          source: feed.name,
          category: feed.category,
          title: clean(it.title, 200),
          link: it.link ?? "",
          published: when ? new Date(when).toISOString() : "",
          snippet: clean(it.contentSnippet ?? it.content ?? it.summary),
          _when: when,
        };
      })
      .filter((it) => it._when >= cutoff && it.title && it.link)
      .map(({ _when, ...rest }) => rest);
  } catch (err) {
    console.warn(`[collect] skipped ${feed.name}: ${(err as Error).message}`);
    return [];
  }
}

export async function collectAll(): Promise<Item[]> {
  const cutoff = Date.now() - LOOKBACK_HOURS * 3600_000;
  const feeds = [...FEEDS, ...WATCHLIST.map(edgarCompanyFeed)];

  // SEC asks for <=10 requests/sec; a handful in parallel is fine.
  const results = await Promise.all(feeds.map((f) => readFeed(f, cutoff)));
  const items = results.flat();

  // De-dupe by link, newest first.
  const seen = new Set<string>();
  return items
    .filter((i) => (seen.has(i.link) ? false : (seen.add(i.link), true)))
    .sort((a, b) => b.published.localeCompare(a.published));
}
