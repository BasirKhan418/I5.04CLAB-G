import { createHmac, timingSafeEqual } from "crypto";
import { getEnv } from "@/lib/env";

const SIG_BYTES = 8;

function b64url(buf: Buffer) {
  return buf.toString("base64url");
}

function secret() {
  return getEnv().jwtSecret;
}

export function makeAllowToken(id: string) {
  const idBuf = Buffer.from(id, "hex");
  if (idBuf.length !== 12) {
    throw new Error("Bad request id");
  }
  const sig = createHmac("sha256", secret()).update(idBuf).digest().subarray(0, SIG_BYTES);
  return b64url(Buffer.concat([idBuf, sig]));
}

export function verifyAllowToken(token: string): string | null {
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length !== 12 + SIG_BYTES) return null;
    const idBuf = raw.subarray(0, 12);
    const sig = raw.subarray(12);
    const expect = createHmac("sha256", secret()).update(idBuf).digest().subarray(0, SIG_BYTES);
    if (sig.length !== expect.length || !timingSafeEqual(sig, expect)) {
      return null;
    }
    return idBuf.toString("hex");
  } catch {
    return null;
  }
}

export function publicAllowUrl(id: string) {
  const host = getEnv().publicHost.replace(/\/$/, "");
  if (!host) return null;
  return `${host}/a/${makeAllowToken(id)}`;
}
