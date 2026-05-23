/** @deprecated Use `node script.js --once` */
import { spawnSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
spawnSync("node", ["script.js", "--once"], { stdio: "inherit", cwd: root });
