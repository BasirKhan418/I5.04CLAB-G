import { spawn } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import ffmpegPath from "ffmpeg-static";

export async function toOggOpus(input: Buffer, inputExt: string) {
  const ffmpeg = ffmpegPath;
  if (!ffmpeg) {
    throw new Error("ffmpeg is not available");
  }

  const dir = await mkdtemp(join(tmpdir(), "lab-voice-"));
  const src = join(dir, `in.${inputExt.replace(/[^a-z0-9]/gi, "") || "webm"}`);
  const dest = join(dir, "out.ogg");

  try {
    await writeFile(src, input);
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpeg, [
        "-y",
        "-i",
        src,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "48000",
        "-c:a",
        "libopus",
        "-b:a",
        "24k",
        "-application",
        "voip",
        "-f",
        "ogg",
        dest,
      ]);
      let err = "";
      proc.stderr.on("data", (chunk) => {
        err += String(chunk);
      });
      proc.on("error", reject);
      proc.on("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`ffmpeg ${code}: ${err.slice(-400)}`));
      });
    });
    return await readFile(dest);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
