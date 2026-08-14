"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/utils";

export type CamStatus = "connecting" | "live" | "idle" | "offline" | "error";

function camSocketUrl(ticket: string) {
  const encoded = encodeURIComponent(ticket);
  if (window.location.protocol === "https:") {
    return `wss://${window.location.host}/cam?ticket=${encoded}`;
  }
  return `ws://${window.location.hostname}:8787/cam?ticket=${encoded}`;
}

export function useCamStream(
  active: boolean,
  canvasRef: React.RefObject<HTMLCanvasElement | null>
) {
  const [status, setStatus] = useState<CamStatus>("idle");
  const paintBusy = useRef(false);
  const latestFrame = useRef<ArrayBuffer | null>(null);

  useEffect(() => {
    function clearCanvas() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    if (!active) {
      latestFrame.current = null;
      clearCanvas();
      return;
    }

    let closed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer = 0;
    const objectUrls: string[] = [];

    function flushUrls() {
      while (objectUrls.length) {
        URL.revokeObjectURL(objectUrls.pop() as string);
      }
    }

    async function paint(buffer: ArrayBuffer) {
      const canvas = canvasRef.current;
      if (!canvas || closed) return;
      const blob = new Blob([buffer], { type: "image/jpeg" });
      const url = URL.createObjectURL(blob);
      objectUrls.push(url);
      try {
        const bmp = await createImageBitmap(blob);
        if (closed) {
          bmp.close();
          return;
        }
        if (canvas.width !== bmp.width || canvas.height !== bmp.height) {
          canvas.width = bmp.width;
          canvas.height = bmp.height;
        }
        const ctx = canvas.getContext("2d", { alpha: false });
        if (ctx) {
          ctx.drawImage(bmp, 0, 0);
        }
        bmp.close();
      } catch {
        /* skip a broken JPEG */
      } finally {
        URL.revokeObjectURL(url);
        const idx = objectUrls.indexOf(url);
        if (idx >= 0) objectUrls.splice(idx, 1);
      }
    }

    async function drain() {
      if (paintBusy.current) return;
      paintBusy.current = true;
      while (latestFrame.current && !closed) {
        const next = latestFrame.current;
        latestFrame.current = null;
        await paint(next);
      }
      paintBusy.current = false;
    }

    async function connect() {
      setStatus("connecting");
      latestFrame.current = null;
      flushUrls();
      clearCanvas();
      const res = await api<{ ticket: string }>("/api/cam/ticket", {
        cache: "no-store",
      });
      if (closed) return;
      if (!res.ok) {
        setStatus("error");
        reconnectTimer = window.setTimeout(connect, 4000);
        return;
      }

      const ws = new WebSocket(camSocketUrl(res.data.ticket));
      socket = ws;
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        if (!closed) setStatus("connecting");
      };
      ws.onmessage = (event) => {
        if (closed) return;
        if (typeof event.data === "string") {
          try {
            const msg = JSON.parse(event.data) as { live?: boolean };
            if (msg.live === false) {
              setStatus("offline");
              latestFrame.current = null;
              clearCanvas();
            }
          } catch {
            /* ignore */
          }
          return;
        }
        setStatus("live");
        latestFrame.current = event.data as ArrayBuffer;
        void drain();
      };
      ws.onclose = () => {
        if (closed) return;
        setStatus("offline");
        latestFrame.current = null;
        flushUrls();
        clearCanvas();
        reconnectTimer = window.setTimeout(connect, 2500);
      };
    }

    void connect();

    return () => {
      closed = true;
      window.clearTimeout(reconnectTimer);
      socket?.close();
      latestFrame.current = null;
      flushUrls();
      clearCanvas();
    };
  }, [active, canvasRef]);

  return { status: active ? status : "idle" };
}
