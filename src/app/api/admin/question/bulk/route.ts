import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || (role !== "ADMIN" && role !== "SUPERADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { examId, questions } = await request.json();

    if (!examId || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: "Invalid payload. Provide examId and non-empty questions array." },
        { status: 400 }
      );
    }

    const parsedExamId = parseInt(examId);
    const adminName = session.user?.name || "Admin";

    // Format questions for Prisma bulk insert
    const formattedQuestions = questions.map((q: any) => ({
      examId: parsedExamId,
      section: (q.section || "General").trim(),
      text: (q.text || "").trim(),
      optionA: (q.optionA || "").trim(),
      optionB: (q.optionB || "").trim(),
      optionC: (q.optionC || "").trim(),
      optionD: (q.optionD || "").trim(),
      correctOption: ["A", "B", "C", "D"].includes(q.correctOption?.toUpperCase())
        ? q.correctOption.toUpperCase()
        : "A",
      marks: parseInt(q.marks) || 1,
      addedBy: adminName,
    }));

    // Filter out any questions with empty text or options
    const validQuestions = formattedQuestions.filter(
      (q) => q.text.length > 0 && q.optionA.length > 0 && q.optionB.length > 0
    );

    if (validQuestions.length === 0) {
      return NextResponse.json(
        { error: "No valid questions found to insert. Ensure question text and options are filled." },
        { status: 400 }
      );
    }

    const result = await prisma.question.createMany({
      data: validQuestions,
    });

    return NextResponse.json({
      success: true,
      count: result.count,
      message: `Successfully imported ${result.count} questions!`,
    });
  } catch (error: any) {
    console.error("Error bulk creating questions:", error);
    return NextResponse.json({ error: "Internal server error: " + error.message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
