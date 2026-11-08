import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const BRIEFS_DIR = "briefs";
const OUT_DIR = "site";
const NAV_DAYS = 30;

const CSS = `
:root{--bg:#fbfaf7;--fg:#1b1b1a;--muted:#6b6a66;--line:#e4e1d8;--link:#1d4ed8}
@media (prefers-color-scheme:dark){:root{--bg:#161615;--fg:#ecebe7;--muted:#9a9890;--line:#2b2b29;--link:#8fb4ff}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.65 Georgia,"Times New Roman",serif}
main{max-width:700px;margin:0 auto;padding:32px 18px 80px}
h1{font:600 1.1rem system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
h2{font-size:1.25rem;margin-top:2.2em;padding-top:.8em;border-top:1px solid var(--line)}
a{color:var(--link)}
nav{font:14px system-ui,sans-serif;display:flex;flex-wrap:wrap;gap:10px 14px;margin:14px 0 28px}
nav a{color:var(--muted);text-decoration:none}
nav a[aria-current="page"]{color:var(--fg);font-weight:600}
li{margin:.5em 0}
`;

function render(markdown: string): string {
  const html = marked.parse(markdown, { async: false }) as string;
  // Brief text is model output built from third-party feeds, so never trust its HTML.
  return sanitizeHtml(html, {
    allowedSchemes: ["http", "https", "mailto"],
    allowedAttributes: { a: ["href", "name", "target", "rel"] },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
    },
  });
}

function page(date: string, body: string, dates: string[]): string {
  const nav = dates
    .slice(0, NAV_DAYS)
    .map((d, i) => {
      const href = i === 0 ? "index.html" : `${d}.html`;
      return `<a href="${href}"${d === date ? ' aria-current="page"' : ""}>${d}</a>`;
    })
    .join("");
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Daily Brief ${date}</title>
<style>${CSS}</style>
</head><body><main>
<h1>Daily Brief · ${date}</h1>
<nav>${nav}</nav>
${body}
</main></body></html>`;
}

function main() {
  const dates = fs.existsSync(BRIEFS_DIR)
    ? fs
        .readdirSync(BRIEFS_DIR)
        .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
        .map((f) => f.replace(".md", ""))
        .sort()
        .reverse()
    : [];

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  if (dates.length === 0) {
    fs.writeFileSync(
      path.join(OUT_DIR, "index.html"),
      page("no briefs yet", "<p>No briefs have been generated yet.</p>", []),
    );
    console.log("No briefs found; wrote placeholder page");
    return;
  }

  for (const [i, date] of dates.entries()) {
    const md = fs.readFileSync(path.join(BRIEFS_DIR, `${date}.md`), "utf8");
    const html = page(date, render(md), dates);
    fs.writeFileSync(path.join(OUT_DIR, `${date}.html`), html);
    if (i === 0) fs.writeFileSync(path.join(OUT_DIR, "index.html"), html);
  }
  console.log(`Built ${dates.length} page(s) in ${OUT_DIR}/ (latest: ${dates[0]})`);
}

main();
