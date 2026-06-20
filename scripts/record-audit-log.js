const crypto = require("crypto");
const http = require("http");
const https = require("https");

async function hashEmail(email) {
  const hash = crypto.createHash("sha256");
  hash.update(email.toLowerCase().trim());
  return hash.digest("hex");
}

async function signJwt(email, secretStr) {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    email: await hashEmail(email),
    userId: "CI_SYSTEM",
    hogarId: null,
    exp: Math.floor(Date.now() / 1000) + 600, // 10 minutes
  };

  const base64UrlEncode = (obj) => {
    return Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  };

  const headerB64 = base64UrlEncode(header);
  const payloadB64 = base64UrlEncode(payload);
  const tokenInput = `${headerB64}.${payloadB64}`;

  const hmac = crypto.createHmac("sha256", secretStr);
  hmac.update(tokenInput);
  const signatureB64 = hmac
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${tokenInput}.${signatureB64}`;
}

async function run() {
  const args = process.argv.slice(2);
  const action = args[0];
  const detailsStr = args[1] || "{}";
  const hogarId = args[2] || null;

  if (!action) {
    console.error("Usage: node record-audit-log.js <action> [detailsJson] [hogarId]");
    process.exit(1);
  }

  let details = {};
  try {
    details = JSON.parse(detailsStr);
  } catch (err) {
    console.error("Invalid details JSON string:", err.message);
    process.exit(1);
  }

  const jwtSecret = process.env.JWT_SECRET;
  const workerUrl = process.env.WORKER_URL;

  if (!jwtSecret || !workerUrl) {
    console.warn("WARNING: JWT_SECRET or WORKER_URL environment variable is missing. Skipping audit log recording.");
    process.exit(0);
  }

  console.log(`Generating JWT for admin@biteradigital.com...`);
  const token = await signJwt("admin@biteradigital.com", jwtSecret);

  const parsedUrl = new URL(workerUrl);
  const path = "/api/v1/admin/audit-log";
  const fullUrl = new URL(path, parsedUrl.origin);

  console.log(`Sending POST request to: ${fullUrl.href}...`);

  const payload = JSON.stringify({
    actorId: "CI_SYSTEM",
    action,
    details,
    hogarId,
  });

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Length": Buffer.byteLength(payload),
    },
  };

  const client = fullUrl.protocol === "https:" ? https : http;

  const req = client.request(fullUrl.href, options, (res) => {
    let data = "";
    res.on("data", (chunk) => {
      data += chunk;
    });

    res.on("end", () => {
      console.log(`Response Status: ${res.statusCode}`);
      console.log(`Response Body: ${data}`);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log("Audit log recorded successfully!");
        process.exit(0);
      } else {
        console.error("Error recording audit log!");
        process.exit(1);
      }
    });
  });

  req.on("error", (err) => {
    console.error("Request failed:", err.message);
    process.exit(1);
  });

  req.write(payload);
  req.end();
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
