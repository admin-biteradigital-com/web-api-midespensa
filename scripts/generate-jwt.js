const crypto = require("crypto");

async function signJwt(email, secretStr) {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    email: await hashEmail(email),
    userId: "CI_SYSTEM",
    hogarId: null,
    exp: Math.floor(Date.now() / 1000) + 600, // 10 minutes validation
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

  // HMAC SHA-256
  const hmac = crypto.createHmac("sha256", secretStr);
  hmac.update(tokenInput);
  const signatureB64 = hmac
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${tokenInput}.${signatureB64}`;
}

async function hashEmail(email) {
  const hash = crypto.createHash("sha256");
  hash.update(email.toLowerCase().trim());
  return hash.digest("hex");
}

if (require.main === module) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("Error: JWT_SECRET environment variable is required");
    process.exit(1);
  }
  signJwt("admin@biteradigital.com", secret)
    .then(console.log)
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
