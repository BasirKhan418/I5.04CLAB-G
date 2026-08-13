import { COUNTRY_CODE } from "@/lib/constants";

export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith(COUNTRY_CODE)) {
    return digits.slice(COUNTRY_CODE.length);
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }
  if (digits.length === 10) {
    return digits;
  }
  return null;
}

export function toChatId(phone10: string): string {
  return `${COUNTRY_CODE}${phone10}@c.us`;
}

export function isTenDigitPhone(phone: string): boolean {
  return /^\d{10}$/.test(phone);
}
