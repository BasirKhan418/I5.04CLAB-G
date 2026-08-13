import { getEnv } from "@/lib/env";

async function openwaFetch(path: string, body: unknown) {
  const env = getEnv();
  const url = `${env.openwaApiUrl}/sessions/${env.openwaSessionId}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": env.openwaApiKey,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    /* keep text */
  }
  if (!res.ok) {
    throw new Error(
      `OpenWA ${path} failed (${res.status}): ${typeof json === "string" ? json : JSON.stringify(json)}`
    );
  }
  return json;
}

export async function sendText(chatId: string, text: string) {
  return openwaFetch("/messages/send-text", { chatId, text });
}

export async function sendImage(
  chatId: string,
  url: string,
  caption?: string
) {
  return openwaFetch("/messages/send-image", { chatId, url, caption });
}

export async function sendVoice(chatId: string, url: string) {
  return openwaFetch("/messages/send-audio", {
    chatId,
    url,
    ptt: true,
  });
}

export async function sendTemplate(
  chatId: string,
  vars: Record<string, string>
) {
  const env = getEnv();
  if (!env.openwaTemplateId) {
    throw new Error("TEMPLATE_ID_OPENWA is not set");
  }
  return openwaFetch("/messages/send-template", {
    chatId,
    templateId: env.openwaTemplateId,
    vars,
  });
}
