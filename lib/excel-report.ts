import ExcelJS from "exceljs";
import { LAB_SHORT } from "@/lib/constants";
import { formatDuration, formatIstDateTime, formatIstTime } from "@/lib/hours";
import type { HoursReport } from "@/lib/reports";

const RED = "FF4D40";
const INK = "111111";
const CREAM = "FFF9F2";
const WHITE = "FFFFFF";
const MINT = "9EE6C8";
const PALE = "FFF4B8";

function paintHeader(row: ExcelJS.Row, fill: string) {
  row.font = { bold: true, color: { argb: WHITE }, name: "Calibri", size: 11 };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: fill },
  };
  row.alignment = { vertical: "middle", horizontal: "center" };
  row.height = 22;
}

function zebra(row: ExcelJS.Row, index: number) {
  if (index % 2 === 1) {
    row.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: CREAM },
    };
  }
}

function clock(value: string | null) {
  return value ? formatIstTime(value) : "—";
}

export async function buildHoursWorkbook(report: HoursReport) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = `${LAB_SHORT} Developer R&D Team`;
  workbook.created = new Date();
  workbook.properties.date1904 = false;

  const who =
    report.members.length === 1 ? report.members[0].name : LAB_SHORT;
  const title = `${who} · Hours ${report.from} to ${report.to}`;

  const summary = workbook.addWorksheet("Summary", {
    views: [{ state: "frozen", ySplit: 5 }],
  });
  summary.columns = [
    { header: "", key: "a", width: 28 },
    { header: "", key: "b", width: 22 },
    { header: "", key: "c", width: 22 },
    { header: "", key: "d", width: 22 },
  ];
  summary.mergeCells("A1:D1");
  summary.getCell("A1").value = title;
  summary.getCell("A1").font = {
    bold: true,
    size: 16,
    color: { argb: WHITE },
    name: "Calibri",
  };
  summary.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: RED },
  };
  summary.getCell("A1").alignment = { vertical: "middle" };
  summary.getRow(1).height = 28;

  summary.mergeCells("A2:D2");
  summary.getCell("A2").value =
    `Generated ${formatIstDateTime(report.generatedAt)} IST · KPI window 9:00 AM–5:30 PM · each Enter to Exit · time outside the lab is not counted · missing OUT assumes 5:30 PM · punches after 5:30 PM are audit only`;
  summary.getCell("A2").font = { italic: true, size: 10, color: { argb: INK } };
  summary.getCell("A2").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: PALE },
  };

  summary.addRow([]);
  const metricHeader = summary.addRow([
    "Member hours (sum)",
    "Punches",
    "Visitors",
    "People present",
  ]);
  paintHeader(metricHeader, INK);
  const metricRow = summary.addRow([
    report.totals.memberHoursLabel,
    report.totals.punches,
    report.totals.visitors,
    report.members.filter((member) => member.daysPresent > 0).length,
  ]);
  metricRow.font = { bold: true, size: 14 };
  metricRow.alignment = { horizontal: "center" };
  metricRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: MINT },
    };
    cell.border = {
      bottom: { style: "thin", color: { argb: INK } },
    };
  });

  const membersSheet = workbook.addWorksheet("Member hours", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  membersSheet.columns = [
    { header: "Member", key: "name", width: 28 },
    { header: "Email", key: "email", width: 32 },
    { header: "Role", key: "role", width: 14 },
    { header: "Days present", key: "days", width: 14 },
    { header: "Total hours", key: "hours", width: 14 },
    { header: "Total (label)", key: "label", width: 14 },
    { header: "Avg / present day", key: "avg", width: 18 },
    { header: "Status", key: "status", width: 12 },
  ];
  paintHeader(membersSheet.getRow(1), RED);
  report.members.forEach((member, index) => {
    const row = membersSheet.addRow({
      name: member.name,
      email: member.email,
      role: member.role,
      days: member.daysPresent,
      hours: member.totalHours,
      label: member.totalLabel,
      avg: member.avgHours,
      status: member.inside ? "IN" : "OUT",
    });
    zebra(row, index);
    row.getCell("hours").numFmt = "0.00";
    row.getCell("avg").numFmt = "0.00";
  });
  membersSheet.autoFilter = {
    from: "A1",
    to: `H${Math.max(1, report.members.length + 1)}`,
  };

  const dailySheet = workbook.addWorksheet("Daily totals", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  dailySheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Member", key: "name", width: 28 },
    { header: "Email", key: "email", width: 32 },
    { header: "First IN", key: "inAt", width: 14 },
    { header: "Last OUT", key: "outAt", width: 14 },
    { header: "Hours", key: "hours", width: 12 },
    { header: "Hours (label)", key: "label", width: 14 },
    { header: "Note", key: "note", width: 28 },
    { header: "Enters", key: "enters", width: 10 },
    { header: "Exits", key: "exits", width: 10 },
  ];
  paintHeader(dailySheet.getRow(1), RED);

  const byDayMember = new Map<
    string,
    {
      date: string;
      name: string;
      email: string;
      firstIn: string | null;
      lastOut: string | null;
      hoursMs: number;
      assumedOut: boolean;
      enters: number;
      exits: number;
    }
  >();
  for (const session of report.sessions) {
    const key = `${session.date}|${session.userId}`;
    byDayMember.set(key, {
      date: session.date,
      name: session.name,
      email: session.email,
      firstIn: session.inAt,
      lastOut: session.outAt,
      hoursMs: session.hoursMs,
      assumedOut: session.assumedOut,
      enters: session.enterCount,
      exits: session.exitCount,
    });
  }

  [...byDayMember.values()]
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))
    .forEach((row, index) => {
      const added = dailySheet.addRow({
        date: row.date,
        name: row.name,
        email: row.email,
        inAt: clock(row.firstIn),
        outAt: row.assumedOut ? "5:30 PM assumed" : clock(row.lastOut),
        hours: Math.round((row.hoursMs / 3_600_000) * 100) / 100,
        label: formatDuration(row.hoursMs),
        note: row.assumedOut ? "No OUT in window" : "",
        enters: row.enters,
        exits: row.exits,
      });
      zebra(added, index);
      added.getCell("hours").numFmt = "0.00";
    });
  dailySheet.autoFilter = {
    from: "A1",
    to: `J${Math.max(1, byDayMember.size + 1)}`,
  };

  const sessionSheet = workbook.addWorksheet("Visits", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sessionSheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Member", key: "name", width: 28 },
    { header: "IN", key: "inAt", width: 14 },
    { header: "OUT", key: "outAt", width: 14 },
    { header: "Hours", key: "hours", width: 12 },
    { header: "Hours (label)", key: "label", width: 14 },
    { header: "Note", key: "note", width: 18 },
  ];
  paintHeader(sessionSheet.getRow(1), INK);
  [...report.visits]
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name) || a.inAt.localeCompare(b.inAt))
    .forEach((visit, index) => {
      const row = sessionSheet.addRow({
        date: visit.date,
        name: visit.name,
        inAt: clock(visit.inAt),
        outAt: visit.assumedOut ? "5:30 PM assumed" : clock(visit.outAt),
        hours: visit.hours,
        label: visit.hoursLabel,
        note: visit.assumedOut ? "No Exit · assumed 5:30 PM" : "Enter to Exit",
      });
      zebra(row, index);
      row.getCell("hours").numFmt = "0.00";
    });
  sessionSheet.autoFilter = {
    from: "A1",
    to: `G${Math.max(1, report.visits.length + 1)}`,
  };

  const punchSheet = workbook.addWorksheet("All punches", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  punchSheet.columns = [
    { header: "When (IST)", key: "when", width: 22 },
    { header: "Name", key: "name", width: 28 },
    { header: "Email", key: "email", width: 32 },
    { header: "Kind", key: "kind", width: 12 },
    { header: "Direction", key: "direction", width: 12 },
    { header: "Method", key: "method", width: 12 },
    { header: "Status", key: "status", width: 12 },
    { header: "Reason", key: "reason", width: 28 },
    { header: "Use", key: "use", width: 16 },
  ];
  paintHeader(punchSheet.getRow(1), INK);
  [...report.punches]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .forEach((punch, index) => {
      const row = punchSheet.addRow({
        when: formatIstDateTime(punch.createdAt),
        name: punch.name,
        email: punch.email ?? "",
        kind: punch.kind,
        direction: punch.direction.toUpperCase(),
        method: punch.method,
        status: punch.status,
        reason: punch.reason ?? "",
        use:
          punch.kind === "utility"
            ? "Door only"
            : punch.kind === "visitor"
              ? "Visitor"
              : punch.kind === "member" && punch.auditOnly
                ? "Audit only"
                : "KPI window",
      });
      zebra(row, index);
    });
  punchSheet.autoFilter = {
    from: "A1",
    to: `I${Math.max(1, report.punches.length + 1)}`,
  };

  const chartSheet = workbook.addWorksheet("By day");
  chartSheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Member hours", key: "hours", width: 14 },
    { header: "Member IN", key: "ins", width: 14 },
    { header: "Member OUT", key: "outs", width: 14 },
    { header: "Visitor events", key: "visitors", width: 16 },
  ];
  paintHeader(chartSheet.getRow(1), RED);
  report.days.forEach((day, index) => {
    const row = chartSheet.addRow(day);
    zebra(row, index);
    row.getCell("hours").numFmt = "0.00";
  });

  return workbook;
}
