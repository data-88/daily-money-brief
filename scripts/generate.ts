import fs from "node:fs";
import path from "node:path";
import { collectAll } from "../lib/collect";
import { writeBrief } from "../lib/brief";
import { runAgent } from "../lib/agent";

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const items = await collectAll();
  console.log(`Collected ${items.length} items`);

  if (items.length === 0) {
    // Fail loudly so the Actions run shows red instead of silently skipping a day.
    throw new Error("No items collected from any source. Check the [collect] warnings above.");
  }

  let markdown = "";

  if (process.env.AGENT_MODE !== "off") {
    try {
      const result = await runAgent(items);
      console.log(`Agent finished in ${result.turns} turn(s), read ${result.fetched.length} page(s)`);
      markdown = result.markdown;
      if (result.fetched.length > 0) {
        markdown +=
          `\n\n---\n\n*Pages the agent read:*\n\n` + result.fetched.map((u) => `- ${u}`).join("\n");
      }
    } catch (err) {
      // Never lose a day: fall back to the single-call brief.
      console.error("Agent stage failed, falling back to the basic brief:", err);
    }
  }

  if (!markdown) {
    markdown = await writeBrief(items);
    if (process.env.AGENT_MODE !== "off") {
      markdown += `\n\n---\n\n*The agent stage failed today, so this is the basic brief.*`;
    }
  }

  if (!markdown) throw new Error("Claude returned an empty brief");

  const date = new Date().toISOString().slice(0, 10);
  const file = path.join("briefs", `${date}.md`);
  fs.mkdirSync("briefs", { recursive: true });
  fs.writeFileSync(file, markdown + "\n");
  console.log(`Wrote ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
