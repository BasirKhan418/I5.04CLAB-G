import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { LiveCamera } from "@/components/live-camera";

export const metadata: Metadata = pageMetadata({
  title: "Door camera",
  description: "Live ESP32-CAM view of the I5.04C Lab door, relayed through the server.",
  path: "/dashboard/camera",
  index: false,
});

export default function CameraPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div>
        <p className="text-sm font-medium text-ink/50">Door</p>
        <h1 className="font-heading text-3xl">Live camera</h1>
        <p className="mt-1 text-sm text-ink/60">
          Frames are pushed from the ESP32-CAM to this server, then to your
          browser. The board’s LAN address is never exposed.
        </p>
      </div>
      <LiveCamera />
    </div>
  );
}
