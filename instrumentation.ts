export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startDoorQueueRuntime } = await import("./lib/door-queue");
  startDoorQueueRuntime();
}
