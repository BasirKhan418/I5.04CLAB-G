import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import { CAM_TICKET_SECONDS, SESSION_MAX_AGE } from "./constants";

export type SessionPayload = {
  sub: string;
  email: string;
  role: "superadmin" | "admin" | "member";
  name: string;
};

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing JWT_SECRET");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());
}

export async function verifySession(
  token: string
): Promise<(SessionPayload & JWTPayload) | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.name !== "string"
    ) {
      return null;
    }
    return payload as SessionPayload & JWTPayload;
  } catch {
    return null;
  }
}

export async function signCamTicket(sub: string): Promise<string> {
  return new SignJWT({ sub, purpose: "cam" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${CAM_TICKET_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyCamTicket(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.purpose === "cam" && typeof payload.sub === "string";
  } catch {
    return false;
  }
}
