import { jwtVerify, SignJWT } from "jose";
import { JWTPayload } from "../../../shared/types";

export async function createToken(
  payload: Omit<JWTPayload, "exp">,
  secretStr: string
): Promise<string> {
  const secret = new TextEncoder().encode(secretStr);
  return await new SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
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
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JWTPayload;
  } catch (err) {
    return null;
  }
}
