import { publicPng } from "@/lib/public-image";

export const alt = "I5.04C Lab — gate kiosk for members, visitors, and hours";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return publicPng("og.png");
}
