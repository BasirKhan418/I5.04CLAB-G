import { connectDB } from "@/lib/db";
import { jsonError, jsonOk, requireSession } from "@/lib/api";
import { buildHoursReport } from "@/lib/reports";

export async function GET(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  await connectDB();
  const report = await buildHoursReport(
    searchParams.get("from"),
    searchParams.get("to"),
    searchParams.get("userId")
  );
  if ("error" in report) {
    return jsonError(report.error);
  }
  return jsonOk(report);
}
