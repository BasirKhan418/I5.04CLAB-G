import { spawn } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import ffmpegPath from "ffmpeg-static";

const MAX_SECONDS = 4;

function parseSeconds(stderr: string) {
  const matches = [...stderr.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
  const last = matches.at(-1);
  if (!last) return MAX_SECONDS;
  const seconds =
    Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]);
  if (!Number.isFinite(seconds) || seconds <= 0) return MAX_SECONDS;
  return Math.min(MAX_SECONDS, Math.max(1, Math.round(seconds)));
}

function runFfmpeg(bin: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const proc = spawn(bin, args);
    let err = "";
    proc.stderr.on("data", (chunk) => {
      err += String(chunk);
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(err);
        return;
      }
      reject(new Error(`ffmpeg ${code}: ${err.slice(-400)}`));
    });
  });
}

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
    const stderr = await runFfmpeg(ffmpeg, [
      "-y",
      "-fflags",
      "+genpts",
      "-i",
      src,
      "-t",
      String(MAX_SECONDS),
      "-vn",
      "-ac",
      "1",
      "-ar",
      "48000",
      "-c:a",
      "libopus",
      "-b:a",
      "24k",
      "-vbr",
      "on",
      "-application",
      "voip",
      "-frame_duration",
      "20",
      "-map_metadata",
      "-1",
      "-f",
      "ogg",
      dest,
    ]);
    return {
      buffer: await readFile(dest),
      seconds: parseSeconds(stderr),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
