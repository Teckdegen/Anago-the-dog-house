/**
 * Optional build step — embeds all V4 pools into seedPools.generated.ts when THE_GRAPH_API_KEY is set.
 */
import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

for (const name of [".env.local", ".env"]) {
  const path = join(ROOT, name);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const key = process.env.THE_GRAPH_API_KEY;
if (key && key !== "your_key_here") {
  console.log("THE_GRAPH_API_KEY found — syncing pools into seed file…");
  execSync("node scripts/sync-clmm-pools.mjs", { stdio: "inherit", cwd: ROOT });
} else {
  console.warn(
    "THE_GRAPH_API_KEY not set at build time — seedPools.generated.ts may be empty.\n" +
      "  Production: set THE_GRAPH_API_KEY on Vercel (runtime /api/v4-pools) or run sync:pools before deploy.",
  );
}
