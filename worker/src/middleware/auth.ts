import { jwtVerify, SignJWT } from "jose";
import { JWTPayload } from "../../../shared/types";

export async function createToken(
  payload: Omit<JWTPayload, "exp">,
  secretStr: string
): Promise<string> {
  const secret = new TextEncoder().encode(secretStr);
  return await new SignJWT({ ...payload, typ: "session" } as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("biteradigital:midespensa:auth")
    .setAudience("biteradigital:midespensa:app")
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function authMiddleware(
  request: Request,
  env: { JWT_SECRET: string }
): Promise<JWTPayload | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7);
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      issuer: "biteradigital:midespensa:auth",
      audience: "biteradigital:midespensa:app",
    });
    if (payload.typ !== "session") {
      return null;
    }
    return payload as unknown as JWTPayload;
  } catch (err) {
    return null;
  }
}
