import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, examId, responses } = body;

    // responses is an object: { [questionId]: { selectedOption, status } }

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { questions: true },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;
    let score = 0;

    const responsePromises: any[] = [];

    exam.questions.forEach((question) => {
      const studentResponse = responses[question.id];
      const selectedOption = studentResponse?.selectedOption || null;
      const status = studentResponse?.status || "NOT_VISITED";

      if (selectedOption) {
        if (selectedOption === question.correctOption) {
          correctCount++;
          score += question.marks;
        } else {
          incorrectCount++;
          score -= exam.negativeMarks;
        }
      } else {
        unansweredCount++;
      }

      responsePromises.push(
        prisma.response.upsert({
          where: {
            userId_questionId: {
              userId: userId,
              questionId: question.id,
            },
          },
          update: {
            selectedOption,
            status,
          },
          create: {
            userId,
            questionId: question.id,
            selectedOption,
            status,
          },
        })
      );
    });

    await prisma.$transaction(responsePromises);

    const result = await prisma.result.upsert({
      where: {
        userId_examId: {
          userId,
          examId,
        },
      },
      update: {
        score,
        correctCount,
        incorrectCount,
        unansweredCount,
      },
      create: {
        userId,
        examId,
        score,
        correctCount,
        incorrectCount,
        unansweredCount,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
