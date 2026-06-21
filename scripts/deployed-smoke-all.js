const { spawnSync } = require("child_process");

const commands = [
  ["Deployed API smoke", ["run", "smoke:deployed:api"]],
  ["Deployed browser smoke", ["run", "smoke:deployed:browser"]],
  ["Deployed storage smoke", ["run", "smoke:deployed:storage"]],
];

for (const [label, args] of commands) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync("npm", args, { stdio: "inherit", shell: true, env: process.env });
  if (result.status !== 0) {
    console.error(`\nDeployed smoke failed at: ${label}`);
    process.exit(result.status || 1);
  }
}

console.log("\nAll deployed smoke commands passed.");
