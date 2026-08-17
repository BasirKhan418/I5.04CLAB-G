import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { jsonError, requireSession } from "@/lib/api";
import { buildHoursReport } from "@/lib/reports";
import { buildHoursWorkbook } from "@/lib/excel-report";

export const runtime = "nodejs";

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

  try {
    const workbook = await buildHoursWorkbook(report);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const person =
      report.members.length === 1
        ? report.members[0].name.replace(/[^\w]+/g, "-")
        : "lab";
    const filename = `I5.04C-Lab-${person}-${report.from}-to-${report.to}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("excel export failed", error);
    return jsonError("Could not build Excel file");
  }
}
