import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const outDir = path.join(process.cwd(), ".audit");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({
  path: path.join(outDir, "kiosk-visitor.png"),
  fullPage: true,
});

        await page.getByRole("button", { name: /i.m a member/i }).click();
await page.waitForTimeout(400);
await page.screenshot({
  path: path.join(outDir, "kiosk-member.png"),
  fullPage: true,
});

const boxes = await page.evaluate(() => {
  const interesting = [];
  for (const el of document.querySelectorAll("*")) {
    const s = getComputedStyle(el);
    const bw = s.borderWidth;
    const bc = s.borderColor;
    if (bw === "0px" || bw === "0px 0px 0px 0px") continue;
    if (el.offsetWidth < 8 || el.offsetHeight < 8) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    interesting.push({
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || "").slice(0, 40).replace(/\s+/g, " "),
      border: `${s.borderWidth} ${s.borderStyle} ${s.borderColor}`,
      radius: s.borderRadius,
      shadow: s.boxShadow === "none" ? "none" : "yes",
    });
  }
  return interesting;
});

console.log(JSON.stringify({ screenshots: outDir, bordered: boxes }, null, 2));
await browser.close();
