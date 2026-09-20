import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

// Returns the assigned active exam ID for the student's batch, falling back to the latest exam
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userIdStr = searchParams.get("userId");
    const userId = userIdStr ? parseInt(userIdStr) : null;

    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          batch: {
            select: {
              id: true,
              name: true,
              activeExamId: true,
              activeExam: { select: { id: true, title: true } },
            },
          },
        },
      });

      // If student belongs to a batch with an active exam assigned, return that exam
      if (user?.batch?.activeExamId) {
        return NextResponse.json({
          examId: user.batch.activeExamId,
          batchName: user.batch.name,
          examTitle: user.batch.activeExam?.title,
        });
      }
    }

    // Fallback: Return the most recently created exam
    const latestExam = await prisma.exam.findFirst({
      orderBy: { id: "desc" },
      select: { id: true, title: true },
    });

    if (!latestExam) {
      return NextResponse.json({ error: "No exams available" }, { status: 404 });
    }

    return NextResponse.json({
      examId: latestExam.id,
      examTitle: latestExam.title,
      isFallback: true,
    });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
