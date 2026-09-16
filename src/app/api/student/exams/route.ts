import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userIdStr = searchParams.get("userId");
    const userId = userIdStr ? parseInt(userIdStr) : null;

    const exams = await prisma.exam.findMany({
      include: {
        _count: {
          select: { questions: true },
        },
        results: userId
          ? {
              where: { userId },
              select: {
                id: true,
                score: true,
                correctCount: true,
                incorrectCount: true,
                unansweredCount: true,
                createdAt: true,
              },
            }
          : false,
      },
      orderBy: { id: "desc" },
    });

    const formatted = exams.map((exam) => {
      const userResult = exam.results && exam.results.length > 0 ? exam.results[0] : null;
      return {
        id: exam.id,
        title: exam.title,
        duration: exam.duration,
        totalMarks: exam.totalMarks,
        negativeMarks: exam.negativeMarks,
        questionCount: exam._count.questions,
        isSubmitted: !!userResult,
        result: userResult,
      };
    });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Error fetching student exams:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
