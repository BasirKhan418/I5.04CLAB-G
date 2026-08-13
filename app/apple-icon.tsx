import { publicPng } from "@/lib/public-image";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return publicPng("apple-touch-icon.png");
}
