import { randomInt } from "crypto";
import { getRedis } from "@/lib/redis";
import {
  OTP_RATE_LIMIT,
  OTP_RATE_WINDOW,
  OTP_TTL_SECONDS,
} from "@/lib/constants";

function otpKey(kind: "email" | "phone", target: string) {
  return `otp:${kind}:${target.toLowerCase()}`;
}

function rateKey(kind: "email" | "phone", target: string) {
  return `otp:rl:${kind}:${target.toLowerCase()}`;
}

export async function issueOtp(
  kind: "email" | "phone",
  target: string
): Promise<{ ok: true; otp: string } | { ok: false; error: string }> {
  const redis = getRedis();
  const limited = await redis.incr(rateKey(kind, target));
  if (limited === 1) {
    await redis.expire(rateKey(kind, target), OTP_RATE_WINDOW);
  }
  if (limited > OTP_RATE_LIMIT) {
    return { ok: false, error: "Too many OTP requests. Try again later." };
  }

  const otp = String(randomInt(100000, 1000000));
  await redis.set(otpKey(kind, target), otp, "EX", OTP_TTL_SECONDS);
  return { ok: true, otp };
}

export async function consumeOtp(
  kind: "email" | "phone",
  target: string,
  otp: string
): Promise<boolean> {
  const redis = getRedis();
  const stored = await redis.get(otpKey(kind, target));
  if (!stored || stored !== otp.trim()) {
    return false;
  }
  await redis.del(otpKey(kind, target));
  return true;
}
