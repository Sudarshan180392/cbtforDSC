import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  generateStudentAnswerKeyPdf,
  StudentAnswerKeyReportData,
  QuestionAnswerItem,
} from "@/lib/studentAnswerKeyPdfGenerator";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const examIdStr = searchParams.get("examId");
    const userIdStr = searchParams.get("userId");

    if (!examIdStr || !userIdStr) {
      return NextResponse.json({ error: "examId and userId are required parameters" }, { status: 400 });
    }

    const examId = parseInt(examIdStr);
    const userId = parseInt(userIdStr);

    if (isNaN(examId) || isNaN(userId)) {
      return NextResponse.json({ error: "Invalid examId or userId" }, { status: 400 });
    }

    // 1. Verify User & Check Dashboard Access (Monetization Gate)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, rollNo: true, dashboardAccess: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    if (!user.dashboardAccess) {
      return NextResponse.json(
        { error: "Access Denied: Full test series dashboard access is required to download detailed answer keys." },
        { status: 403 }
      );
    }

    // 2. Verify Exam Exists & Student Has Completed It
    const [exam, result] = await Promise.all([
      prisma.exam.findUnique({
        where: { id: examId },
        include: {
          questions: {
            orderBy: { id: "asc" },
          },
        },
      }),
      prisma.result.findUnique({
        where: { userId_examId: { userId, examId } },
      }),
    ]);

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    if (!result) {
      return NextResponse.json(
        { error: "You have not completed or submitted this exam yet." },
        { status: 400 }
      );
    }

    // 3. Fetch User's Saved Responses for this Exam
    const responses = await prisma.response.findMany({
      where: {
        userId,
        questionId: { in: exam.questions.map((q) => q.id) },
      },
    });

    const responseMap = new Map<number, (typeof responses)[0]>();
    responses.forEach((r) => responseMap.set(r.questionId, r));

    // Helper to get text for an option key ("A" | "B" | "C" | "D")
    const getOptionText = (q: (typeof exam.questions)[0], key: string | null): string | null => {
      if (!key) return null;
      const upper = key.toUpperCase();
      if (upper === "A") return q.optionA;
      if (upper === "B") return q.optionB;
      if (upper === "C") return q.optionC;
      if (upper === "D") return q.optionD;
      return null;
    };

    // 4. Map questions to report format
    const questionsData: QuestionAnswerItem[] = exam.questions.map((q, idx) => {
      const resp = responseMap.get(q.id);
      const selectedOption = resp?.selectedOption || null;
      const isAnswered = selectedOption !== null && selectedOption !== undefined && selectedOption.trim() !== "";
      const isCorrect = isAnswered && selectedOption.toUpperCase() === q.correctOption.toUpperCase();

      let status: "CORRECT" | "INCORRECT" | "SKIPPED" = "SKIPPED";
      let marksEarned = 0;

      if (isAnswered) {
        if (isCorrect) {
          status = "CORRECT";
          marksEarned = q.marks;
        } else {
          status = "INCORRECT";
          marksEarned = -exam.negativeMarks;
        }
      }

      return {
        number: idx + 1,
        section: q.section,
        text: q.text,
        correctOption: q.correctOption,
        correctOptionText: getOptionText(q, q.correctOption) || "",
        selectedOption,
        selectedOptionText: getOptionText(q, selectedOption),
        marks: q.marks,
        status,
        marksEarned,
      };
    });

    const reportData: StudentAnswerKeyReportData = {
      instituteName: "Crack Academy",
      studentName: user.name,
      rollNo: user.rollNo,
      examTitle: exam.title,
      examDuration: exam.duration,
      totalMarks: exam.totalMarks,
      negativeMarks: exam.negativeMarks,
      submittedAt: new Date(result.createdAt).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      score: result.score,
      correctCount: result.correctCount,
      incorrectCount: result.incorrectCount,
      unansweredCount: result.unansweredCount,
      totalQuestions: exam.questions.length,
      questions: questionsData,
    };

    const pdfBuffer = generateStudentAnswerKeyPdf(reportData);

    const safeTitle = exam.title.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeRoll = user.rollNo.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `Crack_Academy_Answer_Key_${safeTitle}_${safeRoll}.pdf`;

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
    console.error("Student Answer Key PDF generation error:", err);
    return NextResponse.json({ error: "Internal server error while generating Answer Key PDF" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
