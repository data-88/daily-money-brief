import Anthropic from "@anthropic-ai/sdk";
import { FOCUS } from "./sources";
import type { Item } from "./collect";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MAX_ITEMS = 150;

const SYSTEM = `You are a research analyst writing a private daily brief for one reader.

Their focus: ${FOCUS}

Principles:
- Primary sources beat commentary. Filings, announcements and original reporting matter more than takes about them.
- Signal over volume. Skip anything that is routine, promotional or not decision-relevant. It is fine to leave sections short.
- Be specific: what happened, why it matters, what it implies. No filler, no hype.
- Only use links that appear in the provided items (or that you found with web search). Never invent URLs, numbers or quotes.
- If an item's snippet is too thin to judge, say "worth opening" rather than guessing at its content.
- Do not reproduce long passages from articles. Summarize in your own words.

Output Markdown with exactly these sections:

## The 5 signals
The five most decision-relevant things today, each 1–2 sentences, with a [source](link).

## Filings worth opening
SEC filings or other primary documents worth reading in full, and what specifically to look for in each. Say so if there are none worth flagging.

## Commentary worth your time
The 2–4 best pieces of analysis, with one line on the argument and one on whether it's worth the full read.

## Deals and money movement
Funding, M&A, notable capital flows. Skip if nothing material.

## Questions to chase
Three questions today's material raises that a sharp operator or investor would dig into next.`;

export async function writeBrief(items: Item[]): Promise<string> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY

  const payload = items.slice(0, MAX_ITEMS).map((i, n) => ({
    n: n + 1,
    source: i.source,
    category: i.category,
    published: i.published,
    title: i.title,
    link: i.link,
    snippet: i.snippet,
  }));

  const useSearch = process.env.ENABLE_WEB_SEARCH === "1";

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    // Optional: let Claude run a few web searches to chase leads from the feeds.
    ...(useSearch
      ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }] as any }
      : {}),
    messages: [
      {
        role: "user",
        content:
          `Today is ${new Date().toISOString().slice(0, 10)}. ` +
          `Here are ${payload.length} items collected from my sources in the last day, as JSON. ` +
          `Write today's brief.\n\n${JSON.stringify(payload)}`,
      },
    ],
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
