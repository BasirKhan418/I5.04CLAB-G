import bcrypt from "bcryptjs";
import { randomInt } from "crypto";

export function generatePin(length = 6): string {
  const min = 10 ** (length - 1);
  const max = 10 ** length;
  return String(randomInt(min, max));
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}
