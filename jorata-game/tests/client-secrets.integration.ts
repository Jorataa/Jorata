import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const names = ["GEMINI_API_KEY", "JORATA_AI_BACKEND_SECRET", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const sentinels = Object.fromEntries(names.map(name => [name, `jorata_secret_test_${randomBytes(24).toString("hex")}`]));
// Build with synthetic values so this check never needs a working provider key.
const { stdout, stderr } = await promisify(execFile)("npm", ["run", "build"], {
  cwd: root,
  env: { ...process.env, ...sentinels },
  maxBuffer: 2_000_000,
});
for (const name of names) {
  assert(!stdout.includes(sentinels[name]) && !stderr.includes(sentinels[name]), `${name} appeared in build logs`);
}
const files = await readdir(new URL("../dist/", import.meta.url), { recursive: true, withFileTypes: true });
for (const entry of files.filter(entry => entry.isFile())) {
  const content = await readFile(`${entry.parentPath}/${entry.name}`);
  for (const name of names) {
    for (const value of [sentinels[name], process.env[name]].filter((v): v is string => !!v))
      assert(!content.includes(Buffer.from(value)), `${name} appeared in a client artifact`);
  }
}
console.log("PASS: production client artifacts and build logs exclude server-only secret sentinels.");
