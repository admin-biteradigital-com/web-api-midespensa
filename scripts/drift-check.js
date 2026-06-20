const fs = require("fs");
const path = require("path");

function checkDrift() {
  const wranglerPath = path.join(__dirname, "../worker/wrangler.toml");
  if (!fs.existsSync(wranglerPath)) {
    console.error("Error: worker/wrangler.toml not found");
    process.exit(1);
  }

  const content = fs.readFileSync(wranglerPath, "utf8");

  // Regex to check for blocked bindings / settings
  const blockedPatterns = [
    { pattern: /durable_objects/i, name: "Durable Objects" },
    { pattern: /kv_namespaces/i, name: "KV Namespaces" },
    { pattern: /queues/i, name: "Cloudflare Queues" },
    { pattern: /r2_buckets/i, name: "R2 Buckets" },
    { pattern: /vectorize/i, name: "Vectorize" },
    { pattern: /hyperdrive/i, name: "Hyperdrive" },
  ];

  let failed = false;
  for (const item of blockedPatterns) {
    if (item.pattern.test(content)) {
      console.error(
        `DRIFT ERROR: Paid/Unsupported resource type '${item.name}' detected in wrangler.toml!`
      );
      failed = true;
    }
  }

  if (failed) {
    process.exit(1);
  } else {
    console.log(
      "wrangler.toml Drift Check: PASSED (No paid resources/Durable Objects/KV detected)"
    );
    process.exit(0);
  }
}

checkDrift();
