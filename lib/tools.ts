// The agent's one hands-on tool: read a web page as plain text.

const CHUNK_CHARS = 12_000;
const MAX_BYTES = 5_000_000;
const MAX_LINKS = 25;

const SEC_HOSTS = ["www.sec.gov", "sec.gov", "data.sec.gov"];

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

// The agent may only read pages from hosts that appeared in today's feeds, plus the SEC.
// This keeps a prompt-injected page from steering it to arbitrary sites.
export function allowedHostsFor(links: string[]): Set<string> {
  const hosts = new Set<string>(SEC_HOSTS);
  for (const l of links) {
    const h = hostOf(l);
    if (h) hosts.add(h);
  }
  return hosts;
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/tr|\/li|\/h[1-6]|\/table)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#?\w+;/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

function extractLinks(html: string, base: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /<a\s[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < MAX_LINKS) {
    try {
      const abs = new URL(m[1], base).toString();
      if (!/^https?:/i.test(abs) || seen.has(abs)) continue;
      seen.add(abs);
      const label = htmlToText(m[2]).slice(0, 80);
      out.push(`- ${label || "(no text)"}: ${abs}`);
    } catch {
      /* ignore bad hrefs */
    }
  }
  return out;
}

export async function fetchPage(
  rawUrl: string,
  offset: number,
  allowedHosts: Set<string>,
): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }
  const local = url.hostname === "127.0.0.1" && process.env.ALLOW_LOCAL_FETCH === "1"; // tests only
  if (!local && url.protocol !== "https:") throw new Error("Only https:// URLs can be fetched");
  if (!allowedHosts.has(url.hostname.toLowerCase())) {
    throw new Error(
      `Host ${url.hostname} is not allowed. You can only read hosts that appear in today's items, plus sec.gov.`,
    );
  }

  const isSec = url.hostname.endsWith("sec.gov");
  const res = await fetch(url, {
    headers: {
      "User-Agent": isSec
        ? process.env.SEC_USER_AGENT || "daily-brief-agent (set SEC_USER_AGENT)"
        : "daily-brief-agent/0.2",
      Accept: "text/html,application/xhtml+xml,text/plain,*/*",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url.hostname}`);

  const finalHost = hostOf(res.url);
  if (!local && !allowedHosts.has(finalHost)) {
    throw new Error(`Redirected to a host that is not allowed (${finalHost})`);
  }

  const buf = await res.arrayBuffer();
  const raw = new TextDecoder().decode(buf.slice(0, MAX_BYTES));
  const isHtml = /html/i.test(res.headers.get("content-type") ?? "") || /<html|<body/i.test(raw.slice(0, 2000));
  const text = isHtml ? htmlToText(raw) : raw;

  const start = Math.max(0, offset);
  const chunk = text.slice(start, start + CHUNK_CHARS);
  const end = start + chunk.length;

  let out = `URL: ${res.url}\nCharacters ${start}-${end} of ${text.length}`;
  if (end < text.length) out += ` (more available: call again with offset=${end})`;
  out += `\n\n${chunk}`;

  if (start === 0 && isHtml) {
    const links = extractLinks(raw, res.url);
    if (links.length) out += `\n\n--- Links on this page ---\n${links.join("\n")}`;
  }
  return out;
}
