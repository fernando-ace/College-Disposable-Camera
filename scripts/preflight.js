const { spawnSync } = require("child_process");

const commands = [
  ["Shared tests", "npm", ["run", "test:shared"]],
  ["Shared typecheck", "npm", ["run", "check:shared"]],
  ["API client typecheck", "npm", ["run", "check:api-client"]],
  ["Web build/check", "npm", ["run", "check:web"]],
  ["API build/check", "npm", ["run", "check:api"]],
  ["Mobile typecheck", "npm", ["run", "check:mobile"]],
  ["Mobile lint", "npm", ["run", "lint:mobile"]],
  ["Prisma migrate status", "npm", ["exec", "-w", "server", "--", "prisma", "migrate", "status", "--schema", "prisma/schema.prisma"]],
];

if (process.env.RUN_BROWSER_SMOKE === "1") {
  commands.push(["Browser smoke", "npm", ["run", "smoke:browser"]]);
}

for (const [label, command, args] of commands) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    console.error(`\nPreflight failed at: ${label}`);
    process.exit(result.status || 1);
  }
}

if (process.env.RUN_BROWSER_SMOKE !== "1") {
  console.log("\nBrowser smoke skipped. Set RUN_BROWSER_SMOKE=1 when local web and API servers are running.");
}

console.log("\nEventFilm preflight passed.");
