import type { Metadata } from "next";
import { Kiosk } from "@/components/kiosk";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Gate kiosk",
  absoluteTitle: "I5.04C Lab — Gate kiosk for members and visitors",
  description:
    "Check in to I5.04C Lab with PIN or OTP, request visitor access, and open the door from the public gate kiosk.",
  path: "/",
});

export default function HomePage() {
  return (
    <>
      <header className="sr-only">
        <h1>I5.04C Lab gate kiosk</h1>
        <p>
          Member PIN or OTP check-in, visitor requests, and live door access for
          I5.04C Lab.
        </p>
      </header>
      <Kiosk />
    </>
  );
}
