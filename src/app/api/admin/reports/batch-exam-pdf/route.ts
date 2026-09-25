import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBatchExamReportData } from "@/lib/batchReportService";
import { generateBatchExamPdfReport } from "@/lib/pdfReportGenerator";

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

    // Generate binary PDF
    const pdfBuffer = generateBatchExamPdfReport(data);

    // Sanitize filename for HTTP header
    const safeBatchName = data.batchName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeExamTitle = data.examTitle.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `Batch_${safeBatchName}_Exam_${safeExamTitle}_Marks_Report.pdf`;

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    console.error("Batch exam PDF generation error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
