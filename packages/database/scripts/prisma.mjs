import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
process.loadEnvFile(path.resolve(currentDir, "../../../.env"));

const [command, ...args] = process.argv.slice(2);
const result = spawnSync(command, args, {
  cwd: path.resolve(currentDir, ".."),
  env: process.env,
  stdio: "inherit",
  shell: process.platform === "win32"
});

process.exit(result.status ?? 1);
