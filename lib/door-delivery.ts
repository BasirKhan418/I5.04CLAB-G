export function doorDeliveryNote(delivery?: {
  status?: "sent" | "queued";
  online?: boolean;
}) {
  if (delivery?.status === "queued") {
    return "Door is offline. It will open within 1 minute if the lock comes back.";
  }
  return "Door opening.";
}
