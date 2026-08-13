import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function publicPng(filename: string) {
  const data = await readFile(join(process.cwd(), "public", filename));
  return new Response(data, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
