import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBatchExamReportData } from "@/lib/batchReportService";

export async function GET(request: Request) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role;

    if (!session || (role !== "ADMIN" && role !== "SUPERADMIN")) {
      return NextResponse.json({ error: "Forbidden: Admin or Superadmin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const batchIdParam = searchParams.get("batchId");
    const examIdParam = searchParams.get("examId");

    if (!batchIdParam) {
      return NextResponse.json({ error: "batchId parameter is required" }, { status: 400 });
    }

    const batchId = parseInt(batchIdParam);
    const examId = examIdParam ? parseInt(examIdParam) : undefined;

    if (isNaN(batchId)) {
      return NextResponse.json({ error: "Invalid batchId" }, { status: 400 });
    }

    const { data, error } = await getBatchExamReportData(batchId, examId);

    if (error || !data) {
      return NextResponse.json({ error: error || "Failed to generate report" }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Batch exam report API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
