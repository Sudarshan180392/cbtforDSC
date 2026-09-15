import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const examId = parseInt(params.id);
  
  const { searchParams } = new URL(request.url);
  const userIdStr = searchParams.get("userId");
  const userId = userIdStr ? parseInt(userIdStr) : null;

  if (isNaN(examId)) {
    return NextResponse.json({ error: "Invalid exam ID" }, { status: 400 });
  }

  try {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questions: {
          select: {
            id: true,
            section: true,
            text: true,
            optionA: true,
            optionB: true,
            optionC: true,
            optionD: true,
            marks: true,
          },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    let existingResult = null;
    if (userId) {
      existingResult = await prisma.result.findUnique({
        where: { userId_examId: { userId, examId } },
      });
    }

    return NextResponse.json({ exam, existingResult });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
